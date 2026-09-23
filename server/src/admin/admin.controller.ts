import { Body, Controller, Post } from '@nestjs/common';
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
