# Order & Revision Process — High-Level Overview

## Current Flow (As Implemented)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DEALER                                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Place order (checkout)           → Status: SUBMITTED                         │
│  2. Add guitars to existing order:                                               │
│     • DRAFT/SUBMITTED/APPROVED       → Direct add (saves immediately, "New")     │
│     • IN_PRODUCTION/SHIPPED/COMPLETED→ Add request (Ormsby approves)             │
│  3. "Submit updated order to Ormsby" → pendingOrmsbyRevisionReview: true         │
│     • Redirects to confirmation page                                             │
│     • Order shows "Pending approval" until admin approves                        │
│     • New lines show "Pending" badge (amber) instead of "New" (green)            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ADMIN (ORMSBY)                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  4. Sees "Revision pending" on orders list + order detail                        │
│  5. Edit lines: qty, unit price, remove line (Save line / Remove line)           │
│  6. "Approve revision" → clears pending only (no dealer confirm)               │
│     OR "Submit proposed changes to dealer" → dealerPendingAdminProposedChanges   │
│  7. "Awaiting dealer" badge while dealer must confirm                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DEALER (after admin proposal)                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  8. Banner: Accept updated order OR Request changes (→ pending review again)    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## What’s Working Today

- Dealer can add guitars and submit for review
- Admin sees pending revisions on dashboard, order list, and order detail
- Admin can approve in one click, or adjust lines and **submit proposed changes** for dealer confirmation
- Dealer **Accept** / **Request changes** when `dealerPendingAdminProposedChanges` is set
- Workflow emails via Cloud Function `onOrderRevisionWorkflowEmail` (toggle per event in **Admin → Settings → Notifications**); staff emails use **branding support email**
- Notification system surfaces new/updated orders (including “Awaiting dealer confirmation” in activity highlights)
- Status progression: DRAFT → SUBMITTED → APPROVED → IN_PRODUCTION → SHIPPED → COMPLETED

---

## Gaps & Missing Pieces

### 1. **Admin “Adjust” Before Approve**

**Current:** Admin can only Approve — no way to change the order before approving.

**Needed:** Admin should be able to:

- Edit line quantity (e.g. reduce qty)
- Edit unit price (or use Recalculate Prices, then confirm)
- Remove a line
- Add a note explaining changes

**Recommendation:** Keep “Approve revision” for no-changes cases. Add an **“Adjust & propose to dealer”** flow that:

- Lets admin edit lines (qty, price, remove)
- Stores proposed changes
- Puts the order into a new state (e.g. `adminProposedChanges: true`)
- Notifies the dealer to review

### 2. **Submit to Client for Approval (If Admin Adjusts)**

**Current:** No two-way approval when admin changes the order.

**Needed:**

- After admin adjusts → “Submit proposed changes to dealer”
- Dealer sees a clear summary: what changed (e.g. qty, price, removed line)
- Dealer actions: **Accept** or **Request changes**
- Accept → clear proposed state, mark revision as approved
- Request changes → optional note back to admin, return to pending for admin

**Data model:** Fields such as:

- `adminProposedChangesAt`
- `adminProposedChangesSummary` (or diff)
- `dealerAcceptedProposedAt` / `dealerRejectedProposedAt`

### 3. **Visibility & Filtering**

**Current:** Orders list shows “Revision pending” badge.

**Possible enhancements:**

- Filter: “Revision pending” (and maybe “Awaiting dealer approval”)
- Dashboard notification count for revision-pending orders
- Optional email when dealer submits for review or when admin proposes changes

### 4. **Add Requests (In-Production Orders)**

**Current:** In production, dealers submit add/remove **requests**; admin approves or rejects.

**Gaps:**

- Rejected add requests can be resubmitted
- No “adjust” (e.g. change qty) — only approve or reject

**Enhancement:** Allow admin to “Approve with changes” (e.g. different qty) and notify the dealer.

### 5. **Audit Trail**

**Current:** `updatedAt`, `dealerNotifiedOrmsbyOfUpdatesAt`, `revisionReviewedAt`.

**Enhancement:** Add an activity log per order (e.g. “Dealer submitted revision”, “Admin approved”, “Admin proposed changes”, “Dealer accepted”) for compliance and support.

### 6. **Email Notifications**

**Current:** Some emails (order confirmation, status change) exist; revision workflow does not.

**Enhancement:** Emails when:

- Dealer submits updated order for review
- Admin proposes changes (to dealer)
- Dealer accepts/rejects proposed changes (to admin)

---

## Recommended Implementation Order

| Phase | Scope | Effort |
|-------|--------|--------|
| **1. Orders list badge** | Show “Revision pending” on admin orders list | Done |
| **2. Admin adjust (inline)** | Edit line qty/price/remove before approve (same page) | **Done** — admin order detail: Save line / Remove line |
| **3. Propose to dealer** | New state, dealer-facing “Ormsby proposed changes” screen | **Done** — `dealerPendingAdminProposedChanges`, **Submit proposed changes to dealer** |
| **4. Dealer accept/reject** | Dealer actions on proposed changes | **Done** — Accept / Request changes on dealer order page |
| **5. Email notifications** | Revision + proposal lifecycle emails | **Done** — `onOrderRevisionWorkflowEmail` + admin Settings toggles (requires **support email** in branding for staff alerts) |
| **6. Activity log** | Per-order change history | Medium — not built yet |

---

## Quick Reference: Order States

| State | Who sets it | Meaning |
|-------|-------------|---------|
| `status` | Admin (Update Status) | DRAFT, SUBMITTED, APPROVED, IN_PRODUCTION, SHIPPED, COMPLETED, CANCELLED |
| `pendingOrmsbyRevisionReview` | Dealer (Submit updated order) or dealer (Request changes after admin proposal) | Dealer changes need Ormsby review |
| `dealerNotifiedOrmsbyOfUpdatesAt` | Dealer | When dealer last submitted for review |
| `revisionReviewedAt` | Admin (Approve revision or submit proposed changes) | When admin cleared dealer “revision pending” |
| `dealerPendingAdminProposedChanges` | Admin (**Submit proposed changes to dealer**) | Dealer must accept or request changes |
| `adminProposedChangesAt` / `adminProposedChangesNote` | Admin | When/note for last proposal to dealer |
| `dealerAcceptedAdminChangesAt` | Dealer (Accept) | Dealer accepted admin’s proposed changes |
| `dealerRejectedAdminProposedAt` / `dealerRejectedAdminProposedNote` | Dealer (Request changes) | Dealer sent order back with optional note |
