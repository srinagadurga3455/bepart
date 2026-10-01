import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEventId } from '../../common/validators/event-id.validator';

export class CreateRegistrationDto {
  @ApiProperty({ example: '+91 9876543210', description: 'Phone for registration' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID, or legacy numeric ID)' })
  @IsString()
  @IsEventId()
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

  @ApiPropertyOptional({ example: 500, description: 'Amount in rupees for paid events (e.g. 500 = ₹500). Informational: paid registration is fulfilled from the PAID payment, not this field.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: 'AICLUB20', description: 'Optional coupon code. Backend validates it for the event and snapshots pricing. Invalid codes are rejected, never silently ignored.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  couponCode?: string;
}
