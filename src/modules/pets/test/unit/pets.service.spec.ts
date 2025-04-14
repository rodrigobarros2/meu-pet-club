import { Test, TestingModule } from '@nestjs/testing';
import { PetsService } from '../../service/pets.service';
import { getModelToken } from '@nestjs/mongoose';
import { Pet, PetDocument } from '../../schemas/pet.schema';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../../../common/enums/role..enum';
import { RedisService } from '../../../../modules/redis/service/redis.service';

describe('PetsService', () => {
  let service: PetsService;
  let petModel: any;
  let redisService: any;

  const fakeOwnerId = new Types.ObjectId().toString();
  const fakePetId = new Types.ObjectId().toString();

  const fakePet = {
    _id: fakePetId,
    name: 'Rex',
    species: 'Dog',
    breed: 'Labrador',
    age: 3,
    weight: 15,
    description: 'Friendly dog',
    owner: fakeOwnerId,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        {
          provide: getModelToken(Pet.name),
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(true),
            delByPattern: jest.fn().mockResolvedValue(true),
          } as unknown as Model<PetDocument>,
        },
      ],
    }).compile();

    service = module.get<PetsService>(PetsService);
    redisService = module.get<RedisService>(RedisService);
    petModel = module.get(getModelToken(Pet.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar um pet, invalidar cache e retornar o pet salvo', async () => {
      const createPetDto = {
        name: 'Rex',
        species: 'Dog',
        breed: 'Labrador',
        age: 3,
        weight: 15,
        description: 'Friendly dog',
      };

      const mockConstructor = jest.fn().mockImplementation((doc) => ({
        ...doc,
        save: jest.fn().mockResolvedValue({ _id: fakePetId, ...doc, owner: fakeOwnerId }),
      }));

      service['petModel'] = mockConstructor as any;

      redisService.delByPattern.mockResolvedValue(undefined);

      const result = await service.create(createPetDto as any, fakeOwnerId);

      expect(result).toEqual({ _id: fakePetId, ...createPetDto, owner: fakeOwnerId });
      expect(redisService.del).toHaveBeenCalledWith(`pets:user:${fakeOwnerId}`);
      expect(redisService.del).toHaveBeenCalledWith('pets:all');
      expect(mockConstructor).toHaveBeenCalledWith({ ...createPetDto, owner: fakeOwnerId });
    });
  });

  describe('findAll', () => {
    it('deve retornar pets do cache se existirem', async () => {
      const cachedPets = [fakePet];
      jest.spyOn(redisService, 'get').mockResolvedValue(cachedPets);

      const result = await service.findAll(fakeOwnerId, UserRole.CLIENT);
      expect(result).toEqual(cachedPets);

      expect(redisService.get).toHaveBeenCalledWith(`pets:user:${fakeOwnerId}`);
    });

    it('deve buscar pets do banco, popular o owner e armazenar no cache (para CLIENT)', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([fakePet]),
      };
      petModel.find = jest.fn().mockReturnValue(findQuery);

      const result = await service.findAll(fakeOwnerId, UserRole.CLIENT);
      expect(petModel.find).toHaveBeenCalledWith({ owner: fakeOwnerId });
      expect(redisService.set).toHaveBeenCalledWith(`pets:user:${fakeOwnerId}`, [fakePet]);
      expect(result).toEqual([fakePet]);
    });

    it('deve buscar todos os pets para ADMIN e armazenar no cache', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([fakePet]),
      };
      petModel.find = jest.fn().mockReturnValue(findQuery);

      const result = await service.findAll(fakeOwnerId, UserRole.ADMIN);
      expect(petModel.find).toHaveBeenCalledWith();
      expect(redisService.set).toHaveBeenCalledWith('pets:all', [fakePet]);
      expect(result).toEqual([fakePet]);
    });
  });

  describe('findOne', () => {
    it('deve lançar BadRequestException para ID inválido', async () => {
      await expect(service.findOne('invalid', fakeOwnerId, UserRole.CLIENT)).rejects.toThrow(BadRequestException);
    });

    it('deve retornar pet do cache se disponível', async () => {
      const petFromCache = { ...fakePet };
      jest.spyOn(redisService, 'get').mockResolvedValue(petFromCache);

      const result = await service.findOne(fakePetId, fakeOwnerId, UserRole.CLIENT);
      expect(redisService.get).toHaveBeenCalledWith(`pet:${fakePetId}`);
      expect(result).toEqual(petFromCache);
    });

    it('deve buscar pet do banco e armazenar no cache se não houver cache', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...fakePet }),
      };
      petModel.findById = jest.fn().mockReturnValue(findQuery);

      const result = await service.findOne(fakePetId, fakeOwnerId, UserRole.CLIENT);
      expect(petModel.findById).toHaveBeenCalledWith(fakePetId);
      expect(redisService.set).toHaveBeenCalled();
      expect(result).toEqual(fakePet);
    });

    it('deve lançar NotFoundException se o pet não for encontrado', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      petModel.findById = jest.fn().mockReturnValue(findQuery);

      await expect(service.findOne(fakePetId, fakeOwnerId, UserRole.CLIENT)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Rex' };

    it('deve lançar BadRequestException para ID inválido', async () => {
      await expect(service.update('invalid', updateDto, fakeOwnerId, UserRole.CLIENT)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar NotFoundException se pet não for encontrado', async () => {
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      petModel.findById = jest.fn().mockReturnValue(findQuery);

      await expect(service.update(fakePetId, updateDto, fakeOwnerId, UserRole.CLIENT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve atualizar o pet quando as condições estiverem corretas', async () => {
      const updatedPet = { ...fakePet, ...updateDto };
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...fakePet, owner: fakeOwnerId }),
      };
      petModel.findById = jest.fn().mockReturnValue(findQuery);
      petModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedPet),
      });

      const result = await service.update(fakePetId, updateDto, fakeOwnerId, UserRole.CLIENT);
      expect(petModel.findByIdAndUpdate).toHaveBeenCalledWith(fakePetId, updateDto, { new: true });
      expect(redisService.del).toHaveBeenCalledWith(`pets:user:${fakeOwnerId}`);
      expect(redisService.del).toHaveBeenCalledWith('pets:all');
      expect(result).toEqual(updatedPet);
    });
  });

  describe('remove', () => {
    it('deve lançar BadRequestException para ID inválido', async () => {
      await expect(service.remove('invalid', fakeOwnerId, UserRole.CLIENT)).rejects.toThrow(BadRequestException);
    });

    it('deve lançar NotFoundException se pet não for encontrado', async () => {
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      petModel.findById = jest.fn().mockReturnValue(findQuery);

      await expect(service.remove(fakePetId, fakeOwnerId, UserRole.CLIENT)).rejects.toThrow(NotFoundException);
    });

    it('deve remover o pet e invalidar caches corretamente', async () => {
      const findQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...fakePet, owner: fakeOwnerId }),
      };
      petModel.findById = jest.fn().mockReturnValue(findQuery);
      petModel.findByIdAndDelete = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(fakePet),
      });

      const result = await service.remove(fakePetId, fakeOwnerId, UserRole.CLIENT);
      expect(petModel.findByIdAndDelete).toHaveBeenCalledWith(fakePetId);

      expect(redisService.del).toHaveBeenCalledWith(`pets:user:${fakeOwnerId}`);
      expect(redisService.del).toHaveBeenCalledWith('pets:all');

      expect(result).toEqual(fakePet);
    });
  });
});
