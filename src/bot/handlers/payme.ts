import type { WASocket } from 'baileys';
import { parsePaymeCommand } from '../utils/parser.js';
import { validatePaymeCommand } from '../utils/validator.js';
import { formatDebtCreated, formatUsage } from '../utils/formatter.js';
import { createDebts } from '../../services/debt.service.js';
import pino from 'pino';

const logger = pino({ name: 'payme-handler' });

export async function handlePayme(
  sock: WASocket,
  groupJid: string,
  senderJid: string,
  senderPhone: string,
  text: string,
  mentions: string[]
): Promise<void> {
  // Parse the command
  const parsed = parsePaymeCommand(text, mentions);

  if (!parsed) {
    await sock.sendMessage(groupJid, {
      text: formatUsage('payme'),
    });
    return;
  }

  // Validate
  const error = validatePaymeCommand(senderPhone, parsed.debtors, parsed.amount);

  if (error) {
    await sock.sendMessage(groupJid, { text: error });
    return;
  }

  // Create debts in database
  try {
    const debtIds = await createDebts({
      groupJid,
      creditorPhone: senderPhone,
      debtorPhones: parsed.debtors,
      amount: parsed.amount,
      description: parsed.description,
    });

    logger.info({ debtIds, groupJid, senderPhone }, 'Created debts');

    // Send confirmation with mentions
    const response = formatDebtCreated(
      senderPhone,
      parsed.debtors,
      parsed.amount,
      parsed.description
    );

    // Use original JIDs for mentions (senderJid + original mentions from message)
    const allMentions = [senderJid, ...mentions];

    await sock.sendMessage(groupJid, {
      text: response,
      mentions: allMentions,
    });
  } catch (dbError) {
    logger.error({ error: dbError }, 'Database error creating debts');
    await sock.sendMessage(groupJid, {
      text: 'Failed to save debt. Please try again.',
    });
  }
}
