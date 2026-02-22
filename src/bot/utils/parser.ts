import type { ParsedPaymeCommand } from '../../types/index.js';

/**
 * Parse /payme command
 * Format: /payme @user1 @user2 1500 for pizza
 * or: /payme @user1 @user2 1500
 */
export function parsePaymeCommand(
  text: string,
  mentions: string[]
): ParsedPaymeCommand | null {
  // Remove the command prefix
  let withoutCommand = text.replace(/^\/payme\s*/i, '').trim();

  if (!withoutCommand || mentions.length === 0) {
    return null;
  }

  // Remove @mentions from text (they contain phone numbers that confuse the amount parser)
  // Mentions look like @5491123456789 in the raw text
  withoutCommand = withoutCommand.replace(/@\d+/g, '').trim();

  // Find amount in the remaining text (supports decimals with . or ,)
  // Look for a standalone number (not part of a longer sequence)
  const amountMatch = withoutCommand.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)(?:\s|$)/);
  if (!amountMatch) {
    return null;
  }

  const amount = parseFloat(amountMatch[1].replace(',', '.'));
  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  // Extract description (everything after the amount)
  const amountIndex = withoutCommand.indexOf(amountMatch[1]);
  const afterAmount = withoutCommand.slice(amountIndex + amountMatch[1].length).trim();
  const description = afterAmount || undefined;

  // Clean phone numbers from mentions (remove @s.whatsapp.net suffix)
  const debtors = mentions.map((m) => m.replace('@s.whatsapp.net', ''));

  return { debtors, amount, description };
}

/**
 * Parse /paid command
 * Format: /paid @creditor
 */
export function parsePaidCommand(text: string, mentions: string[]): string | null {
  if (!text.match(/^\/paid\s+/i) || mentions.length !== 1) {
    return null;
  }
  return mentions[0].replace('@s.whatsapp.net', '');
}

/**
 * Extract message text from various WhatsApp message types
 */
export function extractMessageText(message: any): string {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ''
  );
}

/**
 * Extract mentions from message
 */
export function extractMentions(message: any): string[] {
  return message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
