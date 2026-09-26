import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Matches, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { CouponDiscountType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Event ID (UUID) the coupon belongs to' })
  @IsString()
  @IsUUID()
  eventId: string;

  @ApiPropertyOptional({
    example: 'AICLUB20',
    description: 'Custom coupon code (optional; auto-generated when omitted). Normalized to uppercase; lookup is case-insensitive.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_-]{3,32}$/, { message: 'code must be 3-32 chars: uppercase letters, digits, - or _ (e.g. AICLUB20)' })
  @MaxLength(32)
  code?: string;

  @ApiProperty({ enum: CouponDiscountType, example: CouponDiscountType.PERCENTAGE, description: 'Discount type' })
  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  @ApiProperty({ example: 20, description: 'Discount value: 20 for 20%, or paise for FIXED (e.g. 5000 = ₹50)' })
  @IsInt()
  @Min(1)
  discountValue: number;

  @ApiPropertyOptional({ example: true, default: true, description: 'Inactive coupons are rejected at validation' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z', description: 'Coupon becomes valid at this time (optional)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Expiry date (optional)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 100, description: 'Max number of redemptions (optional; single-use when omitted)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}
