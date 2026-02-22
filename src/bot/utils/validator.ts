/**
 * Validate /payme command parameters
 * Returns error message if invalid, null if valid
 */
export function validatePaymeCommand(
  senderPhone: string,
  debtorPhones: string[],
  amount: number
): string | null {
  if (debtorPhones.includes(senderPhone)) {
    return "You can't create a debt to yourself.";
  }

  if (amount <= 0) {
    return 'Amount must be greater than 0.';
  }

  if (amount > 1000000) {
    return 'Amount seems too large. Maximum: 1,000,000.';
  }

  if (debtorPhones.length === 0) {
    return 'Please mention at least one person who owes you.';
  }

  if (debtorPhones.length > 20) {
    return 'Too many mentions. Maximum: 20 people.';
  }

  // Check for decimal precision (max 2 decimal places)
  if (Math.round(amount * 100) !== amount * 100) {
    return 'Amount can have at most 2 decimal places.';
  }

  return null;
}

/**
 * Check if message is from a group chat
 */
export function isGroupMessage(jid: string): boolean {
  return jid.endsWith('@g.us');
}
