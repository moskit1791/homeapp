import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { AnnualCostsController } from './annual-costs.controller';
import { AnnualCostsService } from './annual-costs.service';

@Module({
  imports: [AuthModule, HouseholdsModule, PermissionsModule, UsersModule],
  controllers: [AnnualCostsController],
  providers: [AnnualCostsService],
  exports: [AnnualCostsService]
})
export class AnnualCostsModule {}
