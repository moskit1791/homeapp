import {
  BadRequestException,
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
import { EncryptionService } from '../encryption/encryption.service';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateBudgetCategoryDto,
  CreateBudgetItemDto,
  CreateBudgetMonthDto,
  CreateExpenseDto,
  CreateFinanceDebtDto,
  CreateFinanceDebtPaymentDto,
  CreateFinanceSavingsAccountDto,
  CreateFinanceSavingsTransactionDto,
  FinanceBudgetItemIdParamDto,
  FinanceCategoryIdParamDto,
  FinanceDebtIdParamDto,
  FinanceExpenseIdParamDto,
  FinanceMemberIdParamDto,
  FinanceMonthIdParamDto,
  FinanceSavingsAccountIdParamDto,
  GenerateNextBudgetMonthDto,
  UpdateBudgetCategoryDto,
  UpdateBudgetItemDto,
  UpdateFinanceDebtDto,
  UpsertIncomeDto
} from './dto/finance.dto';
import { BudgetCategoriesService } from './services/budget-categories.service';
import { BudgetItemsService } from './services/budget-items.service';
import { BudgetMonthsService } from './services/budget-months.service';
import { ExpensesService } from './services/expenses.service';
import { FinanceDebtsService } from './services/finance-debts.service';
import { FinanceSavingsService } from './services/finance-savings.service';
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
    private readonly financeDebtsService: FinanceDebtsService,
    private readonly financeSavingsService: FinanceSavingsService,
    private readonly financeSummaryService: FinanceSummaryService,
    private readonly incomesService: IncomesService,
    private readonly encryptionService: EncryptionService
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
  async generateNextMonth(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: GenerateNextBudgetMonthDto = {}
  ) {
    const context = this.requireHousehold(household);
    await Promise.all(
      (dto.items ?? []).map((item) =>
        this.assertFinancePayload(context.householdId, item, item.budgetAmount !== undefined)
      )
    );
    const generated = await this.budgetMonthsService.generateNextMonth(context.householdId, dto);

    return this.financeSummaryService.getMonthDetail(context.householdId, generated.id);
  }

  @Post('months')
  @RequirePermission('finances', 'create')
  async createMonth(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateBudgetMonthDto
  ) {
    const created = await this.budgetMonthsService.createMonth(
      this.requireHousehold(household).householdId,
      dto
    );

    return this.financeSummaryService.getMonthDetail(
      this.requireHousehold(household).householdId,
      created.id
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
  async createCategory(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateBudgetCategoryDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);

    return this.budgetCategoriesService.createCategory(context.householdId, dto);
  }

  @Patch('categories/:id')
  @RequirePermission('finances', 'update')
  async updateCategory(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceCategoryIdParamDto,
    @Body() dto: UpdateBudgetCategoryDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, dto.name !== undefined);
    const category = await this.budgetCategoriesService.updateCategory(
      context.householdId,
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
  async createBudgetItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateBudgetItemDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);

    return this.budgetItemsService.createBudgetItem(context.householdId, dto);
  }

  @Patch('budget-items/:id')
  @RequirePermission('finances', 'update')
  async updateBudgetItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceBudgetItemIdParamDto,
    @Body() dto: UpdateBudgetItemDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(
      context.householdId,
      dto,
      dto.name !== undefined || dto.budgetAmount !== undefined
    );
    const item = await this.budgetItemsService.updateBudgetItem(
      context.householdId,
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
  async createExpense(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateExpenseDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);

    return this.expensesService.createExpense(context.householdId, dto);
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
  async upsertIncome(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceMemberIdParamDto,
    @Body() dto: UpsertIncomeDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);

    return this.incomesService.upsertCurrentIncome(context.householdId, params.memberId, dto);
  }

  @Get('debts')
  @RequirePermission('finances', 'read')
  listDebts(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.financeDebtsService.listDebts(this.requireHousehold(household).householdId, true);
  }

  @Post('debts')
  @RequirePermission('finances', 'create')
  async createDebt(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateFinanceDebtDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);

    return this.financeDebtsService.createDebt(context.householdId, dto);
  }

  @Post('debts/:id/payments')
  @RequirePermission('finances', 'update')
  async createDebtPayment(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceDebtIdParamDto,
    @Body() dto: CreateFinanceDebtPaymentDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);
    const debt = await this.financeDebtsService.createPayment(context.householdId, params.id, dto);

    if (!debt) {
      throw new NotFoundException('Finance debt not found');
    }

    return debt;
  }

  @Patch('debts/:id')
  @RequirePermission('finances', 'update')
  async updateDebt(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceDebtIdParamDto,
    @Body() dto: UpdateFinanceDebtDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(
      context.householdId,
      dto,
      dto.amount !== undefined ||
        dto.lenderName !== undefined ||
        dto.note !== undefined ||
        dto.purpose !== undefined
    );
    const debt = await this.financeDebtsService.updateDebt(context.householdId, params.id, dto);

    if (!debt) {
      throw new NotFoundException('Finance debt not found');
    }

    return debt;
  }

  @Delete('debts/:id')
  @RequirePermission('finances', 'delete')
  async deleteDebt(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceDebtIdParamDto
  ) {
    const deleted = await this.financeDebtsService.deleteDebt(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Finance debt not found');
    }

    return { ok: true };
  }

  @Get('savings')
  @RequirePermission('finances', 'read')
  listSavings(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.financeSavingsService.listAccounts(this.requireHousehold(household).householdId);
  }

  @Post('savings')
  @RequirePermission('finances', 'create')
  async createSavingsAccount(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateFinanceSavingsAccountDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);
    if (dto.amount > 0) {
      await this.assertFinancePayload(
        context.householdId,
        {
          encryptedPayload: dto.transactionEncryptedPayload,
          encryptionVersion: dto.encryptionVersion
        },
        true
      );
    }

    return this.financeSavingsService.createAccount(context.householdId, context.memberId, dto);
  }

  @Post('savings/:id/transactions')
  @RequirePermission('finances', 'update')
  async createSavingsTransaction(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceSavingsAccountIdParamDto,
    @Body() dto: CreateFinanceSavingsTransactionDto
  ) {
    const context = this.requireHousehold(household);
    await this.assertFinancePayload(context.householdId, dto, true);
    const account = await this.financeSavingsService.createTransaction(
      context.householdId,
      params.id,
      dto
    );

    if (!account) {
      throw new NotFoundException('Finance savings account not found');
    }

    return account;
  }

  @Delete('savings/:id')
  @RequirePermission('finances', 'delete')
  async deleteSavingsAccount(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: FinanceSavingsAccountIdParamDto
  ) {
    const deleted = await this.financeSavingsService.deleteAccount(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Finance savings account not found');
    }

    return { ok: true };
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }

  private async assertFinancePayload(
    householdId: string,
    dto: { encryptedPayload?: string; encryptionVersion?: number },
    requiredWhenEncrypted: boolean
  ): Promise<void> {
    const settings = await this.encryptionService.getSettings(householdId);
    const enabled = settings.enabledModules.includes('finances');
    const hasEnvelope = dto.encryptedPayload !== undefined || dto.encryptionVersion !== undefined;

    if (!enabled) {
      if (hasEnvelope) {
        throw new BadRequestException('Finance encryption is not enabled for this household');
      }

      return;
    }

    if (requiredWhenEncrypted && (!dto.encryptedPayload || dto.encryptionVersion === undefined)) {
      throw new BadRequestException('Finance content must be encrypted on the client');
    }

    if (hasEnvelope && (!dto.encryptedPayload || dto.encryptionVersion !== settings.keyVersion)) {
      throw new BadRequestException('Outdated or incomplete household encryption envelope');
    }
  }
}
