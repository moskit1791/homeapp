import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export const PUSH_PLATFORMS = ['android', 'ios', 'web', 'unknown'] as const;

export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export class RegisterPushTokenDto {
  @IsString()
  @Length(1, 300)
  expoPushToken!: string;

  @IsIn([...PUSH_PLATFORMS])
  platform!: PushPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}

export class SendTestPushDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  body?: string;
}
