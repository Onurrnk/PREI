import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMeetingDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsDateString()
  date!: string;

  @IsOptional() @IsString() @MaxLength(20)
  durationLabel?: string;

  @IsOptional() @IsString() @MaxLength(120)
  client?: string;

  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @IsOptional() @IsIn(['In-person', 'Zoom'])
  platform?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional() @IsIn(['meeting', 'viewing', 'signing'])
  kind?: string;
}
