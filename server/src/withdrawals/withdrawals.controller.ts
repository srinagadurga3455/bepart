import { Body, Controller, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
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
  @ApiOperation({ summary: 'Request withdrawal (ORGANIZER)', description: 'Request withdrawal of collected fees for own event. Amount must not exceed available balance; one open request per event.' })
  @ApiBody({ type: CreateWithdrawalDto })
  @ApiResponse({ status: 201, description: 'Withdrawal REQUESTED' })
  @ApiResponse({ status: 400, description: 'Invalid amount / no fee / exceeds balance' })
  @ApiResponse({ status: 403, description: 'Not owner' })
  @ApiResponse({ status: 409, description: 'Open request already exists' })
  create(@Body() dto: CreateWithdrawalDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId || user.id);
  }

  @Get('mine')
  @Roles(Role.ORGANIZER)
  @ApiOperation({ summary: 'My withdrawals (ORGANIZER)', description: 'Own withdrawal/payment history' })
  findMine(@CurrentUser() user: RequestUser) {
    return this.service.findMine(user.userId || user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'All withdrawal requests (ADMIN)', description: 'Every organizer withdrawal with organizer + event' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({ summary: 'Withdrawal detail (owner or ADMIN)' })
  @ApiParam({ name: 'id', description: 'Withdrawal ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user.userId || user.id, user.role);
  }

  @Get(':id/proof')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({ summary: 'Payment proof file (owner-if-PAID or ADMIN)', description: 'Streams the uploaded screenshot. Organizers only after PAID.' })
  @ApiParam({ name: 'id', description: 'Withdrawal ID' })
  async proof(@Param('id') id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
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
  @ApiOperation({ summary: 'Mark withdrawal PROCESSING (ADMIN)' })
  @ApiParam({ name: 'id' })
  process(@Param('id') id: string) {
    return this.service.process(id);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject withdrawal (ADMIN)' })
  @ApiParam({ name: 'id' })
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('screenshot', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Confirm payment as PAID (ADMIN)', description: 'Requires transactionId + payment screenshot. No auto-success, no gateway.' })
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
    @Param('id') id: string,
    @Body() dto: ConfirmPaidDto,
    @UploadedFile() screenshot: Express.Multer.File,
  ) {
    return this.service.confirmPaid(id, dto?.transactionId, screenshot);
  }
}
