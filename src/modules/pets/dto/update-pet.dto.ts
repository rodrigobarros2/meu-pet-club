import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePetDto {
  @ApiProperty({
    description: 'Nome do pet',
    example: 'Max',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

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
    example: 'Golden Retriever',
    required: false,
  })
  @IsString()
  @IsOptional()
  breed?: string;

  @ApiProperty({
    description: 'Idade do pet em anos',
    example: 4,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  age?: number;

  @ApiProperty({
    description: 'Peso do pet em kg',
    example: 18.2,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;

  @ApiProperty({
    description: 'Descrição adicional do pet',
    example: 'Dócil e brincalhão',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
