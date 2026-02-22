import cron from 'node-cron';
import type { WASocket } from 'baileys';
import { config } from '../config/index.js';
import { sendReminders } from './jobs/sendReminders.js';
import pino from 'pino';

const logger = pino({ name: 'scheduler' });

export function startScheduler(sock: WASocket): void {
  const { reminderHour, reminderMinute, weeklySummaryDay } = config.scheduler;

  // Daily reminder at configured time
  const dailyCron = `${reminderMinute} ${reminderHour} * * *`;
  cron.schedule(dailyCron, async () => {
    logger.info('Running daily reminder job');
    await sendReminders(sock);
  });

  logger.info({ cron: dailyCron }, 'Daily reminder scheduled');

  // Weekly summary on configured day at 9:00 AM
  const weeklyCron = `0 9 * * ${weeklySummaryDay}`;
  cron.schedule(weeklyCron, async () => {
    logger.info('Running weekly summary job');
    await sendReminders(sock, { isWeeklySummary: true });
  });

  logger.info({ cron: weeklyCron }, 'Weekly summary scheduled');

  logger.info('Scheduler started');
}
