import dayjs from 'dayjs';
import utcPlugin from 'dayjs/plugin/utc';
import timezonePlugin from 'dayjs/plugin/timezone';

import { readConfig } from '../config';

dayjs.extend(utcPlugin);
dayjs.extend(timezonePlugin);

export function formatDate(
  epoch: number,
  timezone: string
): string {
  const config = readConfig();
  const dateFormat = config.dateFormat;
  const dateTimezone = config.dateTimezone;

  let baseDate = dayjs(epoch * 1000);

  if (dateTimezone === 'utc' || timezone === '+0000') {
    baseDate = baseDate.utc();
  } else if (dateTimezone === 'commit') {
    baseDate = baseDate.tz(timezone);
  }

  return baseDate.format(dateFormat);
}