import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiPropertyOptional({ example: 'admin@pravesh.local' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: '483921', description: '6-digit OTP' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
