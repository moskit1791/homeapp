import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [AuthModule, HouseholdsModule, NotificationsModule, PermissionsModule, UsersModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService]
})
export class CalendarModule {}
