export type Role = "ADMIN" | "DISTRIBUTOR" | "DEALER";

export interface UserDoc {
  role: Role;
  accountId: string;
  email: string;
  name: string;
}

export interface AccountDoc {
  name: string;
  tierId: string;
  currency: string;
  territory?: string;
  terms?: string;
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
  priceAdjustment?: number; // Additional cost for this option
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
  basePrice: number;
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

export interface ShippingAddress {
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
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
  createdAt: string;
  updatedAt: string;
  invoiceUrl?: string;
  invoiceUploadedAt?: string;
  etaDate?: string;
}

export interface OrderLineDoc {
  guitarId: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  selectedOptions?: Record<string, string>;
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
}

export interface AdminEmailTemplateSettings {
  welcomeSubject?: string;
  welcomeBody?: string;
  orderConfirmationSubject?: string;
  orderConfirmationBody?: string;
}

export interface AdminSettingsDoc {
  branding: AdminBrandingSettings;
  smtp?: AdminSmtpSettings | null;
  notifications: AdminNotificationSettings;
  emailTemplates?: AdminEmailTemplateSettings | null;
  staffNotes?: string;
  updatedAt: string;
}


