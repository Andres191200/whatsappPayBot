import type { WASocket, WAMessage } from 'baileys';
import { handlePayme } from './payme.js';
import { handlePaid } from './paid.js';
import { handleStatus } from './status.js';
import { extractMessageText, extractMentions } from '../utils/parser.js';
import { isGroupMessage } from '../utils/validator.js';
import { formatUsage } from '../utils/formatter.js';
import pino from 'pino';

const logger = pino({ name: 'message-handler' });

export async function handleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  // Only process group messages
  if (!isGroupMessage(jid)) {
    return;
  }

  const text = extractMessageText(msg.message);
  if (!text) return;

  // Check if it's a command
  if (!text.startsWith('/')) return;

  const mentions = extractMentions(msg.message);
  const senderPhone = msg.key.participant?.replace('@s.whatsapp.net', '') || '';

  if (!senderPhone) {
    logger.warn({ messageId: msg.key.id }, 'Could not determine sender phone');
    return;
  }

  const command = text.split(' ')[0].toLowerCase();

  logger.info({ command, groupJid: jid, senderPhone }, 'Processing command');

  switch (command) {
    case '/payme':
      await handlePayme(sock, jid, senderPhone, text, mentions);
      break;
    case '/paid':
      await handlePaid(sock, jid, senderPhone, text, mentions);
      break;
    case '/status':
      await handleStatus(sock, jid, senderPhone);
      break;
    case '/help':
      await sock.sendMessage(jid, { text: formatUsage('all') });
      break;
    default:
      // Unknown command - ignore silently
      break;
  }
}
