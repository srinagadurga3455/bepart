import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizersService } from './organizers.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { AdminCreateOrganizerDto } from './dto/admin-create-organizer.dto';
import { UpdateOrganizerDto } from './dto/update-organizer.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles';
import { RequestUser } from '../common/types/jwt-payload';

@ApiTags('organizers')
@ApiBearerAuth('JWT-auth')
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Create organizer (ADMIN only)',
    description: 'ADMIN creates Organizer directly — creates User (role=ORGANIZER) + Organizer profile linked via adminId and set to APPROVED. OTP is generated and logged to server console (Whatsapp mock). Organizer logs in via POST /api/auth/verify-otp.',
  })
  @ApiBody({ type: AdminCreateOrganizerDto })
  @ApiResponse({ status: 201, description: 'Organizer + User created (APPROVED), OTP logged to console, organizer can verify OTP and manage events' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  @ApiResponse({ status: 409, description: 'Email already registered/used' })
  create(@Body() dto: AdminCreateOrganizerDto, @CurrentUser() user: RequestUser) {
    return this.organizersService.adminCreate(dto, user.userId || user.id);
  }

  @Get('me')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({ summary: 'Get my organizer profile' })
  @ApiResponse({ status: 200, description: 'Organizer profile' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findMy(@CurrentUser() user: RequestUser) {
    return this.organizersService.findMyOrganizer(user.userId || user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all organizers (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Organizer list with _count.events' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  findAll() {
    return this.organizersService.findAll();
  }

  @Get(':id/events')
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List events for an organizer (ADMIN)' })
  @ApiParam({ name: 'id', description: 'Organizer ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Paginated events {data, meta} for organizer' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  @ApiResponse({ status: 404, description: 'Organizer not found' })
  getOrganizerEvents(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.organizersService.getOrganizerEvents(id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organizer by ID (owner or ADMIN)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Organizer' })
  @ApiResponse({ status: 403, description: 'Not owner' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.organizersService.findOne(id, user.userId || user.id, user.role);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update organizer (ADMIN only)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateOrganizerDto })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizerDto, @CurrentUser() user: RequestUser) {
    return this.organizersService.update(id, dto, user.userId || user.id, user.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete organizer (ADMIN only)', description: 'Hard delete if no events; otherwise use deactivate. Only ADMIN.' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 409, description: 'Has events, use deactivate' })
  remove(@Param('id') id: string) {
    return this.organizersService.remove(id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate organizer (ADMIN only)', description: 'Soft deactivate: sets REJECTED and deactivates linked user (isActive=false)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Deactivated' })
  deactivate(@Param('id') id: string) {
    return this.organizersService.deactivate(id);
  }
}
