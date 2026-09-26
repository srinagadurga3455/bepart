import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/constants/roles';
import { RequestUser } from '../common/types/jwt-payload';

@ApiTags('coupons')
@ApiBearerAuth('JWT-auth')
@Controller('events/:eventId/coupons')
@Roles(Role.ORGANIZER, Role.ADMIN)
export class EventCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({ summary: 'Create coupon for own event (ORGANIZER) / any event (ADMIN)' })
  @ApiParam({ name: 'eventId', type: String, description: 'Event UUID' })
  @ApiBody({ type: CreateCouponDto })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiResponse({ status: 400, description: 'Invalid discount/dates/code' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateCouponDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.couponsService.create({ ...dto, eventId }, { userId: user.userId || user.id, role: user.role });
  }

  @Get()
  @ApiOperation({ summary: 'List coupons for own event (ORGANIZER) / any event (ADMIN)' })
  @ApiParam({ name: 'eventId', type: String })
  @ApiResponse({ status: 200, description: 'Coupon list' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  list(@Param('eventId', ParseUUIDPipe) eventId: string, @CurrentUser() user: RequestUser) {
    return this.couponsService.listForEvent(eventId, { userId: user.userId || user.id, role: user.role });
  }

  @Patch(':couponId')
  @ApiOperation({ summary: 'Update coupon (discount, active, dates, limit). Code/event are immutable.' })
  @ApiParam({ name: 'eventId', type: String })
  @ApiParam({ name: 'couponId', type: String, description: 'Coupon UUID' })
  @ApiBody({ type: UpdateCouponDto })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Coupon/event not found' })
  update(
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.couponsService.update(couponId, dto, { userId: user.userId || user.id, role: user.role });
  }

  @Delete(':couponId')
  @ApiOperation({ summary: 'Delete coupon. Past registrations keep their price snapshot.' })
  @ApiParam({ name: 'eventId', type: String })
  @ApiParam({ name: 'couponId', type: String })
  @ApiResponse({ status: 200, description: 'Coupon deleted' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Coupon/event not found' })
  remove(@Param('couponId', ParseUUIDPipe) couponId: string, @CurrentUser() user: RequestUser) {
    return this.couponsService.remove(couponId, { userId: user.userId || user.id, role: user.role });
  }
}
