import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CouponDiscountType } from '@prisma/client';

// Update DTO intentionally does NOT extend PartialType(CreateCouponDto):
// eventId/code are immutable after creation (code is the snapshot key).
export class UpdateCouponDto {
  @ApiPropertyOptional({ enum: CouponDiscountType })
  @IsOptional()
  @IsEnum(CouponDiscountType)
  discountType?: CouponDiscountType;

  @ApiPropertyOptional({ example: 20, description: 'Discount value in rupees for FIXED, or percent 1-100 for PERCENTAGE' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  discountValue?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;
}

export class ValidateCouponDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({ example: 'AICLUB20' })
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: 500, description: 'Original ticket amount in rupees for a price preview' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
