export interface ParsedPaymeCommand {
  debtors: string[];
  amount: number;
  description?: string;
}

export interface DebtWithRelations {
  id: number;
  groupId: number;
  creditorPhone: string;
  debtorPhone: string;
  amount: number;
  currency: string | null;
  description: string | null;
  status: 'pending' | 'paid' | 'cancelled' | null;
  createdAt: Date | null;
  group: {
    id: number;
    whatsappJid: string;
    name: string | null;
  };
  creditor: {
    phone: string;
    name: string | null;
  };
  debtor: {
    phone: string;
    name: string | null;
  };
}
