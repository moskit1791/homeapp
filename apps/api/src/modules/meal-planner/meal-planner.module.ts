import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { MealPlannerController } from './meal-planner.controller';
import { MealPlannerService } from './meal-planner.service';

@Module({
  imports: [AuthModule, HouseholdsModule, PermissionsModule, UsersModule],
  controllers: [MealPlannerController],
  providers: [MealPlannerService],
  exports: [MealPlannerService]
})
export class MealPlannerModule {}
