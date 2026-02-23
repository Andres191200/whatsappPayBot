import type { WASocket } from 'baileys';
import { formatDebtPaid, formatUsage, stripJidSuffix } from '../utils/formatter.js';
import { markDebtPaid } from '../../services/debt.service.js';
import pino from 'pino';

const logger = pino({ name: 'paid-handler' });

export async function handlePaid(
  sock: WASocket,
  groupJid: string,
  senderJid: string,
  senderPhone: string,
  text: string,
  mentions: string[]
): Promise<void> {
  // Need exactly one mention (the creditor)
  if (mentions.length !== 1) {
    await sock.sendMessage(groupJid, {
      text: formatUsage('paid'),
    });
    return;
  }

  const creditorJid = mentions[0];
  const creditorPhone = stripJidSuffix(creditorJid);

  // Can't pay yourself
  if (creditorPhone === senderPhone) {
    await sock.sendMessage(groupJid, {
      text: "You can't mark a payment to yourself.",
    });
    return;
  }

  // Mark debt as paid (using full JIDs)
  try {
    const success = await markDebtPaid(groupJid, senderJid, creditorJid);

    if (success) {
      logger.info({ groupJid, debtorPhone: senderPhone, creditorPhone }, 'Debt marked as paid');

      const response = formatDebtPaid(senderPhone, creditorPhone);
      // Use original JIDs for mentions
      const allMentions = [senderJid, ...mentions];

      await sock.sendMessage(groupJid, {
        text: response,
        mentions: allMentions,
      });
    } else {
      await sock.sendMessage(groupJid, {
        text: `No pending debt found from you to @${stripJidSuffix(mentions[0] || creditorPhone)}`,
        mentions: mentions,
      });
    }
  } catch (dbError) {
    logger.error({ error: dbError }, 'Database error marking debt as paid');
    await sock.sendMessage(groupJid, {
      text: 'Failed to update debt. Please try again.',
    });
  }
}
