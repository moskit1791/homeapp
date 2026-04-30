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
  CleaningTaskIdParamDto,
  CompleteCleaningTaskDto,
  CreateCleaningTaskDto,
  UpdateCleaningTaskDto
} from './dto/cleaning.dto';
import { CleaningService } from './cleaning.service';

@Controller('cleaning')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class CleaningController {
  constructor(private readonly cleaningService: CleaningService) {}

  @Get()
  @RequirePermission('cleaning', 'read')
  listTasks(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.cleaningService.listTasks(this.requireHousehold(household).householdId);
  }

  @Post()
  @RequirePermission('cleaning', 'create')
  createTask(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateCleaningTaskDto
  ) {
    return this.cleaningService.createTask(this.requireHousehold(household).householdId, dto);
  }

  @Patch(':id')
  @RequirePermission('cleaning', 'update')
  async updateTask(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: CleaningTaskIdParamDto,
    @Body() dto: UpdateCleaningTaskDto
  ) {
    const task = await this.cleaningService.updateTask(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!task) {
      throw new NotFoundException('Cleaning task not found');
    }

    return task;
  }

  @Delete(':id')
  @RequirePermission('cleaning', 'delete')
  async deleteTask(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: CleaningTaskIdParamDto
  ) {
    const deleted = await this.cleaningService.deleteTask(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Cleaning task not found');
    }

    return { ok: true };
  }

  @Post(':id/complete')
  @RequirePermission('cleaning', 'update')
  async completeTask(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: CleaningTaskIdParamDto,
    @Body() dto: CompleteCleaningTaskDto
  ) {
    const context = this.requireHousehold(household);
    const task = await this.cleaningService.completeTask(
      context.householdId,
      context.memberId,
      params.id,
      dto
    );

    if (!task) {
      throw new NotFoundException('Cleaning task not found');
    }

    return task;
  }

  @Get(':id/history')
  @RequirePermission('cleaning', 'read')
  async listHistory(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: CleaningTaskIdParamDto
  ) {
    const history = await this.cleaningService.listHistory(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!history) {
      throw new NotFoundException('Cleaning task not found');
    }

    return history;
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
