import cron from 'node-cron';
import type { WASocket } from 'baileys';
import { config } from '../config/index.js';
import { sendReminders } from './jobs/sendReminders.js';
import pino from 'pino';

const logger = pino({ name: 'scheduler' });

export function startScheduler(sock: WASocket): void {
  const { reminderHour, reminderMinute, weeklySummaryDay } = config.scheduler;

  // TEST MODE: Run every minute (change back to dailyCron for production)
  const testCron = '* * * * *'; // Every minute
  const dailyCron = `${reminderMinute} ${reminderHour} * * *`;

  cron.schedule(testCron, async () => {
    logger.info('Running reminder job (TEST MODE - every minute)');
    await sendReminders(sock);
  });

  logger.info({ cron: testCron }, 'Reminder scheduled (TEST MODE)');

  // Weekly summary on configured day at 9:00 AM
  const weeklyCron = `0 9 * * ${weeklySummaryDay}`;
  cron.schedule(weeklyCron, async () => {
    logger.info('Running weekly summary job');
    await sendReminders(sock, { isWeeklySummary: true });
  });

  logger.info({ cron: weeklyCron }, 'Weekly summary scheduled');

  logger.info('Scheduler started');
}
