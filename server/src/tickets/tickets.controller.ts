import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '../common/constants/roles';
import { RequestUser } from '../common/types/jwt-payload';

class TicketLookupDto {
  // Decorated so the global whitelist ValidationPipe keeps the `ticket`
  // property (undecorated, every validate/check-in call 400s with
  // "property ticket should not exist").
  @IsOptional()
  @IsString()
  ticket?: string;
}

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('my')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'My tickets (authenticated student)', description: 'Tickets for registrations matching the account phone. Requires JWT.' })
  @ApiResponse({ status: 200, description: 'Ticket array' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findMine(@CurrentUser() user: RequestUser) {
    return this.ticketsService.findMine(user.userId || user.id);
  }

  @Public()
  @Get(':ticketId')
  @ApiOperation({ summary: 'Public ticket lookup (no auth)', description: 'Ticket + participant + event basics for the student ticket page. Accepts ticket code, QR token, ticket URL, or legacy registration ID. Exposes no payment internals.' })
  @ApiParam({ name: 'ticketId', description: 'Ticket code, QR token, ticket URL, or registration ID' })
  @ApiResponse({ status: 200, description: 'Public ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findPublic(@Param('ticketId') ticketId: string) {
    return this.ticketsService.findPublicTicket(ticketId);
  }
}

@ApiTags('check-in')
@Controller('check-in')
export class CheckinController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('validate')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Validate a ticket without checking in', description: 'Accepts ticket code, QR token, or ticket URL. Ownership derives from the ticket event — never from client input.' })
  @ApiBody({ schema: { type: 'object', properties: { ticket: { type: 'string', example: 'Ticket code, QR token, or ticket URL' } }, required: ['ticket'] } })
  @ApiResponse({ status: 200, description: 'Participant + event + ticket details' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  validate(@Body() dto: TicketLookupDto, @CurrentUser() user: RequestUser) {
    return this.ticketsService.validate(dto?.ticket || '', {
      userId: user.userId || user.id,
      role: user.role,
    });
  }

  @Post()
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Check in a ticket', description: 'Duplicate scans return 409 with the original check-in time. Mirrors checkedInAt onto the registration.' })
  @ApiBody({ schema: { type: 'object', properties: { ticket: { type: 'string', example: 'Ticket code, QR token, or ticket URL' } }, required: ['ticket'] } })
  @ApiResponse({ status: 200, description: 'Checked in' })
  @ApiResponse({ status: 403, description: 'Not your event' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 409, description: 'Already checked in' })
  checkIn(@Body() dto: TicketLookupDto, @CurrentUser() user: RequestUser) {
    return this.ticketsService.checkIn(dto?.ticket || '', {
      userId: user.userId || user.id,
      role: user.role,
    });
  }
}
