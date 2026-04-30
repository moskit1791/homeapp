import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { CurrentHousehold } from "../../shared/decorators/current-household.decorator";
import { HouseholdContext } from "../../shared/request-context";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { HouseholdContextGuard } from "../households/guards/household-context.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import {
  CreateTodoItemDto,
  ListTodoItemsQueryDto,
  TodoItemIdParamDto,
  UpdateTodoItemDto,
} from "./dto/todo.dto";
import { TodoService } from "./todo.service";

@Controller("todo-items")
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Get()
  @RequirePermission("todo", "read")
  listItems(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Query() query: ListTodoItemsQueryDto,
  ) {
    return this.todoService.listItems(
      this.requireHousehold(household).householdId,
      query.status,
    );
  }

  @Post()
  @RequirePermission("todo", "create")
  createItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateTodoItemDto,
  ) {
    return this.todoService.createItem(
      this.requireHousehold(household).householdId,
      dto,
    );
  }

  @Patch(":id")
  @RequirePermission("todo", "update")
  async updateItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: TodoItemIdParamDto,
    @Body() dto: UpdateTodoItemDto,
  ) {
    const item = await this.todoService.updateItem(
      this.requireHousehold(household).householdId,
      params.id,
      dto,
    );

    if (!item) {
      throw new NotFoundException("Todo item not found");
    }

    return item;
  }

  @Post(":id/done")
  @RequirePermission("todo", "update")
  async markDone(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: TodoItemIdParamDto,
  ) {
    const item = await this.todoService.setStatus(
      this.requireHousehold(household).householdId,
      params.id,
      "done",
    );

    if (!item) {
      throw new NotFoundException("Todo item not found");
    }

    return item;
  }

  @Post(":id/reopen")
  @RequirePermission("todo", "update")
  async reopen(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: TodoItemIdParamDto,
  ) {
    const item = await this.todoService.setStatus(
      this.requireHousehold(household).householdId,
      params.id,
      "todo",
    );

    if (!item) {
      throw new NotFoundException("Todo item not found");
    }

    return item;
  }

  @Delete(":id")
  @RequirePermission("todo", "delete")
  async deleteItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: TodoItemIdParamDto,
  ) {
    const deleted = await this.todoService.deleteItem(
      this.requireHousehold(household).householdId,
      params.id,
    );

    if (!deleted) {
      throw new NotFoundException("Todo item not found");
    }

    return { ok: true };
  }

  private requireHousehold(
    household: HouseholdContext | undefined,
  ): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException("Missing household context");
    }

    return household;
  }
}
