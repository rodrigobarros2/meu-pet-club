import { AuthService } from '../../service/auth.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: Partial<JwtService>;
  let usersService: any;

  beforeEach(() => {
    jwtService = {
      sign: jest.fn().mockImplementation((payload) => `signed-${payload.sub}`),
    };

    usersService = {
      findByEmail: jest.fn(),
    };

    authService = new AuthService(jwtService as JwtService, usersService);
  });

  describe('validateUser', () => {
    it('deve retornar null se o usuário não for encontrado', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await authService.validateUser('test@example.com', 'password');
      expect(result).toBeNull();
    });

    it('deve retornar null se a senha for inválida', async () => {
      const fakeUser = {
        email: 'test@example.com',
        password: await bcrypt.hash('correctPassword', 10),
      };
      usersService.findByEmail.mockResolvedValue(fakeUser);

      const result = await authService.validateUser('test@example.com', 'wrongPassword');
      expect(result).toBeNull();
    });

    it('deve retornar o usuário se as credenciais forem válidas', async () => {
      const fakeUser = {
        _id: 'user-id',
        email: 'test@example.com',
        password: await bcrypt.hash('password', 10),
        name: 'Test User',
        role: 'CLIENT',
      };
      usersService.findByEmail.mockResolvedValue(fakeUser);

      const result = await authService.validateUser('test@example.com', 'password');
      expect(result).toEqual(fakeUser);
    });
  });

  describe('login', () => {
    it('deve retornar token e dados do usuário', async () => {
      const user = {
        _id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CLIENT',
      };

      const result = await authService.login(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        username: user.email,
        sub: user._id,
        role: user.role,
      });
      expect(result).toEqual({
        access_token: `signed-${user._id}`,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    });
  });

  describe('logout e isTokenInvalid', () => {
    it('deve marcar o token como inválido', async () => {
      const token = 'test-token';
      const userId = 'user-id';

      expect(authService.isTokenInvalid(token)).toBe(false);

      await authService.logout(userId, token);

      expect(authService.isTokenInvalid(token)).toBe(true);
    });
  });
});
