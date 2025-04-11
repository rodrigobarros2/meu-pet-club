import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pet, PetDocument } from '../schemas/pet.schema';
import { CreatePetDto } from '../dto/create-pet.dto';
import { UpdatePetDto } from '../dto/update-pet.dto';
import { RedisService } from '../../redis/service/redis.service';
import { UserRole } from '../../../common/enums/role..enum';

@Injectable()
export class PetsService {
  constructor(
    @InjectModel(Pet.name) private petModel: Model<PetDocument>,
    private redisService: RedisService,
  ) {}

  async create(createPetDto: CreatePetDto, userId: string): Promise<Pet> {
    const createdPet = new this.petModel({
      ...createPetDto,
      owner: userId,
    });

    const savedPet = await createdPet.save();

    // Invalidar cache de listagem
    await this.redisService.delByPattern('pets:*');

    return savedPet;
  }

  async findAll(userId: string, role: string): Promise<Pet[]> {
    // Gerar chave de cache com base no papel e id do usuário
    const cacheKey = role === UserRole.ADMIN ? 'pets:all' : `pets:user:${userId}`;

    // Tentar obter resultados do cache
    const cachedPets = await this.redisService.get<Pet[]>(cacheKey);
    if (cachedPets) {
      return cachedPets;
    }

    // Se não há cache, buscar do banco de dados
    let pets: Pet[];

    if (role === UserRole.ADMIN) {
      pets = await this.petModel.find().populate('owner', 'name email').exec();
    } else {
      pets = await this.petModel.find({ owner: userId }).exec();
    }

    // Armazenar no cache
    await this.redisService.set(cacheKey, pets);

    return pets;
  }

  async findOne(id: string, userId: string, role: string): Promise<Pet> {
    // Gerar chave de cache
    const cacheKey = `pet:${id}`;

    // Tentar obter do cache
    const cachedPet = await this.redisService.get<Pet>(cacheKey);
    if (cachedPet) {
      // Ainda precisa verificar permissões mesmo para pets em cache
      if (
        role !== UserRole.ADMIN &&
        cachedPet.owner &&
        cachedPet.owner._id &&
        cachedPet.owner._id.toString() !== userId
      ) {
        throw new ForbiddenException('Você não tem permissão para acessar este pet');
      }
      return cachedPet;
    }

    // Se não há cache, buscar do banco de dados
    const pet = await this.petModel.findById(id).populate('owner', 'name email').exec();

    if (!pet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado`);
    }

    // Verificar permissões
    if (role !== UserRole.ADMIN && pet.owner && pet.owner._id && pet.owner._id.toString() !== userId) {
      throw new ForbiddenException('Você não tem permissão para acessar este pet');
    }

    // Armazenar no cache
    await this.redisService.set(cacheKey, pet);

    return pet;
  }

  async update(id: string, updatePetDto: UpdatePetDto, userId: string, role: string): Promise<Pet> {
    // Verificar primeiro se o pet existe e pertence ao usuário
    await this.findOne(id, userId, role);

    const updatedPet = await this.petModel.findByIdAndUpdate(id, updatePetDto, { new: true }).exec();

    if (!updatedPet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado`);
    }

    // Invalidar caches relacionados
    await this.redisService.del(`pet:${id}`);
    await this.redisService.delByPattern('pets:*');

    return updatedPet;
  }

  async remove(id: string, userId: string, role: string): Promise<Pet> {
    // Verificar primeiro se o pet existe e pertence ao usuário
    await this.findOne(id, userId, role);

    const deletedPet = await this.petModel.findByIdAndDelete(id).exec();

    if (!deletedPet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado`);
    }

    // Invalidar caches relacionados
    await this.redisService.del(`pet:${id}`);
    await this.redisService.delByPattern('pets:*');

    return deletedPet;
  }
}
