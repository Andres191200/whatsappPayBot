import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  makeCacheableSignalKeyStore,
} from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from '../config/index.js';
import { handleMessage } from './handlers/index.js';

const logger = pino({ level: config.logging.level });

let sock: WASocket | null = null;

export function getSocket(): WASocket | null {
  return sock;
}

export async function startBot(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState('./auth/session');

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR code received, scan it with your WhatsApp app:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.info({ statusCode, shouldReconnect }, 'Connection closed');

      if (shouldReconnect) {
        logger.info('Reconnecting...');
        startBot();
      } else {
        logger.info('Logged out. Delete auth/session folder and restart to re-authenticate.');
      }
    } else if (connection === 'open') {
      logger.info('Bot connected successfully!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Skip non-message events
      if (!msg.message) continue;

      try {
        await handleMessage(sock!, msg);
      } catch (error) {
        logger.error({ error, messageId: msg.key.id }, 'Error handling message');
      }
    }
  });

  return sock;
}
