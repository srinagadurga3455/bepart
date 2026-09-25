import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequestUser } from '../common/types/jwt-payload';

@ApiTags('registrations')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly service: RegistrationsService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Register for published event (public)', description: 'Students do not need login — provide phone, eventId, formData. No JWT required. Validates slots, closingTime, duplicate phone.' })
  @ApiBody({ type: CreateRegistrationDto })
  @ApiResponse({ status: 201, description: 'Registration created' })
  @ApiResponse({ status: 400, description: 'Event not published / slots full / closingTime passed' })
  @ApiResponse({ status: 409, description: 'Duplicate phone for event' })
  create(@Body() dto: CreateRegistrationDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List registrations', description: 'ADMIN all, ORGANIZER own-events, STUDENT by phone (requires JWT for filtered view). Public can still create via POST without auth.' })
  @ApiResponse({ status: 200, description: 'Registration array' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.service.findAllForUser(user.userId || user.id, user.role);
  }

  @Public()
  @Get('ticket/:id')
  @ApiOperation({ summary: 'Public ticket lookup (no auth)', description: 'Retrieve ONE registration by ID for the shareable /ticket/:id page. No listing or search.' })
  @ApiParam({ name: 'id', description: 'registrationId (ticket ID)' })
  @ApiResponse({ status: 200, description: 'Registration with event + ticketUrl' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findTicket(@Param('id') id: string) {
    return this.service.findTicketById(id);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get registration detail' })
  @ApiParam({ name: 'id', description: 'registrationId' })
  @ApiResponse({ status: 200, description: 'Registration' })
  @ApiResponse({ status: 403, description: 'Not owner/organizer' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.findOne(id, user.userId || user.id, user.role);
  }

  @Post(':id/cancel')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel registration' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Registration cancelled' })
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.cancel(id, user.userId || user.id, user.role);
  }
}
