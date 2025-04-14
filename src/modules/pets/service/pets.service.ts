import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
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

    await this.redisService.del(`pets:user:${userId}`);
    await this.redisService.del('pets:all');

    return savedPet;
  }

  async findAll(userId: string, role: string): Promise<Pet[]> {
    const cacheKey = role === UserRole.ADMIN ? 'pets:all' : `pets:user:${userId}`;

    const cachedPets = await this.redisService.get<Pet[]>(cacheKey);
    if (cachedPets) {
      return cachedPets;
    }

    let pets: Pet[];

    if (role === UserRole.ADMIN) {
      pets = await this.petModel.find().populate('owner', 'name email').exec();
    } else {
      pets = await this.petModel.find({ owner: userId }).populate('owner', 'name email').exec();
    }

    await this.redisService.set(cacheKey, pets);

    return pets;
  }

  async findOne(id: string, userId: string, role: string): Promise<Pet> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(`ID inválido: ${id} não é um ObjectId válido`);
    }

    const cacheKey = `pet:${id}`;

    const cachedPet = await this.redisService.get<Pet>(cacheKey);
    if (cachedPet) {
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

    const pet = await this.petModel.findById(id).populate('owner', 'name email').exec();

    if (!pet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado`);
    }

    if (role !== UserRole.ADMIN && pet.owner && pet.owner._id && pet.owner._id.toString() !== userId) {
      throw new ForbiddenException('Você não tem permissão para acessar este pet');
    }

    await this.redisService.set(cacheKey, pet);

    return pet;
  }

  async update(id: string, updatePetDto: UpdatePetDto, userId: string, role: string): Promise<Pet> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(`ID inválido: ${id} não é um ObjectId válido`);
    }

    const pet = await this.petModel.findById(id).populate('owner', '_id').exec();

    if (!pet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado`);
    }

    if (role !== UserRole.ADMIN && pet.owner && pet.owner._id && pet.owner._id.toString() !== userId) {
      throw new ForbiddenException('Você não tem permissão para atualizar este pet');
    }

    const updatedPet = await this.petModel.findByIdAndUpdate(id, updatePetDto, { new: true }).exec();

    if (!updatedPet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado para atualização`);
    }

    await this.redisService.del(`pets:user:${userId}`);
    await this.redisService.del('pets:all');

    return updatedPet;
  }

  async remove(id: string, userId: string, role: string): Promise<Pet> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(`ID inválido: ${id} não é um ObjectId válido`);
    }

    const pet = await this.petModel.findById(id).populate('owner', '_id').exec();

    if (!pet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado`);
    }

    if (role !== UserRole.ADMIN && pet.owner && pet.owner._id && pet.owner._id.toString() !== userId) {
      throw new ForbiddenException('Você não tem permissão para excluir este pet');
    }

    const deletedPet = await this.petModel.findByIdAndDelete(id).exec();

    if (!deletedPet) {
      throw new NotFoundException(`Pet com ID ${id} não encontrado para exclusão`);
    }

    await this.redisService.del(`pets:user:${userId}`);
    await this.redisService.del('pets:all');

    return deletedPet;
  }
}
