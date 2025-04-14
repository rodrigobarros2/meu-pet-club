import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../controller/auth.controller';
import { AuthService } from '../../service/auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../../dto/login-auth.dto';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: Partial<AuthService>;

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('deve retornar token e dados do usuário se as credenciais forem válidas', async () => {
      const loginDto: LoginDto = { email: 'test@example.com', password: 'Password123' };
      const user = { _id: 'user-id', email: 'test@example.com', name: 'Test User', role: 'CLIENT' };

      (authService.validateUser as jest.Mock).mockResolvedValue(user);
      const resultLogin = {
        access_token: 'some-token',
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      };
      (authService.login as jest.Mock).mockResolvedValue(resultLogin);

      const result = await authController.login(loginDto);

      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(authService.login).toHaveBeenCalledWith(user);
      expect(result).toEqual(resultLogin);
    });

    it('deve lançar UnauthorizedException se as credenciais forem inválidas', async () => {
      const loginDto: LoginDto = { email: 'test@example.com', password: 'WrongPassword' };

      (authService.validateUser as jest.Mock).mockResolvedValue(null);

      await expect(authController.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
    });
  });

  describe('logout', () => {
    it('deve chamar o método logout do AuthService com userId e token', async () => {
      const req = {
        headers: { authorization: 'Bearer test-token' },
        user: { userId: 'user-id' },
      };

      await authController.logout(req);
      expect(authService.logout).toHaveBeenCalledWith('user-id', 'test-token');
    });
  });
});
