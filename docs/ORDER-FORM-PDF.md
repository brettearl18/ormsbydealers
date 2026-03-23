# Order form PDF

Each order has a **Download order PDF** (dealer view) or **Order PDF** (admin view) action on the order detail page.

The PDF is a single-page (or multi-page if notes are long) **order summary** suitable to save or email to the dealer:

- Ormsby header and “Dealer order form” title  
- Order ref (short + full ID on admin export), status, date, PO, ETA  
- Dealer / account block (name, account ID, contact, tier when known)  
- Ship-to address  
- Line table: #, SKU, description (including configured options), qty, unit price, line total  
- Subtotal in the order’s currency  
- Notes and a short disclaimer  

**Implementation:** `lib/generate-order-pdf.ts` using `jspdf` + `jspdf-autotable` (loaded on demand when you click download).
