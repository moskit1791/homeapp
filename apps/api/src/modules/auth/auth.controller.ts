import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Query,
  Redirect,
  Post,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import {
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto
} from './dto/auth.dto';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';

@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  logout(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return this.authService.logout(authorization.slice('Bearer '.length).trim());
  }

  @Get('open/:action')
  @Redirect()
  openAuthLink(
    @Param('action') action: string,
    @Query('email') email?: string,
    @Query('token') token?: string
  ) {
    const safeAction = ['invitation', 'reset-password', 'verify-email'].includes(action)
      ? action
      : 'invitation';
    const url = new URL(`homeapp://auth/${safeAction}`);

    if (email) {
      url.searchParams.set('email', email);
    }

    if (token) {
      url.searchParams.set('token', token);
    }

    return { url: url.toString() };
  }

  @Delete('me')
  deleteAccount(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return this.authService.deleteAccount(authorization.slice('Bearer '.length).trim());
  }
}
