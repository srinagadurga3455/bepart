import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
    description: 'ADMIN creates Organizer directly — creates User (role=ORGANIZER, hashed password) + Organizer profile linked via adminId and set to APPROVED. No approval step required. Organizer can then login via /api/auth/login and manage events.',
  })
  @ApiBody({ type: AdminCreateOrganizerDto })
  @ApiResponse({ status: 201, description: 'Organizer + User created (APPROVED), organizer can login and manage events' })
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
  @ApiResponse({ status: 200, description: 'Organizer list' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  findAll() {
    return this.organizersService.findAll();
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
