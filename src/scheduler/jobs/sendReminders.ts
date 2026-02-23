import type { WASocket } from 'baileys';
import { getAllPendingDebts, updateLastReminderAt } from '../../services/debt.service.js';
import { formatReminder, formatMention } from '../../bot/utils/formatter.js';
import { config } from '../../config/index.js';
import type { DebtWithRelations } from '../../types/index.js';
import { hasLinkedAccount, createPaymentLink } from '../../services/mercadopago.service.js';
import pino from 'pino';

const logger = pino({ name: 'send-reminders' });

interface SendRemindersOptions {
  isWeeklySummary?: boolean;
}

export async function sendReminders(
  sock: WASocket,
  options: SendRemindersOptions = {}
): Promise<void> {
  const { isWeeklySummary = false } = options;

  try {
    const pendingDebts = await getAllPendingDebts();

    if (pendingDebts.length === 0) {
      logger.info('No pending debts to remind');
      return;
    }

    // Group debts by group JID
    const debtsByGroup = new Map<string, DebtWithRelations[]>();

    for (const debt of pendingDebts) {
      const jid = debt.group.whatsappJid;
      if (!debtsByGroup.has(jid)) {
        debtsByGroup.set(jid, []);
      }
      debtsByGroup.get(jid)!.push(debt);
    }

    logger.info(
      { groupCount: debtsByGroup.size, totalDebts: pendingDebts.length },
      'Sending reminders'
    );

    // Send reminders to each group
    for (const [groupJid, groupDebts] of debtsByGroup) {
      let message = formatReminder(groupDebts, isWeeklySummary);

      if (!message) continue;

      // Collect all JIDs for mentions (both debtors and creditors)
      const allJids = new Set<string>();
      for (const d of groupDebts) {
        allJids.add(d.debtorPhone);
        allJids.add(d.creditorPhone);
      }
      const mentions = Array.from(allJids);

      // Generate payment links for creditors with linked MP accounts
      const paymentLinks: string[] = [];
      for (const debt of groupDebts) {
        const creditorHasMP = await hasLinkedAccount(debt.creditorPhone);
        if (creditorHasMP && !debt.mpPreferenceId) {
          const description = debt.description || 'Pago de deuda';
          const paymentUrl = await createPaymentLink(debt.creditorPhone, debt.id, debt.amount, description);
          if (paymentUrl) {
            paymentLinks.push(`${formatMention(debt.debtorPhone)} → ${formatMention(debt.creditorPhone)}: ${paymentUrl}`);
          }
        }
      }

      if (paymentLinks.length > 0) {
        message += '\n\n💳 *Links de pago:*\n' + paymentLinks.join('\n');
      }

      try {
        await sock.sendMessage(groupJid, {
          text: message,
          mentions,
        });

        // Update last reminder timestamp
        const debtIds = groupDebts.map((d) => d.id);
        await updateLastReminderAt(debtIds);

        logger.info({ groupJid, debtCount: groupDebts.length }, 'Reminder sent');
      } catch (sendError) {
        logger.error({ error: sendError, groupJid }, 'Failed to send reminder');
      }

      // Rate limiting - wait between messages
      await new Promise((resolve) => setTimeout(resolve, config.rateLimit.messageDelay));
    }

    logger.info('Finished sending reminders');
  } catch (error) {
    logger.error({ error }, 'Error in sendReminders job');
  }
}
