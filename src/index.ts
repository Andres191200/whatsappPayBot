import { startBot } from './bot/client.js';
import { startScheduler } from './scheduler/index.js';
import pino from 'pino';

const logger = pino({ name: 'main' });

async function main() {
  logger.info('Starting WhatsApp Pay bot...');

  try {
    // Start the WhatsApp bot
    const sock = await startBot();

    // Start the scheduler once connected
    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        startScheduler(sock);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Shutting down...');
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start bot');
    process.exit(1);
  }
}

main();
