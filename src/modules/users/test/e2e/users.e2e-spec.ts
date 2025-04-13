import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../../users/schemas/user.schema';
import { MongoMemoryModule, closeInMemoryMongoConnection } from '../../../../config/mongo-memory-server.module';
import { UserRole } from '../../../../common/enums/role..enum';
import { TestAppModule } from '../../../../config/test-app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let userModel: Model<User>;
  let adminToken: string;
  let clientToken: string;
  let adminId: string;
  let clientId: string;

  const testUsers = {
    admin: {
      name: 'Admin User',
      email: 'admin@petclub.com',
      password: 'Admin@123',
      role: UserRole.ADMIN,
    },
    client: {
      name: 'Regular User',
      email: 'user@petclub.com',
      password: 'User@123',
      role: UserRole.CLIENT,
    },
  };

  // Função de login para obter tokens
  const login = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    return res.body.access_token;
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [await MongoMemoryModule.forRoot(), TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    userModel = moduleFixture.get<Model<User>>(getModelToken('User'));

    // Limpar o banco de dados
    await userModel.deleteMany({});

    // Cria os usuários diretamente no banco
    const adminUser = await userModel.create({
      ...testUsers.admin,
      password: await bcrypt.hash(testUsers.admin.password, 10),
    });
    adminId = adminUser._id.toString();

    const clientUser = await userModel.create({
      ...testUsers.client,
      password: await bcrypt.hash(testUsers.client.password, 10),
    });
    clientId = clientUser._id.toString();

    await app.init();

    // Obter tokens através da rota /auth/login
    adminToken = await login(testUsers.admin.email, testUsers.admin.password);
    clientToken = await login(testUsers.client.email, testUsers.client.password);
  });

  afterAll(async () => {
    await app.close();
    await closeInMemoryMongoConnection();
  });

  describe('GET /users', () => {
    it('deve retornar 401 se não enviar token', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('deve retornar 403 para usuário CLIENT tentando acessar', async () => {
      await request(app.getHttpServer()).get('/users').set('Authorization', `Bearer ${clientToken}`).expect(403);
    });

    it('deve retornar a lista de usuários para ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Como já temos 2 usuários criados
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /users/:id', () => {
    it('deve retornar 401 sem token', async () => {
      await request(app.getHttpServer()).get(`/users/${clientId}`).expect(401);
    });

    it('deve retornar 403 para usuário CLIENT acessando outro usuário', async () => {
      await request(app.getHttpServer())
        .get(`/users/${clientId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });

    it('deve retornar o usuário pelo ID para ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.email).toBe(testUsers.client.email);
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('POST /users', () => {
    const newUser = {
      name: 'Novo Cliente',
      email: 'novo-cliente@petclub.com',
      password: 'Cliente@123',
      role: UserRole.CLIENT,
    };

    it('deve retornar 401 sem token', async () => {
      await request(app.getHttpServer()).post('/users').send(newUser).expect(401);
    });

    it('deve retornar 403 para usuário CLIENT criando um novo usuário', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(newUser)
        .expect(403);
    });

    it('deve criar um novo usuário quando acessado por ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(201);
      expect(res.body.email).toBe(newUser.email);
      expect(res.body).toHaveProperty('name', newUser.name);
      expect(res.body).toHaveProperty('role', newUser.role);
    });

    it('deve retornar conflito se o email já estiver registrado', async () => {
      // Tenta criar novamente com o mesmo email
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(409);
    });
  });
});
