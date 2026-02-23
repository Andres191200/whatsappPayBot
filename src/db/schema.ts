import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  whatsappJid: text('whatsapp_jid').notNull().unique(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const users = sqliteTable('users', {
  phone: text('phone').primaryKey(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id')
    .references(() => groups.id)
    .notNull(),
  creditorPhone: text('creditor_phone')
    .references(() => users.phone)
    .notNull(),
  debtorPhone: text('debtor_phone')
    .references(() => users.phone)
    .notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').default('ARS'),
  description: text('description'),
  status: text('status', { enum: ['pending', 'paid', 'cancelled'] }).default('pending'),
  mpPaymentId: text('mp_payment_id'),
  mpPreferenceId: text('mp_preference_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  lastReminderAt: integer('last_reminder_at', { mode: 'timestamp' }),
});

// Mercado Pago tokens for users
export const userTokens = sqliteTable('user_tokens', {
  userJid: text('user_jid').primaryKey(),
  mpAccessToken: text('mp_access_token').notNull(),
  mpRefreshToken: text('mp_refresh_token'),
  mpUserId: text('mp_user_id'),
  mpPublicKey: text('mp_public_key'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// OAuth state for login flow
export const oauthStates = sqliteTable('oauth_states', {
  state: text('state').primaryKey(),
  userJid: text('user_jid').notNull(),
  groupJid: text('group_jid').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Relations for type-safe joins
export const groupsRelations = relations(groups, ({ many }) => ({
  debts: many(debts),
}));

export const usersRelations = relations(users, ({ many }) => ({
  debtsAsCreditor: many(debts, { relationName: 'creditor' }),
  debtsAsDebtor: many(debts, { relationName: 'debtor' }),
}));

export const debtsRelations = relations(debts, ({ one }) => ({
  group: one(groups, {
    fields: [debts.groupId],
    references: [groups.id],
  }),
  creditor: one(users, {
    fields: [debts.creditorPhone],
    references: [users.phone],
    relationName: 'creditor',
  }),
  debtor: one(users, {
    fields: [debts.debtorPhone],
    references: [users.phone],
    relationName: 'debtor',
  }),
}));

// Type exports
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type UserToken = typeof userTokens.$inferSelect;
export type NewUserToken = typeof userTokens.$inferInsert;
export type OAuthState = typeof oauthStates.$inferSelect;
export type NewOAuthState = typeof oauthStates.$inferInsert;
