import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { CouponDiscountType } from '@prisma/client';

export class EventCouponConfigDto {
  @ApiProperty({ example: true, description: 'YES = create a coupon for this event; NO = normal event without coupon' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    example: 'FEST20',
    description: 'Custom coupon code (optional; auto-generated when omitted). Normalized to uppercase; lookup is case-insensitive.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_-]{3,32}$/, { message: 'code must be 3-32 chars: uppercase letters, digits, - or _ (e.g. FEST20)' })
  @MaxLength(32)
  code?: string;

  @ApiPropertyOptional({ enum: CouponDiscountType, example: CouponDiscountType.PERCENTAGE, description: 'Required when enabled=true' })
  @ValidateIf((o) => o.enabled === true)
  @IsEnum(CouponDiscountType)
  discountType?: CouponDiscountType;

  @ApiPropertyOptional({ example: 20, description: 'Required when enabled=true. Percent 1-100 for PERCENTAGE, rupees >= 0.01 for FIXED' })
  @ValidateIf((o) => o.enabled === true)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  discountValue?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'UTC ISO instant (the UI converts local IST input before sending)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'UTC ISO instant (the UI converts local IST input before sending)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}
