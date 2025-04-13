import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { User } from '../../../users/schemas/user.schema';
import { closeInMemoryMongoConnection, MongoMemoryModule } from '../../../../config/mongo-memory-server.module';
import { TestAppModule } from '../../../../config/test-app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let userModel: Model<User>;
  let mongoConnection: Connection;
  let adminToken: string;
  let userToken: string;

  const testUserAdmin = {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'Admin@123',
    role: 'ADMIN',
  };

  const testUserRegular = {
    name: 'Regular User',
    email: 'user@example.com',
    password: 'User@123',
    role: 'CLIENT',
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [await MongoMemoryModule.forRoot(), TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    userModel = moduleFixture.get<Model<User>>(getModelToken('User'));
    mongoConnection = moduleFixture.get<Connection>(getConnectionToken());

    await userModel.deleteMany({});
    await userModel.create({
      ...testUserAdmin,
      password: await bcrypt.hash(testUserAdmin.password, 10),
    });
    await userModel.create({
      ...testUserRegular,
      password: await bcrypt.hash(testUserRegular.password, 10),
    });

    await app.init();
  });

  afterAll(async () => {
    const mongod = moduleFixture.get('MONGO_MEMORY_SERVER');
    await app.close();
    await closeInMemoryMongoConnection();
  });

  describe('/auth/login (POST)', () => {
    it('deve retornar 401 com credenciais inválidas', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'wrong@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('deve fazer login com sucesso como ADMIN e retornar token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUserAdmin.email, password: testUserAdmin.password })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toHaveProperty('email', testUserAdmin.email);
      expect(response.body.user).toHaveProperty('name', testUserAdmin.name);
      expect(response.body.user).toHaveProperty('role', testUserAdmin.role);
      adminToken = response.body.access_token;
    });

    it('deve fazer login com sucesso como CLIENT e retornar token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUserRegular.email, password: testUserRegular.password })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toHaveProperty('email', testUserRegular.email);
      expect(response.body.user).toHaveProperty('name', testUserRegular.name);
      expect(response.body.user).toHaveProperty('role', testUserRegular.role);
      userToken = response.body.access_token;
    });
  });

  describe('/auth/logout (POST)', () => {
    it('deve retornar 401 sem token de autenticação', async () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('deve fazer logout com sucesso como ADMIN', async () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Logout successful');
        });
    });

    it('deve fazer logout com sucesso como CLIENT', async () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Logout successful');
        });
    });

    it('deve rejeitar acesso após logout como CLIENT', async () => {
      return request(app.getHttpServer()).post('/auth/logout').set('Authorization', `Bearer ${userToken}`).expect(401);
    });
  });
});
