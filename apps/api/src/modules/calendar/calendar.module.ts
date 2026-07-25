import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { CalendarGoogleController } from './calendar-google.controller';
import { CalendarGoogleService } from './calendar-google.service';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [
    AuthModule,
    EncryptionModule,
    HouseholdsModule,
    NotificationsModule,
    PermissionsModule,
    UsersModule
  ],
  controllers: [CalendarController, CalendarGoogleController],
  providers: [CalendarService, CalendarGoogleService],
  exports: [CalendarService]
})
export class CalendarModule {}
