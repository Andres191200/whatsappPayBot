import { eq, and } from 'drizzle-orm';
import { db, userTokens, debts, oauthStates } from '../db/index.js';
import { config } from '../config/index.js';
import { randomBytes } from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'mercadopago-service' });

const MP_BASE_URL = 'https://api.mercadopago.com';
const MP_AUTH_URL = 'https://auth.mercadopago.com';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

export interface PreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface PaymentInfo {
  id: number;
  status: string;
  external_reference: string;
  transaction_amount: number;
  payer: {
    email: string;
  };
}

/**
 * Generate OAuth authorization URL for a user
 */
export async function generateOAuthUrl(userJid: string, groupJid: string): Promise<string> {
  // Generate random state for CSRF protection
  const state = randomBytes(16).toString('hex');

  // Store state in database
  await db.insert(oauthStates).values({
    state,
    userJid,
    groupJid,
  });

  const params = new URLSearchParams({
    client_id: config.mercadoPago.clientId,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: config.mercadoPago.redirectUri,
    state,
  });

  return `${MP_AUTH_URL}/authorization?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const response = await fetch(`${MP_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.mercadoPago.clientId,
      client_secret: config.mercadoPago.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.mercadoPago.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'Failed to exchange OAuth code');
    throw new Error(`OAuth token exchange failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(userJid: string): Promise<string | null> {
  const tokenRecord = await db.query.userTokens.findFirst({
    where: eq(userTokens.userJid, userJid),
  });

  if (!tokenRecord?.mpRefreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${MP_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.mercadoPago.clientId,
        client_secret: config.mercadoPago.clientSecret,
        refresh_token: tokenRecord.mpRefreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status, userJid }, 'Failed to refresh token');
      return null;
    }

    const data: TokenResponse = await response.json();

    // Update tokens in database
    await db
      .update(userTokens)
      .set({
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(userTokens.userJid, userJid));

    return data.access_token;
  } catch (error) {
    logger.error({ error, userJid }, 'Error refreshing token');
    return null;
  }
}

/**
 * Get a valid access token for a user (refresh if needed)
 */
export async function getValidAccessToken(userJid: string): Promise<string | null> {
  const tokenRecord = await db.query.userTokens.findFirst({
    where: eq(userTokens.userJid, userJid),
  });

  if (!tokenRecord) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired) {
    return refreshAccessToken(userJid);
  }

  return tokenRecord.mpAccessToken;
}

/**
 * Check if a user has linked their Mercado Pago account
 */
export async function hasLinkedAccount(userJid: string): Promise<boolean> {
  const tokenRecord = await db.query.userTokens.findFirst({
    where: eq(userTokens.userJid, userJid),
  });

  return !!tokenRecord;
}

/**
 * Create a payment preference (payment link) for a debt
 */
export async function createPaymentLink(
  creditorJid: string,
  debtId: number,
  amount: number,
  description: string
): Promise<string | null> {
  const accessToken = await getValidAccessToken(creditorJid);

  if (!accessToken) {
    logger.warn({ creditorJid }, 'No valid access token for creditor');
    return null;
  }

  try {
    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: description || 'Pago de deuda',
            quantity: 1,
            currency_id: 'ARS',
            unit_price: amount,
          },
        ],
        external_reference: `debt_${debtId}`,
        notification_url: `${config.server.baseUrl}/webhooks/mercadopago`,
        back_urls: {
          success: `${config.server.baseUrl}/payment/success`,
          failure: `${config.server.baseUrl}/payment/failure`,
          pending: `${config.server.baseUrl}/payment/pending`,
        },
        auto_return: 'approved',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText, creditorJid }, 'Failed to create preference');
      return null;
    }

    const data: PreferenceResponse = await response.json();

    // Store preference ID in debt record
    await db
      .update(debts)
      .set({ mpPreferenceId: data.id })
      .where(eq(debts.id, debtId));

    logger.info({ debtId, preferenceId: data.id }, 'Payment link created');

    return data.init_point;
  } catch (error) {
    logger.error({ error, creditorJid, debtId }, 'Error creating payment link');
    return null;
  }
}

/**
 * Handle payment notification from webhook
 */
export async function handlePaymentNotification(paymentId: string): Promise<void> {
  try {
    // We need to get payment details using the creditor's token
    // First, find debts with this payment ID or get payment info
    // Since we don't know the creditor yet, we'll check the external_reference

    // For now, we need to fetch from any linked account that might own this payment
    // In practice, we'd store the creditor JID when creating the preference

    const allTokens = await db.query.userTokens.findMany();

    for (const token of allTokens) {
      try {
        const response = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
          headers: {
            Authorization: `Bearer ${token.mpAccessToken}`,
          },
        });

        if (response.ok) {
          const payment: PaymentInfo = await response.json();

          if (payment.status === 'approved' && payment.external_reference?.startsWith('debt_')) {
            const debtId = parseInt(payment.external_reference.replace('debt_', ''), 10);

            // Mark debt as paid
            await db
              .update(debts)
              .set({
                status: 'paid',
                mpPaymentId: paymentId,
                paidAt: new Date(),
                updatedAt: new Date(),
              })
              .where(and(eq(debts.id, debtId), eq(debts.status, 'pending')));

            logger.info({ debtId, paymentId }, 'Debt auto-marked as paid via webhook');
            return;
          }
        }
      } catch {
        // Token doesn't own this payment, try next
        continue;
      }
    }

    logger.warn({ paymentId }, 'Could not find owner for payment');
  } catch (error) {
    logger.error({ error, paymentId }, 'Error handling payment notification');
  }
}
