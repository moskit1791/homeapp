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
  CreateShoppingItemDto,
  ImportShoppingItemsWithAiDto,
  MoveShoppingItemDto,
  ShoppingItemIdParamDto,
  ShoppingListTypeParamDto,
  UpdateShoppingItemDto
} from './dto/shopping.dto';
import { ShoppingService } from './shopping.service';

@Controller('shopping-lists')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get()
  @RequirePermission('shopping', 'read')
  listShoppingLists(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.shoppingService.listShoppingLists(this.requireHousehold(household).householdId);
  }

  @Get('pantry/dashboard')
  @RequirePermission('shopping', 'read')
  pantryDashboard(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.shoppingService.getPantryDashboard(
      this.requireHousehold(household).householdId
    );
  }

  @Get(':type/items')
  @RequirePermission('shopping', 'read')
  listItems(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingListTypeParamDto
  ) {
    return this.shoppingService.listItems(
      this.requireHousehold(household).householdId,
      params.type
    );
  }

  @Post(':type/items/ai-import')
  @RequirePermission('shopping', 'create')
  importItemsWithAi(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingListTypeParamDto,
    @Body() dto: ImportShoppingItemsWithAiDto
  ) {
    return this.shoppingService.importItemsWithAi(
      this.requireHousehold(household).householdId,
      params.type,
      dto
    );
  }

  @Post(':type/items')
  @RequirePermission('shopping', 'create')
  createItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingListTypeParamDto,
    @Body() dto: CreateShoppingItemDto
  ) {
    return this.shoppingService.createItem(
      this.requireHousehold(household).householdId,
      params.type,
      dto
    );
  }

  @Patch('items/:id')
  @RequirePermission('shopping', 'update')
  async updateItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingItemIdParamDto,
    @Body() dto: UpdateShoppingItemDto
  ) {
    const item = await this.shoppingService.updateItem(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!item) {
      throw new NotFoundException('Shopping item not found');
    }

    return item;
  }

  @Delete('items/:id')
  @RequirePermission('shopping', 'delete')
  async deleteItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingItemIdParamDto
  ) {
    const deleted = await this.shoppingService.deleteItem(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!deleted) {
      throw new NotFoundException('Shopping item not found');
    }

    return { ok: true };
  }

  @Delete(':type/items')
  @RequirePermission('shopping', 'delete')
  clearList(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingListTypeParamDto
  ) {
    return this.shoppingService.clearList(
      this.requireHousehold(household).householdId,
      params.type
    );
  }

  @Post('items/:id/move')
  @RequirePermission('shopping', 'update')
  async moveItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingItemIdParamDto,
    @Body() dto: MoveShoppingItemDto
  ) {
    const item = await this.shoppingService.moveItem(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );

    if (!item) {
      throw new NotFoundException('Shopping item not found');
    }

    return item;
  }

  @Post('daily/move-unchecked-to-tomorrow')
  @RequirePermission('shopping', 'update')
  moveUncheckedToTomorrow(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.shoppingService.moveUncheckedToTomorrow(
      this.requireHousehold(household).householdId
    );
  }

  @Post('items/:id/check')
  @RequirePermission('shopping', 'update')
  async checkItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingItemIdParamDto
  ) {
    const item = await this.shoppingService.checkItem(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!item) {
      throw new NotFoundException('Shopping item not found');
    }

    return item;
  }

  @Post('items/:id/toggle')
  @RequirePermission('shopping', 'update')
  async toggleItem(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: ShoppingItemIdParamDto
  ) {
    const item = await this.shoppingService.toggleItem(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!item) {
      throw new NotFoundException('Shopping item not found');
    }

    return item;
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
