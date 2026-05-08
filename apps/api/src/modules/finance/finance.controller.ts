import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { HouseholdContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateBudgetCategoryDto,
  CreateBudgetItemDto,
  CreateExpenseDto,
  FinanceBudgetItemIdParamDto,
  FinanceCategoryIdParamDto,
  FinanceExpenseIdParamDto,
  FinanceMemberIdParamDto,
  FinanceMonthIdParamDto,
  UpdateBudgetCategoryDto,
  UpdateBudgetItemDto,
  UpsertIncomeDto
} from './dto/finance.dto';
import { BudgetCategoriesService } from './services/budget-categories.service';
import { BudgetItemsService } from './services/budget-items.service';
import { BudgetMonthsService } from './services/budget-months.service';
import { ExpensesService } from './services/expenses.service';
import { FinanceSummaryService } from './services/finance-summary.service';
import { IncomesService } from './services/incomes.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class FinanceController {
  constructor(
    private readonly budgetMonthsService: BudgetMonthsService,
    private readonly budgetCategoriesService: BudgetCategoriesService,
    private readonly budgetItemsService: BudgetItemsService,
    private readonly expensesService: ExpensesService,
    private readonly financeSummaryService: FinanceSummaryService,
    private readonly incomesService: IncomesService
  ) {}

  @Get('current-month')
  @RequirePermission('finances', 'read')
  getCurrentMonth(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.financeSummaryService.getCurrentMonthDetail(
      this.requireHousehold(household).householdId
    );
  }

  @Post('months/generate-next')
  @RequirePermission('finances', 'create')
  async generateNextMonth(@CurrentHousehold() household: HouseholdContext | undefined) {
    const generated = await this.budgetMonthsService.generateNextMonth(
      this.requireHousehold(household).householdId
    );

    return this.financeSummaryService.getMonthDetail(
      this.requireHousehold(household).householdId,
      generated.id
    );
  }

  @Get('months/archive')
  @RequirePermission('finances', 'read')
  listArchive(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.budgetMonthsService.listArchive(this.requireHousehold(household).householdId);
  }

  @Get('months/:id')
  @RequirePermission('finances', 'read')
  getMonth(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceMonthIdParamDto
  ) {
    return this.financeSummaryService.getMonthDetail(
      this.requireHousehold(household).householdId,
      params.id
    );
  }

  @Delete('months/:id')
  @RequirePermission('finances', 'delete')
  async deleteMonth(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceMonthIdParamDto
  ) {
    const deleted = await this.budgetMonthsService.deleteMonth(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Budget month not found');
    }

    return { ok: true };
  }

  @Get('months/:id/person-summary')
  @RequirePermission('finances', 'read')
  getPersonSummary(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceMonthIdParamDto
  ) {
    return this.financeSummaryService.getPersonSummary(
      this.requireHousehold(household).householdId,
      params.id
    );
  }

  @Get('categories')
  @RequirePermission('finances', 'read')
  listCategories(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.budgetCategoriesService.listCategories(
      this.requireHousehold(household).householdId
    );
  }

  @Post('categories')
  @RequirePermission('finances', 'create')
  createCategory(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateBudgetCategoryDto
  ) {
    return this.budgetCategoriesService.createCategory(
      this.requireHousehold(household).householdId,
      dto
    );
  }

  @Patch('categories/:id')
  @RequirePermission('finances', 'update')
  async updateCategory(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceCategoryIdParamDto,
    @Body() dto: UpdateBudgetCategoryDto
  ) {
    const category = await this.budgetCategoriesService.updateCategory(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!category) {
      throw new NotFoundException('Budget category not found');
    }

    return category;
  }

  @Post('budget-items')
  @RequirePermission('finances', 'create')
  createBudgetItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateBudgetItemDto
  ) {
    return this.budgetItemsService.createBudgetItem(
      this.requireHousehold(household).householdId,
      dto
    );
  }

  @Patch('budget-items/:id')
  @RequirePermission('finances', 'update')
  async updateBudgetItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceBudgetItemIdParamDto,
    @Body() dto: UpdateBudgetItemDto
  ) {
    const item = await this.budgetItemsService.updateBudgetItem(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!item) {
      throw new NotFoundException('Budget item not found');
    }

    return item;
  }

  @Delete('budget-items/:id')
  @RequirePermission('finances', 'delete')
  async deleteBudgetItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceBudgetItemIdParamDto
  ) {
    const deleted = await this.budgetItemsService.deleteBudgetItem(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Budget item not found');
    }

    return { ok: true };
  }

  @Post('expenses')
  @RequirePermission('finances', 'create')
  createExpense(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateExpenseDto
  ) {
    return this.expensesService.createExpense(this.requireHousehold(household).householdId, dto);
  }

  @Delete('expenses/:id')
  @RequirePermission('finances', 'delete')
  async deleteExpense(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceExpenseIdParamDto
  ) {
    const deleted = await this.expensesService.deleteExpense(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Expense not found');
    }

    return { ok: true };
  }

  @Put('incomes/:memberId')
  @RequirePermission('finances', 'update')
  upsertIncome(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceMemberIdParamDto,
    @Body() dto: UpsertIncomeDto
  ) {
    return this.incomesService.upsertCurrentIncome(
      this.requireHousehold(household).householdId,
      params.memberId,
      dto
    );
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
