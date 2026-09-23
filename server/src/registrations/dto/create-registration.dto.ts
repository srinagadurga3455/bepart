import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRegistrationDto {
  @ApiProperty({ example: '+91 9876543210', description: 'Phone for registration' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 1, description: 'Event ID (integer)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId: number;

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
}
