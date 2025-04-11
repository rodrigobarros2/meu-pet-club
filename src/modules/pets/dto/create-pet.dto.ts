import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePetDto {
  @ApiProperty({
    description: 'Nome do pet',
    example: 'Rex',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Espécie do pet',
    example: 'Cachorro',
    required: false,
  })
  @IsString()
  @IsOptional()
  species?: string;

  @ApiProperty({
    description: 'Raça do pet',
    example: 'Labrador',
    required: false,
  })
  @IsString()
  @IsOptional()
  breed?: string;

  @ApiProperty({
    description: 'Idade do pet em anos',
    example: 3,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  age?: number;

  @ApiProperty({
    description: 'Peso do pet em kg',
    example: 15.5,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;
}
