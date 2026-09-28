import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePendingPaymentDto } from './dto/create-pending-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';
import { Public } from '../common/decorators/public.decorator';
import { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Razorpay webhook handler', description: 'Public endpoint for Razorpay webhooks. Verifies x-razorpay-signature against the raw body. Handles order.paid, payment.captured and payment.failed.' })
  @ApiResponse({ status: 200, description: 'Webhook processed (or acknowledged for unhandled events)' })
  @ApiResponse({ status: 400, description: 'Invalid signature or payload' })
  async handleWebhook(@Req() req: Request, @Headers('x-razorpay-signature') signature: string | undefined) {
    const rawBody = (req as any).rawBody ?? req.body;
    if (!rawBody) throw new BadRequestException('Request body is required');
    if (!signature) throw new BadRequestException('Missing x-razorpay-signature header');
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Post('verify')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify Razorpay payment signature', description: 'Verifies HMAC_SHA256(razorpay_order_id|razorpay_payment_id) with the Razorpay key secret and marks the linked payment PAID.' })
  @ApiBody({ type: VerifyPaymentDto })
  @ApiResponse({ status: 200, description: 'Payment verified' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  @ApiResponse({ status: 404, description: 'Payment not found for Razorpay order' })
  verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(dto);
  }

  @Post('init')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Initiate payment for paid event (before registration)', description: 'Creates Payment with status PENDING for a paid event. Requires phone and eventId. No Registration created yet. Payment must become PAID before registration can be submitted.' })
  @ApiBody({ type: CreatePendingPaymentDto })
  @ApiResponse({ status: 201, description: 'Pending payment created' })
  @ApiResponse({ status: 400, description: 'Invalid amount or event not requiring payment' })
  @ApiResponse({ status: 409, description: 'Pending payment already exists' })
  initPayment(@Body() dto: CreatePendingPaymentDto, @CurrentUser() user: RequestUser) {
    return this.paymentsService.createPending(dto, user);
  }

  @Post('create/:registrationId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create payment with amount (authenticated)', description: 'Requires valid JWT. STUDENT can create payment only for own registration (verified via phone). Validates amount>0, prevents duplicate, creates PENDING. Returns 401 if JWT missing/invalid, 403 if ownership fails.' })
  @ApiParam({ name: 'registrationId', description: 'Registration ID' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({ status: 201, description: 'Payment created with PENDING status' })
  @ApiResponse({ status: 400, description: 'Invalid amount <=0' })
  @ApiResponse({ status: 401, description: 'Unauthorized - missing/invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your registration' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @ApiResponse({ status: 409, description: 'Payment already exists' })
  create(@Param('registrationId') registrationId: string, @Body() dto: CreatePaymentDto, @CurrentUser() user: RequestUser) {
    return this.paymentsService.create(registrationId, dto, user);
  }

  @Get('mine')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List my transactions', description: 'ORGANIZER sees payments for own events, ADMIN sees all. Used by the transactions page.' })
  @ApiResponse({ status: 200, description: 'Payment array with event/registration/coupon' })
  findMine(@CurrentUser() user: RequestUser) {
    return this.paymentsService.findMine(user.userId || user.id, user.role);
  }

  @Get('registration/:registrationId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get payment by registrationId', description: 'Returns payment associated with that registration (requires JWT)' })
  @ApiParam({ name: 'registrationId', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Payment details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  getByRegistrationId(@Param('registrationId') registrationId: string) {
    return this.paymentsService.getByRegistrationId(registrationId);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get payment by ID', description: 'Returns payment ID, registrationId, amount, status, createdAt, updatedAt (requires JWT)' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  getById(@Param('id') id: string) {
    return this.paymentsService.getById(id);
  }

  @Patch(':id/status')
  @Roles(Role.ORGANIZER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'ORGANIZER: update payment status', description: 'Only the organizer who owns the payment event can manually change status (e.g. confirm an offline collection). Synchronizes Registration.paymentStatus atomically via transaction. Allowed: PENDING, PAID, FAILED' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiBody({ type: UpdatePaymentStatusDto })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden: ORGANIZER only, own events' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto, @CurrentUser() user: RequestUser) {
    return this.paymentsService.updateStatus(id, dto, user);
  }
}
