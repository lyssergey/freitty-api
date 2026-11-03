import { Injectable, NotFoundException, type PipeTransform } from '@nestjs/common';

/** Upper-cased order number, e.g. `FR001383` or `DRAFT-003`. */
const ORDER_NUMBER = /^[A-Z0-9-]{1,32}$/;

/**
 * Normalizes the `:number` route param (case-insensitive: `fr001383` → `FR001383`).
 * Anything that cannot be an order number is a 404 before it reaches the database
 * (Postgres would fail on a NUL byte with a 500), and the raw input is not echoed.
 */
@Injectable()
export class ParseOrderNumberPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const number = value.trim().toUpperCase();
    if (!ORDER_NUMBER.test(number)) throw new NotFoundException('Order not found');
    return number;
  }
}
