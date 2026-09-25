import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @ApiProperty({ example: 50000, description: 'Amount in paise (50000 = ₹500)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}
