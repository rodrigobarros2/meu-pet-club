import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from '../service/users.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role..enum';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateUserDto } from '../dto/create-user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar um novo usuário cliente (Apenas Admin)' })
  async create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obter todos os usuários (Apenas Admin)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obter um usuário pelo ID (Apenas Admin)' })
  @ApiParam({ name: 'id', description: 'ID do usuário' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
