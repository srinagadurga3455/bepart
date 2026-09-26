import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID, must belong to the organizer)' })
  @IsString()
  @IsUUID()
  eventId: string;

  @ApiProperty({ example: 23800, description: 'Amount in rupees (must not exceed available balance)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
