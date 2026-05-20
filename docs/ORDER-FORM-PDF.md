# Order form PDF

Each order has a **Download order PDF** (dealer view) or **Order PDF** (admin view) action on the order detail page.

The PDF is a single-page (or multi-page if notes are long) **order summary** suitable to save or email to the dealer:

- Ormsby header and “Dealer order form” title  
- Order ref (short + full ID on admin export), status, date, PO, ETA  
- Dealer / account block (name, account ID, contact, tier when known)  
- Ship-to address  
- Line table with **guitar thumbnail** (from product / option images when available)  
- **AUD** dealer unit and line totals, plus **approximate** amounts in the account **display currency** using **today’s FX rate** (Frankfurter via `/api/fx/latest`)  
- **Territory**, display currency, and indicative FX line in the header (e.g. `1 AUD = 0.6123 EUR` as of the rate date)  
- **Order totals** (below the line table): subtotal in **AUD**, then **Approx. subtotal (USD)** and **Approx. subtotal (EUR)** with the same rates as the on-screen Order Summary  
- Notes and a short **FX disclaimer** (indicative only; invoicing in AUD per dealer terms)  

**Implementation:** `lib/generate-order-pdf.ts` using `jspdf` + `jspdf-autotable` (loaded on demand when you click download).
