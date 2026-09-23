import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Pravesh Admin 2', description: 'Admin display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'admin2@pravesh.local', description: 'Login email for new admin' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Admin@123', description: 'Password min 8 chars (hashed via bcrypt)' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: 'Pravesh HQ', description: 'Company/organization name for Admin profile' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  companyName: string;

  @ApiPropertyOptional({ example: 'Platform admin team' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
