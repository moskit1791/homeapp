import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { HouseholdContextGuard } from './guards/household-context.guard';
import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';

@Module({
  imports: [AuthModule, PermissionsModule, UsersModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService, HouseholdContextGuard],
  exports: [HouseholdsService, HouseholdContextGuard]
})
export class HouseholdsModule {}
