import { Router } from 'express';
import { handlePaymentNotification } from '../../services/mercadopago.service.js';
import pino from 'pino';

const logger = pino({ name: 'webhooks-router' });

export const webhooksRouter = Router();

/**
 * Mercado Pago webhook handler
 * Receives payment notifications
 */
webhooksRouter.post('/mercadopago', async (req, res) => {
  const { type, data } = req.body;

  logger.info({ type, data }, 'Received Mercado Pago webhook');

  // Acknowledge immediately (MP expects 200 within 500ms)
  res.sendStatus(200);

  try {
    if (type === 'payment') {
      const paymentId = data?.id;
      if (paymentId) {
        await handlePaymentNotification(paymentId.toString());
      }
    }
  } catch (error) {
    logger.error({ error, type, data }, 'Error processing webhook');
  }
});

/**
 * Webhook validation endpoint (MP sends GET to verify URL)
 */
webhooksRouter.get('/mercadopago', (_req, res) => {
  res.sendStatus(200);
});
