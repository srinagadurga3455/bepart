import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login', description: 'Admin and Organizer login to receive JWT. Students do not need login.' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login success {user, accessToken}' })
  @ApiResponse({ status: 401, description: 'Invalid credentials / deactivated' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user', description: 'Requires valid JWT (ADMIN/ORGANIZER)' })
  @ApiResponse({ status: 200, description: 'Current user without password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: RequestUser) {
    return this.authService.getMe(user.userId || user.id);
  }
}
