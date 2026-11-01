export type MovementKind = "inward" | "outward" | "adjustment" | "job_consume" | "job_return";

export interface Movement { kind: MovementKind; qty: number }

/** Pure stock arithmetic. DB applies the same rule atomically via apply_stock_movement(). */
export function applyMovement(stock: number, m: Movement): number {
  if (!Number.isInteger(m.qty) || m.qty === 0) throw new Error("Quantity must be a non-zero integer");
  const delta =
    m.kind === "inward" || m.kind === "job_return" ? Math.abs(m.qty)
    : m.kind === "outward" || m.kind === "job_consume" ? -Math.abs(m.qty)
    : m.qty; // adjustment is signed
  const next = stock + delta;
  if (next < 0) throw new Error("Insufficient stock");
  return next;
}

export const isLowStock = (stock: number, reorderAt: number) => stock <= reorderAt;
