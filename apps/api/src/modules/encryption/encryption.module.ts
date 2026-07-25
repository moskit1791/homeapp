import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EncryptionController } from './encryption.controller';
import { EncryptionService } from './encryption.service';
import { EncryptionWriteInterceptor } from './encryption-write.interceptor';

@Module({
  imports: [AuthModule, HouseholdsModule, RealtimeModule],
  controllers: [EncryptionController],
  exports: [EncryptionService, EncryptionWriteInterceptor],
  providers: [EncryptionService, EncryptionWriteInterceptor]
})
export class EncryptionModule {}
