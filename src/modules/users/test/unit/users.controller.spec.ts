import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../controller/users.controller';
import { UsersService } from '../../service/users.service';
import { CreateUserDto } from '../../dto/create-user.dto';
import { UserRole } from '../../../../common/enums/role..enum';
import { Types } from 'mongoose';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUser = {
    _id: new Types.ObjectId().toString(),
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword123',
    role: UserRole.CLIENT,
  };

  const mockUsers = [
    mockUser,
    {
      _id: new Types.ObjectId().toString(),
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'hashedPassword456',
      role: UserRole.ADMIN,
    },
  ];

  const createUserDto: CreateUserDto = {
    name: 'New User',
    email: 'new@example.com',
    password: 'password123',
    role: UserRole.CLIENT,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              _id: new Types.ObjectId().toString(),
              ...createUserDto,
              password: 'hashedPassword',
            }),
            findAll: jest.fn().mockResolvedValue(mockUsers),
            findById: jest.fn().mockImplementation((id) => {
              if (id === mockUser._id) {
                return Promise.resolve(mockUser);
              }
              return Promise.resolve(null);
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('deve chamar usersService.create com os dados corretos e retornar o usuário criado', async () => {
      const result = await controller.create(createUserDto);

      expect(usersService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual({
        _id: expect.any(String),
        name: createUserDto.name,
        email: createUserDto.email,
        password: 'hashedPassword',
        role: createUserDto.role,
      });
    });
  });

  describe('findAll', () => {
    it('deve chamar usersService.findAll e retornar todos os usuários', async () => {
      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
      expect(result.length).toBe(2);
    });
  });

  describe('findById', () => {
    it('deve chamar usersService.findById com o ID correto e retornar o usuário', async () => {
      const result = await controller.findById(mockUser._id);

      expect(usersService.findById).toHaveBeenCalledWith(mockUser._id);
      expect(result).toEqual(mockUser);
    });

    it('deve retornar null quando o usuário não for encontrado', async () => {
      const nonExistingId = new Types.ObjectId().toString();
      jest.spyOn(usersService, 'findById').mockResolvedValueOnce(null);

      const result = await controller.findById(nonExistingId);

      expect(usersService.findById).toHaveBeenCalledWith(nonExistingId);
      expect(result).toBeNull();
    });
  });
});
