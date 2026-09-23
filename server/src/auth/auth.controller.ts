import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
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
  @ApiOperation({ summary: 'Login (deprecated)', description: 'Password login disabled. Use OTP flow: POST /api/auth/request-otp and /api/auth/verify-otp' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 400, description: 'Password login disabled, use OTP' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP for ADMIN/ORGANIZER',
    description: 'Submit email or phone. OTP is logged to server console (development mock) and via WhatsappService mock. Expires in 5 minutes.',
  })
  @ApiBody({ type: RequestOtpDto, examples: { admin: { value: { email: 'admin@pravesh.local' } }, organizer: { value: { email: 'organizer@example.com' } } } })
  @ApiResponse({ status: 200, description: 'OTP sent (mock logged to console)' })
  @ApiResponse({ status: 401, description: 'User not found / deactivated / wrong role' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and receive JWT',
    description: 'Submit email/phone + 6-digit OTP. Returns JWT on success. OTP is single-use, 5 min expiry, max 5 attempts.',
  })
  @ApiBody({ type: VerifyOtpDto, examples: { admin: { value: { email: 'admin@pravesh.local', otp: '483921' } } } })
  @ApiResponse({ status: 200, description: 'Verified {user, accessToken}' })
  @ApiResponse({ status: 400, description: 'OTP expired/not found/too many attempts' })
  @ApiResponse({ status: 401, description: 'Invalid OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
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
