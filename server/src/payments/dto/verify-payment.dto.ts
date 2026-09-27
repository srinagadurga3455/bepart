import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ example: 'order_R123456789', description: 'Razorpay order ID' })
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @ApiProperty({ example: 'pay_R123456789', description: 'Razorpay payment ID' })
  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @ApiProperty({ example: 'a1b2c3...', description: 'HMAC_SHA256(order_id|payment_id) with Razorpay key secret' })
  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;
}
