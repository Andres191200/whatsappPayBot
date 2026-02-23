import type { WASocket } from 'baileys';
import { parsePaymeCommand } from '../utils/parser.js';
import { validatePaymeCommand } from '../utils/validator.js';
import { formatDebtCreated, formatUsage, formatMention } from '../utils/formatter.js';
import { createDebts } from '../../services/debt.service.js';
import { hasLinkedAccount, createPaymentLink } from '../../services/mercadopago.service.js';
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

  // Create debts in database (store full JIDs for proper mention support)
  try {
    const debtIds = await createDebts({
      groupJid,
      creditorJid: senderJid,
      debtorJids: mentions,
      amount: parsed.amount,
      description: parsed.description,
    });

    logger.info({ debtIds, groupJid, senderPhone }, 'Created debts');

    // Send confirmation with mentions
    let response = formatDebtCreated(
      senderPhone,
      parsed.debtors,
      parsed.amount,
      parsed.description
    );

    // Check if creditor has linked Mercado Pago account
    const creditorHasMP = await hasLinkedAccount(senderJid);

    if (creditorHasMP) {
      // Generate payment links for each debt
      const paymentLinks: string[] = [];

      for (let i = 0; i < debtIds.length; i++) {
        const debtId = debtIds[i];
        const debtorJid = mentions[i];
        const description = parsed.description || 'Pago de deuda';

        const paymentUrl = await createPaymentLink(senderJid, debtId, parsed.amount, description);

        if (paymentUrl) {
          paymentLinks.push(`${formatMention(debtorJid)}: ${paymentUrl}`);
        }
      }

      if (paymentLinks.length > 0) {
        response += '\n\n💳 *Links de pago:*\n' + paymentLinks.join('\n');
      }
    }

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
