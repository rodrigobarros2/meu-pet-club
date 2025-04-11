import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../common/enums/role..enum';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome do usuário',
    example: 'João Silva',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'joao@email.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: '123456',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Perfil do usuário',
    enum: UserRole,
    default: UserRole.CLIENT,
    example: UserRole.CLIENT,
  })
  @IsEnum(UserRole)
  role: UserRole;
}
