import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalendarModule } from '../calendar/calendar.module';
import { HouseholdsModule } from '../households/households.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { StartController } from './start.controller';
import { StartService } from './start.service';

@Module({
  imports: [AuthModule, CalendarModule, HouseholdsModule, PermissionsModule, UsersModule],
  controllers: [StartController],
  providers: [StartService],
  exports: [StartService]
})
export class StartModule {}
