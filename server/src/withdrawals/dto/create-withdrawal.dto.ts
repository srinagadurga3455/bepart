import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { IsEventId } from '../../common/validators/event-id.validator';

export const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/;

export class CreateWithdrawalDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID, or legacy numeric ID for pre-migration events; must belong to the organizer)' })
  @IsString()
  @IsEventId()
  eventId: string;

  @ApiProperty({ example: 25000, description: 'Amount in rupees (25000 = ₹25,000.00, up to 2 decimals). Must not exceed available balance.' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'organizer@upi', description: 'UPI ID for payout. Defaults to the UPI ID on the organizer profile.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(UPI_ID_PATTERN, { message: 'upiId must be a valid UPI ID (e.g. name@bank)' })
  upiId?: string;
}
