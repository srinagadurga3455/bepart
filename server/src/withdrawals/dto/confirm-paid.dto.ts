import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmPaidDto {
  @ApiProperty({ example: 'TXN123456789', description: 'UPI/bank transaction ID (required)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  transactionId: string;
}
