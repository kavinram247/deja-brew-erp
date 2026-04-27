import React, { useState, useCallback } from "react";
import { PrintableReceipt } from "./PrintableReceipt";

/**
 * Portal-less print host that mounts hidden, populates with bill + kind,
 * then triggers window.print().
 * Sets document.title to the bill number so PDF "Save as" defaults to
 * "<bill_number>.pdf" instead of the app title.
 */
export function usePrint() {
  const [bill, setBill] = useState(null);
  const [kind, setKind] = useState("bill");

  const trigger = useCallback((b, k) => {
    setBill(b);
    setKind(k);
    setTimeout(() => {
      const prevTitle = document.title;
      const fname = b?.bill_number ? `${b.bill_number}${k === "kot" ? "-KOT" : ""}` : "Deja Brew";
      document.title = fname;
      const onAfter = () => {
        document.title = prevTitle;
        window.removeEventListener("afterprint", onAfter);
      };
      window.addEventListener("afterprint", onAfter);
      window.print();
      // Fallback in case afterprint never fires (some browsers)
      setTimeout(() => { document.title = prevTitle; }, 4000);
    }, 60);
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
