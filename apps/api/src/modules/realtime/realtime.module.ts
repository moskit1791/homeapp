import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersModule } from '../users/users.module';
import { RequestContextModule } from '../../shared/request-context.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  imports: [AuthModule, DatabaseModule, HouseholdsModule, UsersModule, RequestContextModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, NotificationsService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
