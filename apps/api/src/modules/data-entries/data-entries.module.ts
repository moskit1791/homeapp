import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { DataEntriesController } from './data-entries.controller';
import { DataEntriesService } from './data-entries.service';

@Module({
  imports: [AuthModule, HouseholdsModule, PermissionsModule, UsersModule],
  controllers: [DataEntriesController],
  providers: [DataEntriesService],
  exports: [DataEntriesService]
})
export class DataEntriesModule {}
