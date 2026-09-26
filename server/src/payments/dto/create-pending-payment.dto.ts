import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePendingPaymentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID) for paid event' })
  @IsString()
  @IsUUID()
  eventId: string;

  @ApiProperty({ example: '+91 9876543210', description: 'Phone for payment' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 50000, description: 'Amount in paise (50000 = ₹500) - original amount before discount, backend will calculate final' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'AICLUB20', description: 'Coupon code (case-insensitive). Backend validates and calculates the discount.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  couponCode?: string;
}
