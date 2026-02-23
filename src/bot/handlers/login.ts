import type { WASocket } from 'baileys';
import { generateOAuthUrl, hasLinkedAccount } from '../../services/mercadopago.service.js';
import { config } from '../../config/index.js';
import pino from 'pino';

const logger = pino({ name: 'login-handler' });

export async function handleLogin(
  sock: WASocket,
  groupJid: string,
  senderJid: string
): Promise<void> {
  // Check if MP is configured
  if (!config.mercadoPago.clientId || !config.mercadoPago.clientSecret) {
    await sock.sendMessage(groupJid, {
      text: '⚠️ Mercado Pago no está configurado. Contactá al administrador.',
    });
    return;
  }

  // Check if user already has linked account
  const isLinked = await hasLinkedAccount(senderJid);

  if (isLinked) {
    await sock.sendMessage(groupJid, {
      text: '✅ Ya tenés tu cuenta de Mercado Pago vinculada.\n\nSi querés desvincularla, contactá al administrador.',
    });
    return;
  }

  try {
    // Generate OAuth URL
    const authUrl = await generateOAuthUrl(senderJid, groupJid);

    logger.info({ senderJid, groupJid }, 'Generated OAuth URL for user');

    // Send login link privately to the user
    await sock.sendMessage(senderJid, {
      text: `🔗 *Vincular Mercado Pago*\n\nHacé click en el siguiente link para vincular tu cuenta:\n\n${authUrl}\n\n⏱️ Este link expira en 10 minutos.`,
    });

    // Confirm in group
    await sock.sendMessage(groupJid, {
      text: '📩 Te envié un mensaje privado con el link para vincular tu cuenta de Mercado Pago.',
      mentions: [senderJid],
    });
  } catch (error) {
    logger.error({ error, senderJid }, 'Error generating OAuth URL');
    await sock.sendMessage(groupJid, {
      text: '❌ Hubo un error. Por favor intentá de nuevo.',
    });
  }
}
