import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePendingPaymentDto {
  @ApiProperty({ example: 1, description: 'Event ID for paid event' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId: number;

  @ApiProperty({ example: '+91 9876543210', description: 'Phone for payment' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 50000, description: 'Amount in paise (50000 = ₹500)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Pending form data to be stored until payment is completed' })
  @IsOptional()
  pendingFormData?: any;
}
