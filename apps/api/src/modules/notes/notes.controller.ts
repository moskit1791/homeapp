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
  UseGuards,
} from "@nestjs/common";
import { CurrentHousehold } from "../../shared/decorators/current-household.decorator";
import { HouseholdContext } from "../../shared/request-context";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { HouseholdContextGuard } from "../households/guards/household-context.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { CreateNoteDto, NoteIdParamDto, UpdateNoteDto } from "./dto/notes.dto";
import { NotesService } from "./notes.service";

@Controller("notes")
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @RequirePermission("notes", "read")
  listNotes(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.notesService.listNotes(
      this.requireHousehold(household).householdId,
    );
  }

  @Post()
  @RequirePermission("notes", "create")
  createNote(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.createNote(
      this.requireHousehold(household).householdId,
      dto,
    );
  }

  @Patch(":id")
  @RequirePermission("notes", "update")
  async updateNote(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: NoteIdParamDto,
    @Body() dto: UpdateNoteDto,
  ) {
    const note = await this.notesService.updateNote(
      this.requireHousehold(household).householdId,
      params.id,
      dto,
    );

    if (!note) {
      throw new NotFoundException("Note not found");
    }

    return note;
  }

  @Delete(":id")
  @RequirePermission("notes", "delete")
  async deleteNote(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: NoteIdParamDto,
  ) {
    const deleted = await this.notesService.deleteNote(
      this.requireHousehold(household).householdId,
      params.id,
    );

    if (!deleted) {
      throw new NotFoundException("Note not found");
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
