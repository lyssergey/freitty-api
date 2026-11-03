import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { BoardOrdersQuery, ExportOrdersQuery, ListOrdersQuery } from './dto/order-filters.query.js';
import type { OrderBoardResponse, OrderDetail, OrderListResponse } from './order.types.js';
import { OrdersService } from './orders.service.js';
import { ParseOrderNumberPipe } from './parse-order-number.pipe.js';

/** Excel only reads a CSV as UTF-8 ("Montréal", "×") when it starts with a BOM. */
const UTF8_BOM = '\uFEFF';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListOrdersQuery): Promise<OrderListResponse> {
    return this.orders.list(user, query);
  }

  // Static routes are declared before `:number` so they are not taken for order numbers.
  @Get('board')
  board(
    @CurrentUser() user: AuthUser,
    @Query() query: BoardOrdersQuery,
  ): Promise<OrderBoardResponse> {
    return this.orders.board(user, query);
  }

  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: ExportOrdersQuery,
  ): Promise<StreamableFile> {
    const { filename, csv } = await this.orders.exportCsv(user, query);
    return new StreamableFile(Buffer.from(UTF8_BOM + csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /** Order numbers are case-insensitive (`fr001383` → `FR001383`). */
  @Get(':number')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('number', ParseOrderNumberPipe) number: string,
  ): Promise<OrderDetail> {
    return this.orders.detail(user, number);
  }
}
