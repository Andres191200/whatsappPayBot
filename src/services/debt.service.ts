import { eq, and } from 'drizzle-orm';
import { db, debts, users, groups } from '../db/index.js';
import type { DebtWithRelations } from '../types/index.js';

export interface CreateDebtsParams {
  groupJid: string;
  creditorJid: string;
  debtorJids: string[];
  amount: number;
  description?: string;
}

/**
 * Ensure a group exists in the database, creating it if necessary
 */
async function ensureGroup(whatsappJid: string): Promise<number> {
  const existing = await db.query.groups.findFirst({
    where: eq(groups.whatsappJid, whatsappJid),
  });

  if (existing) {
    return existing.id;
  }

  const [newGroup] = await db.insert(groups).values({ whatsappJid }).returning();
  return newGroup.id;
}

/**
 * Ensure users exist in the database
 */
async function ensureUsers(phones: string[]): Promise<void> {
  for (const phone of phones) {
    await db.insert(users).values({ phone }).onConflictDoNothing();
  }
}

/**
 * Create debt records for multiple debtors
 * Now stores full JIDs (with @lid or @s.whatsapp.net) for proper mention support
 */
export async function createDebts(params: CreateDebtsParams): Promise<number[]> {
  const { groupJid, creditorJid, debtorJids, amount, description } = params;

  // Ensure group and users exist (store full JIDs)
  const groupId = await ensureGroup(groupJid);
  await ensureUsers([creditorJid, ...debtorJids]);

  // Create debt records
  const insertedIds: number[] = [];
  for (const debtorJid of debtorJids) {
    const [debt] = await db
      .insert(debts)
      .values({
        groupId,
        creditorPhone: creditorJid,
        debtorPhone: debtorJid,
        amount,
        description,
      })
      .returning({ id: debts.id });

    insertedIds.push(debt.id);
  }

  return insertedIds;
}

/**
 * Mark a debt as paid
 */
export async function markDebtPaid(
  groupJid: string,
  debtorPhone: string,
  creditorPhone: string
): Promise<boolean> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.whatsappJid, groupJid),
  });

  if (!group) return false;

  const result = await db
    .update(debts)
    .set({
      status: 'paid',
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(debts.groupId, group.id),
        eq(debts.debtorPhone, debtorPhone),
        eq(debts.creditorPhone, creditorPhone),
        eq(debts.status, 'pending')
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Get all pending debts for a group
 */
export async function getPendingDebts(groupJid: string): Promise<DebtWithRelations[]> {
  const group = await db.query.groups.findFirst({
    where: eq(groups.whatsappJid, groupJid),
  });

  if (!group) return [];

  const result = await db.query.debts.findMany({
    where: and(eq(debts.groupId, group.id), eq(debts.status, 'pending')),
    with: {
      group: true,
      creditor: true,
      debtor: true,
    },
  });

  return result as DebtWithRelations[];
}

/**
 * Get all pending debts across all groups (for reminders)
 */
export async function getAllPendingDebts(): Promise<DebtWithRelations[]> {
  const result = await db.query.debts.findMany({
    where: eq(debts.status, 'pending'),
    with: {
      group: true,
      creditor: true,
      debtor: true,
    },
  });

  return result as DebtWithRelations[];
}

/**
 * Update last reminder timestamp for debts
 */
export async function updateLastReminderAt(debtIds: number[]): Promise<void> {
  for (const id of debtIds) {
    await db
      .update(debts)
      .set({ lastReminderAt: new Date() })
      .where(eq(debts.id, id));
  }
}
