import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export const CALENDAR_SCOPE_TYPES = ['household', 'member'] as const;

export type CalendarScopeType = (typeof CALENDAR_SCOPE_TYPES)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

export class CalendarDateRangeDto {
  @Matches(DATE_PATTERN)
  from!: string;

  @Matches(DATE_PATTERN)
  to!: string;
}

export class CalendarUpcomingDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 5;
}

export class CalendarEventIdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateCalendarEventDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @Matches(DATE_PATTERN)
  eventDate!: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  eventTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrenceRule?: string | null;

  @IsIn([...CALENDAR_SCOPE_TYPES])
  scopeType!: CalendarScopeType;

  @IsOptional()
  @IsUUID()
  ownerMemberId?: string | null;
}

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  eventDate?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  eventTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrenceRule?: string | null;

  @IsOptional()
  @IsIn([...CALENDAR_SCOPE_TYPES])
  scopeType?: CalendarScopeType;

  @IsOptional()
  @IsUUID()
  ownerMemberId?: string | null;
}
