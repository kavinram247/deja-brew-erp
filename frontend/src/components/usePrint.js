import React, { useState, useCallback } from "react";
import { PrintableReceipt } from "./PrintableReceipt";

/**
 * Portal-less print host that mounts hidden, populates with bill + kind,
 * then triggers window.print().
 *
 * Usage:
 *   const { printBill, printKot, PrintHost } = usePrint();
 *   <PrintHost />
 *   <button onClick={() => printBill(bill)}>Print Bill</button>
 */
export function usePrint() {
  const [bill, setBill] = useState(null);
  const [kind, setKind] = useState("bill");

  const trigger = useCallback((b, k) => {
    setBill(b);
    setKind(k);
    // Small timeout so DOM renders before print dialog opens
    setTimeout(() => window.print(), 50);
  }, []);

  const printBill = useCallback((b) => trigger(b, "bill"), [trigger]);
  const printKot = useCallback((b) => trigger(b, "kot"), [trigger]);

  const PrintHost = useCallback(() => (
    <div className="print-root" aria-hidden>
      <PrintableReceipt bill={bill} kind={kind} />
    </div>
  ), [bill, kind]);

  return { printBill, printKot, PrintHost };
}
