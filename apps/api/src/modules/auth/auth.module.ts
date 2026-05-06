import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [MailModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimitGuard, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, UsersModule]
})
export class AuthModule {}
