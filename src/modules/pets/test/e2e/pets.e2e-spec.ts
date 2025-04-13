import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../../users/schemas/user.schema';
import { Pet } from '../../schemas/pet.schema';
import { MongoMemoryModule, closeInMemoryMongoConnection } from '../../../../config/mongo-memory-server.module';
import { UserRole } from '../../../../common/enums/role..enum';
import { TestAppModule } from '../../../../config/test-app.module';

describe('PetsController (e2e)', () => {
  let app: INestApplication;
  let userModel: Model<User>;
  let petModel: Model<Pet>;
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let petId: string;

  const testUsers = {
    admin: {
      name: 'Admin User',
      email: 'admin@petclub.com',
      password: 'Admin@123',
      role: UserRole.ADMIN,
    },
    client: {
      name: 'Pet Owner',
      email: 'owner@petclub.com',
      password: 'Owner@123',
      role: UserRole.CLIENT,
    },
  };

  const createUserWithHashedPassword = async (userData: typeof testUsers.admin) => {
    return userModel.create({
      ...userData,
      password: await bcrypt.hash(userData.password, 10),
    });
  };

  const basePet = {
    name: 'Rex',
    species: 'Dog',
    breed: 'Golden Retriever',
    birthDate: new Date('2020-01-15'),
    weight: 30.5,
    owner: '',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [await MongoMemoryModule.forRoot(), TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    userModel = moduleFixture.get<Model<User>>(getModelToken('User'));
    petModel = moduleFixture.get<Model<Pet>>(getModelToken('Pet'));

    await userModel.deleteMany({});
    await petModel.deleteMany({});

    await app.init();

    const adminUser = await createUserWithHashedPassword(testUsers.admin);
    const regularUser = await createUserWithHashedPassword(testUsers.client);

    userId = regularUser._id.toString();
    basePet.owner = userId;

    const login = async (email: string, password: string) => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
      return res.body.access_token;
    };

    adminToken = await login(testUsers.admin.email, testUsers.admin.password);
    userToken = await login(testUsers.client.email, testUsers.client.password);
  });

  afterEach(async () => {
    await petModel.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
    await closeInMemoryMongoConnection();
  });

  describe('POST /pets', () => {
    it('retorna 401 sem autenticação', () => {
      return request(app.getHttpServer()).post('/pets').send(basePet).expect(401);
    });

    it('cria pet como cliente', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/pets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(basePet)
        .expect(201);

      expect(body.name).toBe(basePet.name);
      petId = body._id;
    });
  });

  describe('GET /pets', () => {
    it('retorna 401 sem token', () => {
      return request(app.getHttpServer()).get('/pets').expect(401);
    });

    it('retorna pets do cliente', async () => {
      await petModel.create({ ...basePet });
      const { body } = await request(app.getHttpServer())
        .get('/pets')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /pets/:id', () => {
    beforeEach(async () => {
      const pet = await petModel.create({ ...basePet });
      petId = pet._id.toString();
    });

    it('retorna 401 sem autenticação', () => {
      return request(app.getHttpServer()).get(`/pets/${petId}`).expect(401);
    });

    it('cliente acessa seu pet', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/pets/${petId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(body._id).toBe(petId);
    });

    it('admin acessa qualquer pet', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/pets/${petId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(body._id).toBe(petId);
    });
  });

  describe('PUT /pets/:id', () => {
    const update = { name: 'Rex Atualizado', weight: 31 };

    beforeEach(async () => {
      const pet = await petModel.create({ ...basePet });
      petId = pet._id.toString();
    });

    it('cliente atualiza seu pet', async () => {
      const { body } = await request(app.getHttpServer())
        .put(`/pets/${petId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(update)
        .expect(200);

      expect(body.name).toBe(update.name);
      expect(body.weight).toBe(update.weight);
    });
  });

  describe('DELETE /pets/:id', () => {
    it('admin deleta qualquer pet', async () => {
      const { body: newPet } = await request(app.getHttpServer())
        .post('/pets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...basePet, name: 'Para Deletar' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/pets/${newPet._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
