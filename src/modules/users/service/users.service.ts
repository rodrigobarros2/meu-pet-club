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

    // Salvar a senha original para enviar por email
    const originalPassword = data.password;

    // Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Criar novo usuário
    const createdUser = new this.userModel({
      ...data,
      password: hashedPassword,
    });

    // Salvar usuário
    const savedUser = await createdUser.save();

    // Enviar email com credenciais
    try {
      await this.emailService.sendWelcomeEmail(savedUser.email, savedUser.name, originalPassword);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      // Não interrompe o fluxo se o email falhar
    }

    // Invalidar caches relacionados a usuários
    await this.redisService.delByPattern('users:*');

    return {
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
    };
  }

  async findAll(): Promise<User[]> {
    // Chave de cache para lista de usuários
    const cacheKey = 'users:all';

    // Tentar obter do cache
    const cachedUsers = await this.redisService.get<User[]>(cacheKey);
    if (cachedUsers) {
      return cachedUsers;
    }

    // Se não há cache, buscar do banco de dados
    const users = await this.userModel.find().select('-password').exec();

    // Armazenar no cache
    await this.redisService.set(cacheKey, users);

    return users;
  }

  async findById(id: string): Promise<User | null> {
    // Chave de cache para usuário específico
    const cacheKey = `user:id:${id}`;

    // Tentar obter do cache
    const cachedUser = await this.redisService.get<User>(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    // Se não há cache, buscar do banco de dados
    const user = await this.userModel.findById(id).select('-password').exec();

    if (!user) {
      return null;
    }

    // Armazenar no cache
    await this.redisService.set(cacheKey, user);

    return user;
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findByRole(role: string): Promise<User[]> {
    // Chave de cache para usuários por papel
    const cacheKey = `users:role:${role}`;

    // Tentar obter do cache
    const cachedUsers = await this.redisService.get<User[]>(cacheKey);
    if (cachedUsers) {
      return cachedUsers;
    }

    // Se não há cache, buscar do banco de dados
    const users = await this.userModel.find({ role }).select('-password').exec();

    // Armazenar no cache
    await this.redisService.set(cacheKey, users);

    return users;
  }

  async invalidateUserCache(userId: string, email: string) {
    await this.redisService.del(`user:id:${userId}`);
    await this.redisService.del(`user:email:${email}:auth`);
    await this.redisService.delByPattern('users:*');
  }
}
