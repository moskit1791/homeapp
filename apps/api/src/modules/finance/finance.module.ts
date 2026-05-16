import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { UsersModule } from '../users/users.module';
import { FinanceController } from './finance.controller';
import { BudgetCategoriesService } from './services/budget-categories.service';
import { BudgetItemsService } from './services/budget-items.service';
import { BudgetMonthsService } from './services/budget-months.service';
import { ExpensesService } from './services/expenses.service';
import { FinanceDebtsService } from './services/finance-debts.service';
import { FinanceSummaryService } from './services/finance-summary.service';
import { FinanceSavingsService } from './services/finance-savings.service';
import { IncomesService } from './services/incomes.service';

const services = [
  BudgetMonthsService,
  BudgetCategoriesService,
  BudgetItemsService,
  ExpensesService,
  FinanceDebtsService,
  FinanceSavingsService,
  IncomesService,
  FinanceSummaryService
];

@Module({
  imports: [AuthModule, HouseholdsModule, PermissionsModule, UsersModule],
  controllers: [FinanceController],
  providers: services,
  exports: services
})
export class FinanceModule {}
