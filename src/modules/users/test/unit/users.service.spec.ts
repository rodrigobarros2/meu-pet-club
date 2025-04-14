import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../service/users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../../schemas/user.schema';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../../../common/enums/role..enum';
import { EmailService } from '../../../email/service/email.service';
import { RedisService } from '../../../redis/service/redis.service';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: any;
  let emailService: EmailService;
  let redisService: RedisService;

  const mockUser = {
    _id: 'user-id-1',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'CLIENT',
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn(),
            del: jest.fn(),
            delByPattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userModel = module.get(getModelToken(User.name));
    emailService = module.get<EmailService>(EmailService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      role: 'CLIENT' as UserRole,
    };

    it('deve lançar ConflictException se o usuário já existir', async () => {
      userModel.findOne.mockReturnValue({ exec: () => Promise.resolve(mockUser) });
      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(userModel.findOne).toHaveBeenCalledWith({ email: createUserDto.email });
    });
  });

  describe('findAll', () => {
    it('deve retornar os usuários do cache se disponíveis', async () => {
      const users = [mockUser];
      (redisService.get as jest.Mock).mockResolvedValue(users);

      const result = await service.findAll();
      expect(redisService.get).toHaveBeenCalledWith('users:all');
      expect(result).toEqual(users);
      expect(userModel.find).not.toHaveBeenCalled();
    });

    it('deve buscar os usuários no banco e configurar o cache quando não houver cache', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      userModel.find.mockReturnValue({ exec: () => Promise.resolve([mockUser]) });

      const result = await service.findAll();
      expect(userModel.find).toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalledWith('users:all', [mockUser]);
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findById', () => {
    it('deve retornar o usuário do cache se disponível', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findById('user-id-1');
      expect(redisService.get).toHaveBeenCalledWith('user:id:user-id-1');
      expect(result).toEqual(mockUser);
    });

    it('deve buscar o usuário por id no banco e configurar o cache quando não houver cache', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      userModel.findById.mockReturnValue({
        select: () => ({ exec: () => Promise.resolve(mockUser) }),
      });

      const result = await service.findById('user-id-1');
      expect(userModel.findById).toHaveBeenCalledWith('user-id-1');
      expect(redisService.set).toHaveBeenCalledWith('user:id:user-id-1', mockUser);
      expect(result).toEqual(mockUser);
    });

    it('deve retornar null se o usuário não for encontrado', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      userModel.findById.mockReturnValue({
        select: () => ({ exec: () => Promise.resolve(null) }),
      });

      const result = await service.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('deve retornar um usuário pelo email', async () => {
      userModel.findOne.mockReturnValue({
        select: () => ({ exec: () => Promise.resolve(mockUser) }),
      });
      const result = await service.findByEmail(mockUser.email);
      expect(userModel.findOne).toHaveBeenCalledWith({ email: mockUser.email });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByRole', () => {
    it('deve retornar os usuários do cache por role se disponíveis', async () => {
      (redisService.get as jest.Mock).mockResolvedValue([mockUser]);
      const result = await service.findByRole('CLIENT');
      expect(redisService.get).toHaveBeenCalledWith('users:role:CLIENT');
      expect(result).toEqual([mockUser]);
    });

    it('deve buscar os usuários por role no banco e configurar o cache quando não houver cache', async () => {
      (redisService.get as jest.Mock).mockResolvedValue(null);
      userModel.find.mockReturnValue({
        select: () => ({ exec: () => Promise.resolve([mockUser]) }),
      });
      const result = await service.findByRole('CLIENT');
      expect(userModel.find).toHaveBeenCalledWith({ role: 'CLIENT' });
      expect(redisService.set).toHaveBeenCalledWith('users:role:CLIENT', [mockUser]);
      expect(result).toEqual([mockUser]);
    });
  });

  describe('invalidateUserCache', () => {
    it('deve invalidar as chaves de cache do usuário corretamente', async () => {
      await service.invalidateUserCache('user-id', 'user@example.com');
      expect(redisService.del).toHaveBeenCalledWith('user:id:user-id');
      expect(redisService.del).toHaveBeenCalledWith('user:email:user@example.com:auth');
      expect(redisService.delByPattern).toHaveBeenCalledWith('users:*');
    });
  });
});
