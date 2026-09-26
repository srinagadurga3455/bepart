import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EventCouponConfigDto } from './event-coupon-config.dto';

export class CreateEventDto {
  @ApiProperty({ example: 'Tech Fest 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  eventName: string;

  @ApiPropertyOptional({ example: 'Annual campus tech festival' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z', description: 'Event date' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 100, description: 'Total slots' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slots: number;

  @ApiProperty({ example: '2026-09-30T18:00:00.000Z', description: 'Registration closing time' })
  @IsDateString()
  closingTime: string;

  @ApiPropertyOptional({
    description: 'Form structure JSON for registration (Google Form style)',
    example: {
      title: 'TechFest 2026 Registration',
      description: 'Register for TechFest 2026 events and competitions.',
      sections: [
        {
          id: 'personal_academic',
          title: 'Personal & Academic Details',
          fields: [
            { name: 'fullName', label: 'Full Name', type: 'text', required: true },
            { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
            { name: 'email', label: 'Email Address', type: 'email', required: true },
            { name: 'rollNo', label: 'Roll Number', type: 'text', required: true },
            { name: 'branch', label: 'Branch', type: 'dropdown', options: ['CSE', 'AI & DS', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'], required: true },
            { name: 'year', label: 'Year of Study', type: 'radio', options: ['1st Year', '2nd Year', '3rd Year', '4th Year'], required: true },
          ],
        },
        {
          id: 'events',
          title: 'Choose Events',
          fields: [
            { name: 'events', label: 'Which events do you want to participate in?', type: 'checkbox', options: ['Hackathon', 'Coding Competition', 'AI Challenge', 'Paper Presentation', 'Quiz'], required: true },
            { name: 'preferredEvent', label: 'Select your primary event', type: 'dropdown', options: ['Hackathon', 'Coding Competition', 'AI Challenge', 'Paper Presentation', 'Quiz'], required: true },
          ],
        },
        {
          id: 'team_confirmation',
          title: 'Team Details & Confirmation',
          fields: [
            { name: 'participationType', label: 'Participation Type', type: 'radio', options: ['Individual', 'Team'], required: true },
            { name: 'teamName', label: 'Team Name', type: 'text', required: false },
            { name: 'teamMembers', label: 'Team Members', type: 'textarea', required: false },
            { name: 'agree', label: 'I confirm that the information provided is correct.', type: 'checkbox', options: ['I Agree'], required: true },
          ],
        },
      ],
    },
  })
  @IsOptional()
  formStructure?: any;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether payment is required for this event',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  paymentRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Optional coupon: enabled=false (or omitted) = normal event. enabled=true = backend auto-generates a coupon code with your discount config.',
    example: { enabled: true, discountType: 'PERCENTAGE', discountValue: 20 },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EventCouponConfigDto)
  coupon?: EventCouponConfigDto;
}
