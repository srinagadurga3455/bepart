import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectWithdrawalDto {
  @ApiProperty({ example: 'Insufficient documentation', description: 'Reason for rejection (stored, visible to organizer)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
