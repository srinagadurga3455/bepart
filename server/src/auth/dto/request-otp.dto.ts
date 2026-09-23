import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class RequestOtpDto {
  @ApiPropertyOptional({ example: 'admin@pravesh.local', description: 'Admin/Organizer email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'Admin/Organizer phone' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
