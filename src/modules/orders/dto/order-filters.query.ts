import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DatePreset } from '../../../common/time/periods.js';
import { OrderSegment, OrderStatus } from '../order.enums.js';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;
const upperCased = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Query params shared by the list, board and export (unknown params are rejected). */
export class OrderFiltersQuery {
  @IsOptional()
  @IsIn(Object.values(OrderSegment))
  segment: OrderSegment = OrderSegment.ALL;

  /** Hub code (case-insensitive), e.g. `MAR`. */
  @IsOptional()
  @Transform(upperCased)
  @IsString()
  @Matches(/^[A-Z0-9]{2,8}$/, { message: 'hub must be a hub code such as MAR' })
  hub?: string;

  @IsOptional()
  @IsIn(Object.values(DatePreset))
  period: DatePreset = DatePreset.LAST_30_DAYS;

  /** Search in order / sub-order numbers, refs, destination and carrier. */
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(64)
  q?: string;
}

export class ListOrdersQuery extends OrderFiltersQuery {
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 12;
}

/** The board shows every status side by side, so it takes no status and no paging. */
export class BoardOrdersQuery extends OrderFiltersQuery {}

export class ExportOrdersQuery extends OrderFiltersQuery {
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;
}
