import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class PayWithdrawalDto {
  @ApiProperty({ example: 'UPI123456789', description: 'External UPI/bank transaction ID (required)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  transactionId: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/proofs/w1.png', description: 'Payment proof URL (optional if screenshot uploaded via confirm endpoint)' })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'proofUrl must be a valid URL' })
  @MaxLength(2048)
  proofUrl?: string;
}
