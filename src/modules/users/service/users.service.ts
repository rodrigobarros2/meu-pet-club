import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../email/service/email.service';
import { RedisService } from '../../redis/service/redis.service';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private emailService: EmailService,
    private redisService: RedisService,
  ) {}

  async create(data: CreateUserDto): Promise<{ name: string; email: string; role: string }> {
    // Verificar se o email já existe
    const existingUser = await this.userModel.findOne({ email: data.email }).exec();
    if (existingUser) {
      throw new ConflictException('Email já está registrado');
    }

    const originalPassword = data.password;

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const createdUser = new this.userModel({
      ...data,
      password: hashedPassword,
    });

    const savedUser = await createdUser.save();

    try {
      await this.emailService.sendWelcomeEmail(savedUser.email, savedUser.name, originalPassword);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
    }

    await this.redisService.delByPattern('users:*');

    return {
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
    };
  }

  async findAll(): Promise<User[]> {
    const cacheKey = 'users:all';

    const cachedUsers = await this.redisService.get<User[]>(cacheKey);
    if (cachedUsers) {
      return cachedUsers;
    }

    const users = await this.userModel.find().exec();

    await this.redisService.set(cacheKey, users);

    return users;
  }

  async findById(id: string): Promise<User | null> {
    const cacheKey = `user:id:${id}`;

    const cachedUser = await this.redisService.get<User>(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.userModel.findById(id).select('-password').exec();

    if (!user) {
      return null;
    }

    await this.redisService.set(cacheKey, user);

    return user;
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findByRole(role: string): Promise<User[]> {
    const cacheKey = `users:role:${role}`;

    const cachedUsers = await this.redisService.get<User[]>(cacheKey);
    if (cachedUsers) {
      return cachedUsers;
    }

    const users = await this.userModel.find({ role }).select('-password').exec();

    await this.redisService.set(cacheKey, users);

    return users;
  }

  async invalidateUserCache(userId: string, email: string) {
    await this.redisService.del(`user:id:${userId}`);
    await this.redisService.del(`user:email:${email}:auth`);
    await this.redisService.delByPattern('users:*');
  }
}
