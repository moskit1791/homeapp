import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  exports: [NotificationsService],
  imports: [DatabaseModule, AuthModule, HouseholdsModule],
  providers: [NotificationsService]
})
export class NotificationsModule {}
