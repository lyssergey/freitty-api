import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ActivityPeriod } from '../../../common/time/periods.js';

export class RecentOrdersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  limit = 4;
}

export class ActivityQuery {
  @IsOptional()
  @IsIn(Object.values(ActivityPeriod))
  period: ActivityPeriod = ActivityPeriod.MONTH;
}
