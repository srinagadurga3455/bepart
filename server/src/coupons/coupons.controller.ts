import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/update-coupon.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/constants/roles';
import { RequestUser } from '../common/types/jwt-payload';

@ApiTags('coupons')
@ApiBearerAuth('JWT-auth')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @ApiOperation({ summary: 'Generate coupon (ADMIN any event / ORGANIZER own event only)' })
  @ApiBody({ type: CreateCouponDto })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiResponse({ status: 403, description: 'Organizer does not own the event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  create(@Body() dto: CreateCouponDto, @CurrentUser() user: RequestUser) {
    return this.couponsService.create(dto, { userId: user.userId || user.id, role: user.role });
  }

  @Post('validate')
  @Roles(Role.STUDENT, Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({
    summary: 'Preview coupon price (no persistence)',
    description: 'Validates the code for the event and returns backend-calculated original/discount/total (paise). Used before payment.',
  })
  @ApiBody({ type: ValidateCouponDto })
  @ApiResponse({ status: 200, description: 'Price quote { originalAmount, discountAmount, totalAmount, coupon }' })
  @ApiResponse({ status: 400, description: 'Invalid/inactive/expired coupon or coupon not valid for event' })
  async validate(@Body() dto: ValidateCouponDto) {
    if (!dto.code || !dto.eventId || !dto.amount) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException('code, eventId and amount are required');
    }
    return this.couponsService.priceQuote(dto.code, dto.eventId, dto.amount);
  }
}
