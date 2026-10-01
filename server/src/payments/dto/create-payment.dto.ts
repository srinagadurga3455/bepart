import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @ApiProperty({ example: 500, description: 'Amount in rupees (500 = ₹500, up to 2 decimals)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
