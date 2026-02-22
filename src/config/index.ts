import 'dotenv/config';

export const config = {
  database: {
    path: process.env.DATABASE_PATH || './data/whatsapp.db',
  },
  scheduler: {
    reminderHour: parseInt(process.env.REMINDER_HOUR || '10', 10),
    reminderMinute: parseInt(process.env.REMINDER_MINUTE || '0', 10),
    weeklySummaryDay: parseInt(process.env.WEEKLY_SUMMARY_DAY || '1', 10), // Monday
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  rateLimit: {
    messageDelay: parseInt(process.env.MESSAGE_DELAY || '1000', 10),
  },
} as const;
