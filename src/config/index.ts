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
  server: {
    port: parseInt(process.env.SERVER_PORT || '3000', 10),
    baseUrl: process.env.SERVER_BASE_URL || 'http://localhost:3000',
  },
  mercadoPago: {
    clientId: process.env.MP_CLIENT_ID || '',
    clientSecret: process.env.MP_CLIENT_SECRET || '',
    redirectUri: process.env.MP_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
  },
} as const;
