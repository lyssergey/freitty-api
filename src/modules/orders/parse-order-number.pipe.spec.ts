import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseOrderNumberPipe } from './parse-order-number.pipe.js';

describe('ParseOrderNumberPipe', () => {
  const pipe = new ParseOrderNumberPipe();

  it('trims and upper-cases order numbers', () => {
    expect(pipe.transform(' fr001383 ')).toBe('FR001383');
    expect(pipe.transform('draft-003')).toBe('DRAFT-003');
  });

  it('answers 404 without echoing anything that cannot be an order number', () => {
    for (const raw of ['\u0000', 'FR001383\u0000', 'NOPE%', '', ' ', 'FR 001383', 'A'.repeat(33)]) {
      expect(() => pipe.transform(raw)).toThrow(NotFoundException);
      expect(() => pipe.transform(raw)).toThrow(/^Order not found$/);
    }
  });
});
