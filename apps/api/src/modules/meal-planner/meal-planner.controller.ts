import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
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
  CopyMealPlanDto,
  CreateMealIdeaDto,
  CreateMealPlanDto,
  MealIdeaIdParamDto,
  MealPlanIdParamDto,
  RandomizeMealPlanDto,
  UpdateMealIdeaDto,
  UpdateMealPlanDto
} from './dto/meal-planner.dto';
import { MealPlannerService } from './meal-planner.service';

@Controller()
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class MealPlannerController {
  constructor(private readonly mealPlannerService: MealPlannerService) {}

  @Get('meal-plans/current')
  @RequirePermission('meal_planner', 'read')
  getCurrentPlan(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.mealPlannerService.getCurrentPlan(this.requireHousehold(household).householdId);
  }

  @Get('meal-plans/history')
  @RequirePermission('meal_planner', 'read')
  listHistory(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.mealPlannerService.listHistory(this.requireHousehold(household).householdId);
  }

  @Post('meal-plans')
  @RequirePermission('meal_planner', 'create')
  createPlan(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateMealPlanDto
  ) {
    return this.mealPlannerService.createPlan(
      this.requireHousehold(household).householdId,
      dto
    );
  }

  @Patch('meal-plans/:id')
  @RequirePermission('meal_planner', 'update')
  async updatePlan(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: MealPlanIdParamDto,
    @Body() dto: UpdateMealPlanDto
  ) {
    const plan = await this.mealPlannerService.updatePlan(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }

    return plan;
  }

  @Post('meal-plans/:id/copy')
  @RequirePermission('meal_planner', 'create')
  async copyPlan(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: MealPlanIdParamDto,
    @Body() dto: CopyMealPlanDto
  ) {
    const plan = await this.mealPlannerService.copyPlan(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!plan) {
      throw new NotFoundException('Source meal plan not found');
    }

    return plan;
  }

  @Delete('meal-plans/:id')
  @RequirePermission('meal_planner', 'delete')
  async deletePlan(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: MealPlanIdParamDto
  ) {
    const deleted = await this.mealPlannerService.deletePlan(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Meal plan not found');
    }

    return { ok: true };
  }

  @Post('meal-plans/randomize')
  @RequirePermission('meal_planner', 'read')
  randomize(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: RandomizeMealPlanDto
  ) {
    return this.mealPlannerService.randomize(this.requireHousehold(household).householdId, dto);
  }

  @Get('meal-ideas')
  @RequirePermission('meal_planner', 'read')
  listIdeas(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.mealPlannerService.listIdeas(this.requireHousehold(household).householdId);
  }

  @Post('meal-ideas')
  @RequirePermission('meal_planner', 'create')
  createIdea(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateMealIdeaDto
  ) {
    return this.mealPlannerService.createIdea(
      this.requireHousehold(household).householdId,
      dto
    );
  }

  @Patch('meal-ideas/:id')
  @RequirePermission('meal_planner', 'update')
  async updateIdea(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: MealIdeaIdParamDto,
    @Body() dto: UpdateMealIdeaDto
  ) {
    const idea = await this.mealPlannerService.updateIdea(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!idea) {
      throw new NotFoundException('Meal idea not found');
    }

    return idea;
  }

  @Delete('meal-ideas/:id')
  @RequirePermission('meal_planner', 'delete')
  async deleteIdea(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: MealIdeaIdParamDto
  ) {
    const deleted = await this.mealPlannerService.deleteIdea(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Meal idea not found');
    }

    return { ok: true };
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
