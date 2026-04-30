import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { UsersModule } from '../users/users.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  imports: [AuthModule, HouseholdsModule, UsersModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
