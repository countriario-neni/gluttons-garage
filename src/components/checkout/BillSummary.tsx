import type { Bill } from "@/domain/types";
import { formatINR } from "@/domain/money";

/** Subtotal, discounts, CGST + SGST (2.5% each) and the total, as priced by priceOrder. */
export function BillSummary({ bill, couponCode }: { bill: Bill; couponCode: string | null }) {
  const row = "flex items-baseline justify-between gap-4";
  return (
    <dl className="space-y-2 text-[0.95rem]">
      <div className={row}>
        <dt className="text-muted-foreground">Item total</dt>
        <dd className="tabular-nums">{formatINR(bill.subtotal)}</dd>
      </div>
      {bill.couponDiscount > 0 && (
        <div className={row}>
          <dt className="text-success">Coupon {couponCode}</dt>
          <dd className="font-bold text-success tabular-nums">−{formatINR(bill.couponDiscount)}</dd>
        </div>
      )}
      {bill.loyaltyDiscount > 0 && (
        <div className={row}>
          <dt className="text-success">Loyalty ({bill.pointsRedeemed} points)</dt>
          <dd className="font-bold text-success tabular-nums">−{formatINR(bill.loyaltyDiscount)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-muted-foreground">CGST 2.5%</dt>
        <dd className="tabular-nums">{formatINR(bill.cgst)}</dd>
      </div>
      <div className={row}>
        <dt className="text-muted-foreground">SGST 2.5%</dt>
        <dd className="tabular-nums">{formatINR(bill.sgst)}</dd>
      </div>
      <div className={`${row} mt-3 border-t-2 border-dashed border-line pt-3`}>
        <dt className="text-lg font-bold">To pay</dt>
        <dd className="text-xl font-bold tabular-nums">{formatINR(bill.total)}</dd>
      </div>
    </dl>
  );
}
