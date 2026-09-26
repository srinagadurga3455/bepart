import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/;

export class CreateWithdrawalDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID, must belong to the organizer)' })
  @IsString()
  @IsUUID()
  eventId: string;

  @ApiProperty({ example: 2500000, description: 'Amount in paise (2500000 = ₹25,000.00). Must not exceed available balance.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'organizer@upi', description: 'UPI ID for payout. Defaults to the UPI ID on the organizer profile.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(UPI_ID_PATTERN, { message: 'upiId must be a valid UPI ID (e.g. name@bank)' })
  upiId?: string;
}
