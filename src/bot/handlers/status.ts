import type { WASocket } from 'baileys';
import { formatStatus } from '../utils/formatter.js';
import { getPendingDebts } from '../../services/debt.service.js';
import pino from 'pino';

const logger = pino({ name: 'status-handler' });

export async function handleStatus(
  sock: WASocket,
  groupJid: string,
  _senderPhone: string
): Promise<void> {
  try {
    const pendingDebts = await getPendingDebts(groupJid);

    logger.info({ groupJid, debtCount: pendingDebts.length }, 'Status requested');

    const response = formatStatus(pendingDebts);

    // Collect all unique phone numbers for mentions
    const allPhones = new Set<string>();
    for (const debt of pendingDebts) {
      allPhones.add(debt.creditorPhone);
      allPhones.add(debt.debtorPhone);
    }
    const mentions = Array.from(allPhones).map((p) => `${p}@s.whatsapp.net`);

    await sock.sendMessage(groupJid, {
      text: response,
      mentions,
    });
  } catch (dbError) {
    logger.error({ error: dbError }, 'Database error fetching status');
    await sock.sendMessage(groupJid, {
      text: 'Failed to fetch status. Please try again.',
    });
  }
}
