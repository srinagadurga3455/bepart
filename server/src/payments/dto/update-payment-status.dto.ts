import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PAID, description: 'Allowed: PENDING, PAID, FAILED' })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;
}
