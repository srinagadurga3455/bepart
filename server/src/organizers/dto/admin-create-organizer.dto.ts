import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminCreateOrganizerDto {
  @ApiProperty({ example: 'Tech Club', description: 'Organizer/club name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'organizer@example.com', description: 'Organizer login email (also organizer contact email)' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Organizer@123', description: 'Login password for organizer (min 8 chars, hashed via bcrypt)' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ example: 'Official tech club' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'techclub@upi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  upiId?: string;
}
