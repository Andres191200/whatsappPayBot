import type { WASocket } from 'baileys';
import { parsePaidCommand } from '../utils/parser.js';
import { formatDebtPaid, formatUsage } from '../utils/formatter.js';
import { markDebtPaid } from '../../services/debt.service.js';
import pino from 'pino';

const logger = pino({ name: 'paid-handler' });

export async function handlePaid(
  sock: WASocket,
  groupJid: string,
  senderPhone: string,
  text: string,
  mentions: string[]
): Promise<void> {
  // Parse the command
  const creditorPhone = parsePaidCommand(text, mentions);

  if (!creditorPhone) {
    await sock.sendMessage(groupJid, {
      text: formatUsage('paid'),
    });
    return;
  }

  // Can't pay yourself
  if (creditorPhone === senderPhone) {
    await sock.sendMessage(groupJid, {
      text: "You can't mark a payment to yourself.",
    });
    return;
  }

  // Mark debt as paid
  try {
    const success = await markDebtPaid(groupJid, senderPhone, creditorPhone);

    if (success) {
      logger.info({ groupJid, debtorPhone: senderPhone, creditorPhone }, 'Debt marked as paid');

      const response = formatDebtPaid(senderPhone, creditorPhone);
      const allMentions = [senderPhone, creditorPhone].map((p) => `${p}@s.whatsapp.net`);

      await sock.sendMessage(groupJid, {
        text: response,
        mentions: allMentions,
      });
    } else {
      await sock.sendMessage(groupJid, {
        text: `No pending debt found from you to @${creditorPhone}`,
        mentions: [`${creditorPhone}@s.whatsapp.net`],
      });
    }
  } catch (dbError) {
    logger.error({ error: dbError }, 'Database error marking debt as paid');
    await sock.sendMessage(groupJid, {
      text: 'Failed to update debt. Please try again.',
    });
  }
}
