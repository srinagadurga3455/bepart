import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePendingPaymentDto } from './dto/create-pending-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';

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

  // ========================================
  // RAZORPAY WEBHOOK
  // ========================================

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary: 'Razorpay Webhook Handler',
    description:
      'Public endpoint for Razorpay webhooks. Handles order.paid, payment.captured, and payment.failed events.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or payload',
  })
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    const rawBody = (req as any).rawBody || req.body;

    // ----------------------------------------
    // CHECK BODY
    // ----------------------------------------

    if (!rawBody) {
      throw new BadRequestException('Request body is required');
    }

    // ----------------------------------------
    // CHECK SIGNATURE
    // ----------------------------------------

    if (!signature) {
      throw new BadRequestException(
        'Missing x-razorpay-signature header',
      );
    }

    // ========================================
    // WEBHOOK DEBUG LOG
    // ========================================

    console.log('');
    console.log('========================================');
    console.log('🔔 RAZORPAY WEBHOOK RECEIVED');
    console.log('========================================');

    try {
      const webhookData =
        typeof rawBody === 'string'
          ? JSON.parse(rawBody)
          : rawBody;

      console.log('Event:', webhookData?.event);

      console.log(
        'Payment ID:',
        webhookData?.payload?.payment?.entity?.id || 'N/A',
      );

      console.log(
        'Order ID:',
        webhookData?.payload?.payment?.entity?.order_id ||
          webhookData?.payload?.order?.entity?.id ||
          'N/A',
      );

      console.log(
        'Payment Status:',
        webhookData?.payload?.payment?.entity?.status || 'N/A',
      );

      console.log('========================================');
      console.log('Processing webhook...');
      console.log('========================================');
      console.log('');
    } catch (error) {
      console.log('⚠️ Could not parse webhook body for logging');
    }

    // ========================================
    // SEND TO PAYMENT SERVICE
    // ========================================

    return this.paymentsService.handleWebhook(
      rawBody,
      signature,
    );
  }

  // ========================================
  // INITIALIZE PAYMENT
  // ========================================

  @Post('init')
  @Public()
  @ApiOperation({
    summary: 'Initiate payment for paid event (before registration)',
    description:
      'Public checkout endpoint. Creates Payment with status PENDING for a paid event. Requires phone and eventId. No Registration created yet. Payment must become PAID before registration can be submitted.',
  })
  @ApiBody({
    type: CreatePendingPaymentDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Pending payment created',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid amount or event not requiring payment',
  })
  @ApiResponse({
    status: 409,
    description: 'Pending payment already exists',
  })
  initPayment(
    @Body() dto: CreatePendingPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentsService.createPending(dto, user);
  }

  // ========================================
  // CREATE PAYMENT FOR REGISTRATION
  // ========================================

  @Post('create/:registrationId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create payment with amount (authenticated)',
    description:
      'Requires valid JWT. STUDENT can create payment only for own registration (verified via phone). Validates amount>0, prevents duplicate, creates PENDING.',
  })
  @ApiParam({
    name: 'registrationId',
    description: 'Registration ID',
  })
  @ApiBody({
    type: CreatePaymentDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Payment created with PENDING status',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid amount <=0',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing/invalid JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not your registration',
  })
  @ApiResponse({
    status: 404,
    description: 'Registration not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Payment already exists',
  })
  create(
    @Param('registrationId') registrationId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentsService.create(
      registrationId,
      dto,
      user,
    );
  }

  // ========================================
  // GET PAYMENT BY REGISTRATION
  // ========================================

  @Get('registration/:registrationId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get payment by registrationId',
    description:
      'Returns payment associated with that registration',
  })
  @ApiParam({
    name: 'registrationId',
    description: 'Registration ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  getByRegistrationId(
    @Param('registrationId') registrationId: string,
  ) {
    return this.paymentsService.getByRegistrationId(
      registrationId,
    );
  }

  // ========================================
  // GET PAYMENT BY ID
  // ========================================

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get payment by ID',
    description:
      'Returns payment ID, registrationId, amount, status, createdAt, updatedAt',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  getById(@Param('id') id: string) {
    return this.paymentsService.getById(id);
  }

  // ========================================
  // ADMIN UPDATE PAYMENT STATUS
  // ========================================

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'ADMIN: update payment status',
    description:
      'Only ADMIN can manually change status. Synchronizes Registration.paymentStatus atomically via transaction. Allowed: PENDING, PAID, FAILED',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment ID',
  })
  @ApiBody({
    type: UpdatePaymentStatusDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status updated',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: ADMIN only',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.updateStatus(id, dto);
  }
}