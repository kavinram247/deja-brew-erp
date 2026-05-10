import { useCallback } from "react";
import { generateReceiptHtml } from "./PrintableReceipt";

/**
 * Prints a self-contained receipt HTML string via a hidden iframe.
 * The main page stays fully visible — no visibility-toggle flash.
 * Each call creates a fresh iframe, prints it, then removes it.
 */
function printHtml(html, docTitle) {
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  const prevTitle = document.title;
  document.title = docTitle;

  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();

  const cleanup = () => {
    document.title = prevTitle;
    try { document.body.removeChild(frame); } catch (_) {}
  };

  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    frame.contentWindow.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 30000); // safety fallback if afterprint never fires
  }, 80);
}

export function usePrint() {
  const printBill = useCallback((bill) => {
    printHtml(
      generateReceiptHtml(bill, "bill"),
      bill?.bill_number || "Deja-Brew"
    );
  }, []);

  const printKot = useCallback((bill) => {
    printHtml(
      generateReceiptHtml(bill, "kot"),
      `${bill?.bill_number || "KOT"}-KOT`
    );
  }, []);

  // Kept for API compatibility — renders nothing
  const PrintHost = useCallback(() => null, []);

  return { printBill, printKot, PrintHost };
}
