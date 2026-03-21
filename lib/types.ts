export type Role = "ADMIN" | "DISTRIBUTOR" | "DEALER";

export interface UserDoc {
  role: Role;
  accountId: string;
  email: string;
  name: string;
}

export interface ShippingAddress {
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
}

export interface AccountDoc {
  name: string;
  tierId: string;
  currency: string;
  /** Discount % off RRP (e.g. 30 = 30% off). Dealer price = RRP × (1 - discountPercent/100). */
  discountPercent?: number;
  territory?: string;
  terms?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: ShippingAddress;
  shippingAddress?: ShippingAddress;
  /** Dealer-set label for estimated tax/tariff (e.g. "VAT", "GST") — for cost estimation only. */
  estimatedTaxLabel?: string;
  /** Dealer-set tax/tariff % for cost estimation (e.g. 20 for 20% VAT). Applied later. */
  estimatedTaxPercent?: number;
  notes?: string;
}

export interface AccountRequestDoc {
  email: string;
  uid: string;
  companyName: string;
  contactName: string;
  accountType: "DEALER" | "DISTRIBUTOR";
  phone?: string;
  address?: string;
  territory?: string;
  notes?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface TierDoc {
  name: string;
  description?: string;
  minQuantity?: number; // Minimum quantity for this tier (volume-based)
  maxQuantity?: number; // Maximum quantity for this tier (volume-based), null means unlimited
  order?: number; // Order of tiers (lower numbers = higher priority/volume)
}

export type AvailabilityState = "IN_STOCK" | "PREORDER" | "BATCH";

export interface GuitarSpecs {
  body?: string;
  neck?: string;
  neckShape?: string;
  fretboard?: string;
  fretboardRadius?: string;
  fretwire?: string;
  inlay?: string;
  sideDots?: string;
  hardwareColour?: string;
  bridgeMachineheads?: string;
  electronics?: string;
  pickups?: string;
  finish?: string;
  scale?: string;
  other?: string;
  // Legacy fields for backward compatibility
  scaleLength?: string;
  frets?: number;
  stringCount?: number | number[];
  bridgePickup?: string;
  neckPickup?: string;
  hardware?: string;
  notes?: string;
}

export interface GuitarOption {
  optionId: string; // e.g., "color", "frets", "strings", "bridge"
  label: string; // Display name, e.g., "Color", "Fret Count"
  type: "select" | "number"; // How the option is selected
  required: boolean; // Must select this option
  values: GuitarOptionValue[]; // Available choices
}

export interface GuitarOptionValue {
  valueId: string; // e.g., "black", "24", "tremolo"
  label: string; // Display name, e.g., "Satin Black", "24 Frets", "Tremolo Bridge"
  priceAdjustment?: number; // Dealer price adjustment (AUD)
  rrpAdjustment?: number; // RRP adjustment (AUD)
  images?: string[]; // Option-specific images
  skuSuffix?: string; // Added to base SKU, e.g., "-BLK", "-24"
}

export interface GuitarDoc {
  sku: string; // Base SKU template (e.g., "HYPE-6")
  name: string;
  series: string;
  run?: string; // Run information (free text)
  etaDelivery?: string; // ETA Delivery information (free text)
  images: string[]; // Default/base images
  specs: GuitarSpecs; // Base specs
  options?: GuitarOption[]; // Available options for dealers to choose
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityDoc {
  state: AvailabilityState;
  qtyAvailable: number;
  qtyAllocated: number;
  etaDate?: string | null;
  batchName?: string | null;
}

export interface PromoPrice {
  price: number;
  validFrom: string;
  validTo: string;
}

export interface QuantityBreak {
  minQuantity: number;
  maxQuantity?: number; // undefined means unlimited
  price: number;
}

export interface PricesDoc {
  guitarId: string;
  currency: string;
  basePrice: number; // Dealer price (AUD)
  rrp?: number; // Recommended retail price (AUD)
  quantityBreaks?: QuantityBreak[]; // Quantity-based pricing breaks
  tierPrices?: Record<string, number | undefined>;
  accountOverrides?: Record<string, number | undefined>;
  promo?: PromoPrice | null;
}

export type OrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export interface OrderTotals {
  subtotal: number;
  currency: string;
}

export interface OrderDoc {
  accountId: string;
  createdByUid: string;
  status: OrderStatus;
  currency: string;
  totals: OrderTotals;
  shippingAddress: ShippingAddress;
  poNumber?: string;
  notes?: string;
  termsAccepted?: {
    accepted: boolean;
    acceptedAt: string;
  };
  createdAt: string;
  updatedAt: string;
  invoiceUrl?: string;
  invoiceUploadedAt?: string;
  etaDate?: string;
  /** Set when dealer resubmits a completed order back to Ormsby for review. */
  resubmittedAt?: string;
  /** Status before resubmit (e.g. COMPLETED) for audit. */
  resubmittedFromStatus?: OrderStatus;
  /** Dealer tapped “submit updated order” after adding lines (so Ormsby can re-review). */
  dealerNotifiedOrmsbyOfUpdatesAt?: string;
  /** True after dealer submits updated order; cleared when admin approves the revision. */
  pendingOrmsbyRevisionReview?: boolean;
  /** When staff cleared pending revision review. */
  revisionReviewedAt?: string;
  /** Admin adjusted the order; dealer must accept or request changes. */
  dealerPendingAdminProposedChanges?: boolean;
  adminProposedChangesAt?: string;
  adminProposedChangesNote?: string | null;
  dealerAcceptedAdminChangesAt?: string;
  dealerRejectedAdminProposedAt?: string;
  dealerRejectedAdminProposedNote?: string | null;
}

export interface OrderLineDoc {
  guitarId: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  selectedOptions?: Record<string, string>;
  /**
   * Line added after checkout / initial submission — dealer “Add to order” or
   * Ormsby-approved add request. Drives NEW styling on the order detail.
   */
  isNewOnOrder?: boolean;
  /**
   * Legacy: set on approved add requests only. Prefer `isNewOnOrder`; UI treats either as new.
   */
  addedViaOrmsbyApproval?: boolean;
}

export type OrderChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface OrderAddRequestDoc {
  guitarId: string;
  sku: string;
  name: string;
  qty: number;
  /** Dealer-requested unit price (AUD) for transparency; admin recalculates on approval. */
  unitPrice: number;
  selectedOptions?: Record<string, string>;
  requestedByUid: string;
  requestedByAccountId: string;
  status: OrderChangeRequestStatus;
  requestedAt: string;
  processedAt?: string | null;
  rejectionReason?: string | null;
}

export interface OrderRemoveRequestDoc {
  /** Order line document id. */
  lineId: string;
  guitarId: string;
  /** How many units the dealer wants removed from the line. */
  qtyToRemove: number;
  /** Line unit price (AUD) captured at request time for transparency. */
  unitPrice: number;
  requestedByUid: string;
  requestedByAccountId: string;
  status: OrderChangeRequestStatus;
  requestedAt: string;
  processedAt?: string | null;
  rejectionReason?: string | null;
}

export interface AdminBrandingSettings {
  siteName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  supportEmail?: string;
}

export interface AdminSmtpSettings {
  host: string;
  port: number;
  username?: string;
  fromEmail: string;
  useTls: boolean;
}

export interface AdminNotificationSettings {
  orderCreatedEmail: boolean;
  orderStatusChangedEmail: boolean;
  accountRequestEmail: boolean;
  dailySummaryEmail: boolean;
  /** Email support address when a dealer submits an order revision for review. */
  orderDealerRevisionSubmittedEmail?: boolean;
  /** Email dealer when Ormsby submits proposed line/pricing changes for confirmation. */
  orderAdminProposedChangesEmail?: boolean;
  /** Email support when dealer accepts or rejects proposed changes. */
  orderDealerProposalResponseEmail?: boolean;
}

export interface AdminEmailTemplateSettings {
  welcomeSubject?: string;
  welcomeBody?: string;
  orderConfirmationSubject?: string;
  orderConfirmationBody?: string;
  statusChangeSubject?: string;
  statusChangeBody?: string;
  passwordResetSubject?: string;
  passwordResetBody?: string;
}

export interface AdminMailgunSettings {
  fromEmail?: string;
}

export interface AdminSettingsDoc {
  branding: AdminBrandingSettings;
  smtp?: AdminSmtpSettings | null;
  mailgun?: AdminMailgunSettings | null;
  notifications: AdminNotificationSettings;
  emailTemplates?: AdminEmailTemplateSettings | null;
  staffNotes?: string;
  termsTemplate?: string;
  updatedAt: string;
}

export interface FxRatesDoc {
  base: string;
  asOf: string;
  rates: Record<string, number>;
}



