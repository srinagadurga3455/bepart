import { IsBoolean, IsEnum, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponDiscountType } from '@prisma/client';

export class EventCouponConfigDto {
  @ApiProperty({ example: true, description: 'YES = create a coupon for this event; NO = normal event without coupon' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ enum: CouponDiscountType, example: CouponDiscountType.PERCENTAGE, description: 'Required when enabled=true' })
  @ValidateIf((o) => o.enabled === true)
  @IsEnum(CouponDiscountType)
  discountType?: CouponDiscountType;

  @ApiPropertyOptional({ example: 20, description: 'Required when enabled=true. Percent 1-100, fixed = paise >= 1' })
  @ValidateIf((o) => o.enabled === true)
  @IsInt()
  @Min(1)
  discountValue?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}
