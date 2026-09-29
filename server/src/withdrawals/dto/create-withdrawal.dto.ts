import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { IsEventId } from '../../common/validators/event-id.validator';
import { UPI_ID_REGEX, UPI_ID_MESSAGE } from '../../common/constants/validation';

/** @deprecated — use UPI_ID_REGEX from common/constants/validation instead. */
export const UPI_ID_PATTERN = UPI_ID_REGEX;

export class CreateWithdrawalDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID or legacy numeric ID, must belong to the organizer)' })
  @IsString()
  @IsEventId()
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
  @Matches(UPI_ID_REGEX, { message: UPI_ID_MESSAGE })
  upiId?: string;
}
