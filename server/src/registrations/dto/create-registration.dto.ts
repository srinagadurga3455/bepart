import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRegistrationDto {
  @ApiProperty({ example: '+91 9876543210', description: 'Phone for registration' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID)' })
  @IsString()
  @IsUUID()
  eventId: string;

  @ApiPropertyOptional({
    example: {
      fullName: 'John Doe',
      phone: '+91 9876543210',
      email: 'john@example.com',
      rollNo: 'CS21-001',
      branch: 'CSE',
      year: '2nd Year',
      events: ['Hackathon', 'Coding Competition'],
      preferredEvent: 'Hackathon',
      participationType: 'Individual',
      teamName: '',
      teamMembers: '',
      agree: ['I Agree'],
    },
    description: 'Form data JSON validated against event formStructure (required + options checked)',
  })
  @IsOptional()
  formData?: any;

  @ApiPropertyOptional({ example: 50000, description: 'Amount in paise for paid events (required if paymentRequired=true)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  amount?: number;

  @ApiPropertyOptional({ example: 'AICLUB20', description: 'Optional coupon code. Backend validates it for the event and snapshots pricing. Invalid codes are rejected, never silently ignored.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  couponCode?: string;
}
