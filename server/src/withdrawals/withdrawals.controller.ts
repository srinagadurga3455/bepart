import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { PayWithdrawalDto } from './dto/pay-withdrawal.dto';
import { ConfirmPaidDto } from './dto/confirm-paid.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles';
import { RequestUser } from '../common/types/jwt-payload';

@ApiTags('withdrawals')
@ApiBearerAuth('JWT-auth')
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly service: WithdrawalsService) {}

  @Post()
  @Roles(Role.ORGANIZER)
  @ApiOperation({ summary: 'Request withdrawal (ORGANIZER)', description: 'Request withdrawal of collected fees for own event. Amount is in paise and must not exceed available balance; one open request per event. organizerId is derived from JWT, never the body.' })
  @ApiBody({ type: CreateWithdrawalDto })
  @ApiResponse({ status: 201, description: 'Withdrawal REQUESTED' })
  @ApiResponse({ status: 400, description: 'Invalid amount / free event / no revenue / exceeds balance / bad UPI ID' })
  @ApiResponse({ status: 403, description: 'Not owner / not approved organizer' })
  @ApiResponse({ status: 409, description: 'Open request already exists / concurrent request' })
  create(@Body() dto: CreateWithdrawalDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId || user.id);
  }

  @Get('mine')
  @Roles(Role.ORGANIZER)
  @ApiOperation({ summary: 'My withdrawals (ORGANIZER)', description: 'Own withdrawal/payment history' })
  findMine(@CurrentUser() user: RequestUser) {
    return this.service.findMine(user.userId || user.id);
  }

  @Get('admin/all')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'All withdrawal requests (ADMIN)', description: 'Every organizer withdrawal with organizer + event' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  findAllAdmin() {
    return this.service.findAll();
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'All withdrawal requests (ADMIN, legacy)', description: 'Alias of admin/all' })
  findAll() {
    return this.service.findAll();
  }

  @Get('admin/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Withdrawal detail (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Withdrawal ID (UUID)' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOneAdmin(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user.userId || user.id, Role.ADMIN);
  }

  @Get('event/:eventId')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({ summary: 'Withdrawals for an event (+ balance)', description: 'Organizers: own events only. Returns withdrawals plus revenue/reserved/paidOut/available balance in paise.' })
  @ApiParam({ name: 'eventId', description: 'Event ID (UUID)' })
  @ApiResponse({ status: 403, description: 'Not owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  findByEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findByEvent(eventId, user.userId || user.id, user.role);
  }

  @Get(':id')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({ summary: 'Withdrawal detail (owner or ADMIN)' })
  @ApiParam({ name: 'id', description: 'Withdrawal ID (UUID)' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user.userId || user.id, user.role);
  }

  @Get(':id/proof')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({ summary: 'Payment proof file (owner-if-PAID or ADMIN)', description: 'Streams the uploaded screenshot. Organizers only after PAID.' })
  @ApiParam({ name: 'id', description: 'Withdrawal ID' })
  async proof(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const proof = await this.service.proofContent(id, user.userId || user.id, user.role);
    if ('redirectUrl' in proof) {
      res.redirect(proof.redirectUrl);
      return;
    }
    res.set({ 'Content-Type': proof.mimetype, 'Content-Length': proof.buffer.length });
    res.send(proof.buffer);
  }

  @Patch(':id/process')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mark withdrawal PROCESSING (ADMIN)', description: 'Only REQUESTED → PROCESSING. All other transitions rejected.' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 400, description: 'Invalid transition (e.g. already PROCESSING/PAID/REJECTED)' })
  process(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.process(id);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject withdrawal (ADMIN)', description: 'REQUESTED/PROCESSING → REJECTED with stored reason. Releases the reserved amount. PAID can never be rejected.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: RejectWithdrawalDto })
  @ApiResponse({ status: 400, description: 'Missing reason / invalid transition' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectWithdrawalDto) {
    return this.service.reject(id, dto?.reason);
  }

  @Patch(':id/pay')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mark withdrawal PAID (ADMIN)', description: 'Only PROCESSING → PAID. Requires transactionId + proofUrl (use confirm endpoint for screenshot upload instead). Sets paidAt. Duplicate transaction IDs and double-pay rejected.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: PayWithdrawalDto })
  @ApiResponse({ status: 400, description: 'Missing transactionId/proof / invalid transition' })
  @ApiResponse({ status: 409, description: 'Duplicate transaction ID' })
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayWithdrawalDto) {
    return this.service.pay(id, dto?.transactionId, dto?.proofUrl);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('screenshot', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Confirm payment as PAID via screenshot (ADMIN)', description: 'Uploads screenshot to R2 proof storage and marks PROCESSING → PAID. Requires transactionId + screenshot (jpeg/png/webp, max 5 MB).' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    description: 'Transaction ID + screenshot (jpeg/png/webp, max 5 MB)',
    schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', example: 'TXN123456789' },
        screenshot: { type: 'string', format: 'binary' },
      },
      required: ['transactionId', 'screenshot'],
    },
  })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPaidDto,
    @UploadedFile() screenshot: Express.Multer.File,
  ) {
    return this.service.confirmPaid(id, dto?.transactionId, screenshot);
  }
}
