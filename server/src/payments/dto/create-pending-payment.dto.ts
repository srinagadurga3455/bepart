import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEventId } from '../../common/validators/event-id.validator';

export class CreatePendingPaymentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID, or legacy numeric ID) for paid event' })
  @IsString()
  @IsEventId()
  eventId: string;

  @ApiProperty({ example: '+91 9876543210', description: 'Phone for payment' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 500, description: 'Amount in rupees (500 = ₹500, up to 2 decimals) - original ticket price before discount, backend calculates the final payable amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'AICLUB20', description: 'Coupon code (case-insensitive). Backend validates and calculates the discount.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  couponCode?: string;

  @ApiPropertyOptional({ description: 'Pending form data stored until payment completes (used to create Registration on PAID)' })
  @IsOptional()
  pendingFormData?: any;

  @ApiPropertyOptional({ description: 'Frontend alias for pendingFormData: participant registration answers. Stored as pendingFormData so organizer confirmation (PAID) creates the Registration atomically.' })
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}
