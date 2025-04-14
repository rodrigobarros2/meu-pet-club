import { Test, TestingModule } from '@nestjs/testing';
import { PetsController } from '../../controller/pets.controller';
import { PetsService } from '../../service/pets.service';
import { CreatePetDto } from '../../dto/create-pet.dto';
import { UpdatePetDto } from '../../dto/update-pet.dto';
import { UserRole } from '../../../../common/enums/role..enum';

describe('PetsController', () => {
  let petsController: PetsController;
  let petsService: Partial<PetsService>;

  beforeEach(async () => {
    petsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PetsController],
      providers: [{ provide: PetsService, useValue: petsService }],
    }).compile();

    petsController = module.get<PetsController>(PetsController);
  });

  describe('create', () => {
    it('deve chamar petsService.create com os parâmetros corretos e retornar o resultado', async () => {
      const createPetDto: CreatePetDto = {
        name: 'Test Pet',
        species: 'Dog',
        breed: 'Labrador',
        age: 4,
        weight: 15,
        description: 'A friendly dog',
      };
      const req = { user: { userId: 'user-1', role: UserRole.CLIENT } };
      const result = { _id: 'pet-1', ...createPetDto, owner: req.user.userId };

      (petsService.create as jest.Mock).mockResolvedValue(result);

      const response = await petsController.create(createPetDto, req);
      expect(response).toEqual(result);
      expect(petsService.create).toHaveBeenCalledWith(createPetDto, req.user.userId);
    });
  });

  describe('findAll', () => {
    it('deve chamar petsService.findAll com os parâmetros corretos e retornar a lista de pets', async () => {
      const req = { user: { userId: 'user-1', role: UserRole.CLIENT } };
      const result = [{ _id: 'pet-1', name: 'Test Pet', owner: req.user.userId }];

      (petsService.findAll as jest.Mock).mockResolvedValue(result);

      const response = await petsController.findAll(req);
      expect(response).toEqual(result);
      expect(petsService.findAll).toHaveBeenCalledWith(req.user.userId, req.user.role);
    });
  });

  describe('findOne', () => {
    it('deve chamar petsService.findOne com os parâmetros corretos e retornar o pet encontrado', async () => {
      const req = { user: { userId: 'user-1', role: UserRole.CLIENT } };
      const petId = 'pet-1';
      const result = { _id: petId, name: 'Test Pet', owner: req.user.userId };

      (petsService.findOne as jest.Mock).mockResolvedValue(result);

      const response = await petsController.findOne(petId, req);
      expect(response).toEqual(result);
      expect(petsService.findOne).toHaveBeenCalledWith(petId, req.user.userId, req.user.role);
    });
  });

  describe('update', () => {
    it('deve chamar petsService.update com os parâmetros corretos e retornar o pet atualizado', async () => {
      const req = { user: { userId: 'user-1', role: UserRole.CLIENT } };
      const petId = 'pet-1';
      const updatePetDto: UpdatePetDto = { name: 'Updated Pet' };
      const result = { _id: petId, ...updatePetDto, owner: req.user.userId };

      (petsService.update as jest.Mock).mockResolvedValue(result);

      const response = await petsController.update(petId, updatePetDto, req);
      expect(response).toEqual(result);
      expect(petsService.update).toHaveBeenCalledWith(petId, updatePetDto, req.user.userId, req.user.role);
    });
  });

  describe('remove', () => {
    it('deve chamar petsService.remove com os parâmetros corretos e retornar o pet removido', async () => {
      const req = { user: { userId: 'user-1', role: UserRole.CLIENT } };
      const petId = 'pet-1';
      const result = { _id: petId, name: 'Test Pet' };

      (petsService.remove as jest.Mock).mockResolvedValue(result);

      const response = await petsController.remove(petId, req);
      expect(response).toEqual(result);
      expect(petsService.remove).toHaveBeenCalledWith(petId, req.user.userId, req.user.role);
    });
  });
});
