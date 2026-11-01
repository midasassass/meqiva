import type { Paise } from "./money";

export interface BillableItem { id: string; description: string; totalPaise: Paise; extraWork: boolean }
export interface CustomerApproval { itemId: string; quoteVersion: number; amountPaise: Paise; approvedAt: string }

/**
 * Extra (post-approval) work can only be billed if the customer approved that
 * exact item at an amount >= what is being billed. Returns the offending items.
 */
export function unapprovedBillable(items: BillableItem[], approvals: CustomerApproval[]): BillableItem[] {
  return items.filter((it) => {
    if (!it.extraWork) return false;
    const a = approvals.find((x) => x.itemId === it.id);
    return !a || a.amountPaise < it.totalPaise;
  });
}
