import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePendingPaymentDto } from './dto/create-pending-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'ADMIN: update payment status', description: 'Only ADMIN can manually change status. Synchronizes Registration.paymentStatus atomically via transaction. Allowed: PENDING, PAID, FAILED' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiBody({ type: UpdatePaymentStatusDto })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden: ADMIN only' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.paymentsService.updateStatus(id, dto);
  }
}
