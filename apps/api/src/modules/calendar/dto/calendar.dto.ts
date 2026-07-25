import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
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
  locationName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  locationUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrenceRule?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  reminderOffsetMinutes?: number | null;

  @IsIn([...CALENDAR_SCOPE_TYPES])
  scopeType!: CalendarScopeType;

  @IsOptional()
  @IsUUID()
  ownerMemberId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  encryptedPayload?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
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
  locationName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  locationUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrenceRule?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  reminderOffsetMinutes?: number | null;

  @IsOptional()
  @IsIn([...CALENDAR_SCOPE_TYPES])
  scopeType?: CalendarScopeType;

  @IsOptional()
  @IsUUID()
  ownerMemberId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  encryptedPayload?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  encryptionVersion?: number;
}

export class GoogleCalendarEncryptedSyncItemDto {
  @IsString()
  @Length(1, 1024)
  googleEventId!: string;

  @IsOptional()
  @IsISO8601()
  googleUpdatedAt?: string | null;

  @Matches(DATE_PATTERN)
  eventDate!: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  eventTime?: string | null;

  @IsString()
  @Length(1, 50000)
  encryptedPayload!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  encryptionVersion!: number;
}

export class CommitGoogleCalendarEncryptedSyncDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GoogleCalendarEncryptedSyncItemDto)
  events!: GoogleCalendarEncryptedSyncItemDto[];

  @IsBoolean()
  finalize!: boolean;
}
