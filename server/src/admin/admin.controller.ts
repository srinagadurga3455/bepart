import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard counts (ADMIN only)', description: 'Real counts: users, events, registrations.' })
  @ApiResponse({ status: 200, description: 'Dashboard counts' })
  dashboard() {
    return this.service.dashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users (ADMIN only)', description: 'All users without passwords.' })
  @ApiResponse({ status: 200, description: 'User list' })
  listUsers() {
    return this.service.listUsers();
  }

  @Get('events')
  @ApiOperation({ summary: 'List all events (ADMIN only)', description: 'All events with organizer and registration counts.' })
  @ApiResponse({ status: 200, description: 'Event list' })
  listEvents() {
    return this.service.listEvents();
  }

  @Post('admins')
  @ApiOperation({ summary: 'Create another ADMIN (ADMIN only)', description: 'ADMIN creates another ADMIN with login credentials + Admin profile (ACTIVE). Seeded first Admin is bootstrap.' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'ADMIN user + profile created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.service.createAdmin(dto);
  }
}
