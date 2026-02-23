import express from 'express';
import { config } from '../config/index.js';
import { oauthRouter } from './routes/oauth.js';
import { webhooksRouter } from './routes/webhooks.js';
import pino from 'pino';

const logger = pino({ name: 'server' });

const app = express();

// Parse JSON bodies for webhooks
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// OAuth routes
app.use('/oauth', oauthRouter);

// Webhook routes
app.use('/webhooks', webhooksRouter);

export function startServer(): void {
  const port = config.server.port;

  app.listen(port, () => {
    logger.info({ port, baseUrl: config.server.baseUrl }, 'Server started');
  });
}

export { app };
