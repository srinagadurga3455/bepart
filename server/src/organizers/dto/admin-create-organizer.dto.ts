import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiProperty({ example: 'techclub@upi', description: 'UPI ID for settlements (required)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  upiId: string;
}
