import type { DebtWithRelations } from '../../types/index.js';

/**
 * Strip WhatsApp JID suffix (@s.whatsapp.net, @lid, etc.) to get just the ID
 */
export function stripJidSuffix(jid: string): string {
  return jid.replace(/@(s\.whatsapp\.net|lid|g\.us)$/i, '');
}

/**
 * Format a JID for display as a WhatsApp mention
 * The text should contain @<id> (without suffix) for WhatsApp to render it as a name
 */
export function formatMention(jid: string): string {
  return `@${stripJidSuffix(jid)}`;
}

/**
 * Convert a JID to full format for the mentions array
 * If it doesn't have a suffix, assume @s.whatsapp.net
 */
export function toFullJid(jid: string): string {
  if (jid.includes('@')) {
    return jid;
  }
  return `${jid}@s.whatsapp.net`;
}

/**
 * Format currency amount
 */
export function formatAmount(amount: number, currency = 'ARS'): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Format confirmation message when debt is created
 */
export function formatDebtCreated(
  creditorPhone: string,
  debtorPhones: string[],
  amount: number,
  description?: string
): string {
  const debtorMentions = debtorPhones.map(formatMention).join(', ');
  const creditorMention = formatMention(creditorPhone);

  let message = `${debtorMentions} - Dale pibe transferile  ${formatAmount(amount)} a ${creditorMention}`;

  if (description) {
    message += ` (${description})`;
  }

  message += '\n\nEscribí /paid ' + creditorMention + ' cuando le hayas transferido.';

  return message;
}

/**
 * Format confirmation message when debt is paid
 */
export function formatDebtPaid(debtorPhone: string, creditorPhone: string): string {
  return `${formatMention(debtorPhone)} has paid their debt to ${formatMention(creditorPhone)}`;
}

/**
 * Format status message showing pending debts
 */
export function formatStatus(debts: DebtWithRelations[]): string {
  if (debts.length === 0) {
    return 'No pending debts in this group!';
  }

  // Group debts by creditor
  const byCreditor = new Map<string, DebtWithRelations[]>();
  for (const debt of debts) {
    const existing = byCreditor.get(debt.creditorPhone) || [];
    existing.push(debt);
    byCreditor.set(debt.creditorPhone, existing);
  }

  let message = '*Pending debts:*\n\n';

  for (const [creditorPhone, creditorDebts] of byCreditor) {
    const total = creditorDebts.reduce((sum, d) => sum + d.amount, 0);
    message += `*Owed to ${formatMention(creditorPhone)}:* ${formatAmount(total)}\n`;

    for (const debt of creditorDebts) {
      message += `  - ${formatMention(debt.debtorPhone)}: ${formatAmount(debt.amount)}`;
      if (debt.description) {
        message += ` (${debt.description})`;
      }
      message += '\n';
    }
    message += '\n';
  }

  return message.trim();
}

/**
 * Format reminder message for pending debts
 */
export function formatReminder(debts: DebtWithRelations[], isWeeklySummary = false): string {
  if (debts.length === 0) {
    return '';
  }

  const header = isWeeklySummary
    ? '*Resumen de pagos semanal de Nordelta*\n\n'
    : '*Recordatorio: Pagos pendientes de Nordelta*\n\n';

  // Group debts by debtor for cleaner reminders
  const byDebtor = new Map<string, { creditor: string; amount: number; description?: string | null }[]>();
  for (const debt of debts) {
    const existing = byDebtor.get(debt.debtorPhone) || [];
    existing.push({
      creditor: debt.creditorPhone,
      amount: debt.amount,
      description: debt.description,
    });
    byDebtor.set(debt.debtorPhone, existing);
  }

  let message = header;

  for (const [debtorPhone, debtorDebts] of byDebtor) {
    const total = debtorDebts.reduce((sum, d) => sum + d.amount, 0);
    message += `${formatMention(debtorPhone)} debe ${formatAmount(total)} en total:\n`;

    for (const debt of debtorDebts) {
      message += `  - ${formatAmount(debt.amount)} to ${formatMention(debt.creditor)}`;
      if (debt.description) {
        message += ` (${debt.description})`;
      }
      message += '\n';
    }
  }

  message += '\nEscribí /paid @nombre_de_persona cuando le hayas transferido.';

  return message;
}

/**
 * Format usage instructions
 */
export function formatUsage(command: 'payme' | 'paid' | 'status' | 'all'): string {
  const commands: Record<string, string> = {
    payme: '*/payme* @persona1 @persona2 <amount> [Descripción]\nCrea recordatorios de pago.\Ejemplo: /payme @gonino 12000 del pool',
    paid: '*/paid* @persona\nTe notificás como que pagaste.\nEjemplo: /paid @makio',
    status: '*/status*\nMuestra todos los que faltan pagarle a alguien',
  };

  if (command === 'all') {
    return '*Available commands:*\n\n' + Object.values(commands).join('\n\n');
  }

  return commands[command];
}
