import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, oauthStates, userTokens } from '../../db/index.js';
import { config } from '../../config/index.js';
import { exchangeCodeForToken } from '../../services/mercadopago.service.js';
import pino from 'pino';

const logger = pino({ name: 'oauth-router' });

export const oauthRouter = Router();

/**
 * OAuth callback handler
 * Mercado Pago redirects here after user authorizes
 */
oauthRouter.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    logger.warn({ code, state }, 'Invalid OAuth callback parameters');
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Error</h1>
          <p>Parámetros inválidos. Por favor intentá de nuevo con /login</p>
        </body>
      </html>
    `);
  }

  try {
    // Find the OAuth state record
    const stateRecord = await db.query.oauthStates.findFirst({
      where: eq(oauthStates.state, state),
    });

    if (!stateRecord) {
      logger.warn({ state }, 'OAuth state not found');
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Error</h1>
            <p>Sesión expirada. Por favor intentá de nuevo con /login</p>
          </body>
        </html>
      `);
    }

    // Exchange code for tokens
    const tokenData = await exchangeCodeForToken(code);

    // Save tokens to database
    await db
      .insert(userTokens)
      .values({
        userJid: stateRecord.userJid,
        mpAccessToken: tokenData.access_token,
        mpRefreshToken: tokenData.refresh_token,
        mpUserId: tokenData.user_id?.toString(),
        mpPublicKey: tokenData.public_key,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userTokens.userJid,
        set: {
          mpAccessToken: tokenData.access_token,
          mpRefreshToken: tokenData.refresh_token,
          mpUserId: tokenData.user_id?.toString(),
          mpPublicKey: tokenData.public_key,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          updatedAt: new Date(),
        },
      });

    // Delete used OAuth state
    await db.delete(oauthStates).where(eq(oauthStates.state, state));

    logger.info({ userJid: stateRecord.userJid }, 'User successfully linked Mercado Pago');

    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>✅ Listo!</h1>
          <p>Tu cuenta de Mercado Pago está vinculada.</p>
          <p>Ya podés cerrar esta ventana y volver a WhatsApp.</p>
          <p style="color: #888; font-size: 14px;">Ahora cuando uses /payme, se generarán links de pago automáticos.</p>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error({ error }, 'OAuth callback error');
    return res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Error</h1>
          <p>Hubo un error al vincular tu cuenta. Por favor intentá de nuevo.</p>
        </body>
      </html>
    `);
  }
});
