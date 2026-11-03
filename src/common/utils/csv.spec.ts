import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from './csv.js';
import { containsPattern } from './like.js';

describe('csvField (RFC 4180)', () => {
  it('leaves plain values unquoted', () => {
    expect(csvField('FR001383')).toBe('FR001383');
    expect(csvField('15 × Std + 12 × XL')).toBe('15 × Std + 12 × XL');
  });

  it('quotes fields with commas, quotes or line breaks and doubles quotes', () => {
    expect(csvField('Toronto, ON')).toBe('"Toronto, ON"');
    expect(csvField('Edge board 36"')).toBe('"Edge board 36"""');
    expect(csvField('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('writes empty fields for null and undefined, numbers as-is', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
    expect(csvField(42)).toBe('42');
    expect(csvField(-3)).toBe('-3');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvField('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvField('+1 647 555 0199')).toBe("'+1 647 555 0199");
    expect(csvField('-2+3')).toBe("'-2+3");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('\tcmd')).toBe("'\tcmd");
    expect(csvField('REF-1001')).toBe('REF-1001');
  });
});

describe('toCsv', () => {
  it('joins header and rows with CRLF and ends with a line break', () => {
    expect(
      toCsv(
        ['Order', 'Destination'],
        [
          ['FR1', 'Toronto, ON'],
          ['FR2', null],
        ],
      ),
    ).toBe('Order,Destination\r\nFR1,"Toronto, ON"\r\nFR2,\r\n');
  });
});

describe('containsPattern', () => {
  it('wraps the term and escapes LIKE wildcards', () => {
    expect(containsPattern('REF-1002')).toBe('%REF-1002%');
    expect(containsPattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});
