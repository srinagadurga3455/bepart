import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 3, description: 'Event ID (must belong to the organizer)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId: number;

  @ApiProperty({ example: 23800, description: 'Amount in rupees (must not exceed available balance)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
