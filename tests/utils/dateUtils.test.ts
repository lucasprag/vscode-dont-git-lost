import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDate } from '../../src/utils/dateUtils';
import * as configModule from '../../src/config';

vi.mock('../../src/config', () => ({
  readConfig: vi.fn(),
}));

describe('dateUtils - formatDate', () => {
  const mockEpoch = 1417000000;
  const mockTimezone = '-0300';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format date using commit timezone when dateTimezone is "commit"', () => {
    vi.spyOn(configModule, 'readConfig').mockReturnValue({
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      dateTimezone: 'commit',
    } as any);

    const result = formatDate(mockEpoch, mockTimezone);
    
    expect(result).toBe('2014-11-26 08:06:40');
  });

  it('should format date in UTC when dateTimezone is "utc"', () => {
    vi.spyOn(configModule, 'readConfig').mockReturnValue({
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      dateTimezone: 'utc',
    } as any);

    const result = formatDate(mockEpoch, mockTimezone);
    
    expect(result).toBe('2014-11-26 11:06:40');
  });

  it('should format date using current system local time when dateTimezone is "current"', () => {
    vi.spyOn(configModule, 'readConfig').mockReturnValue({
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      dateTimezone: 'current',
    } as any);

    const result = formatDate(mockEpoch, mockTimezone);
    
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('should respect custom dateFormat configuration', () => {
    vi.spyOn(configModule, 'readConfig').mockReturnValue({
      dateFormat: 'DD/MM/YYYY',
      dateTimezone: 'utc',
    } as any);

    const result = formatDate(mockEpoch, mockTimezone);
    
    expect(result).toBe('26/11/2014');
  });
});