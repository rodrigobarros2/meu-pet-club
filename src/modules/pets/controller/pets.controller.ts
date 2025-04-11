import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { PetsService } from '../service/pets.service';
import { CreatePetDto } from '../dto/create-pet.dto';
import { UpdatePetDto } from '../dto/update-pet.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role..enum';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('pets')
@Controller('pets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  create(@Body() createPetDto: CreatePetDto, @Request() req) {
    return this.petsService.create(createPetDto, req.user.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  findAll(@Request() req) {
    return this.petsService.findAll(req.user.userId, req.user.role);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @ApiParam({ name: 'id', description: 'ID do pet' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.petsService.findOne(id, req.user.userId, req.user.role);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @ApiParam({ name: 'id', description: 'ID do pet' })
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto, @Request() req) {
    return this.petsService.update(id, updatePetDto, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.CLIENT)
  @ApiParam({ name: 'id', description: 'ID do pet' })
  remove(@Param('id') id: string, @Request() req) {
    return this.petsService.remove(id, req.user.userId, req.user.role);
  }
}
