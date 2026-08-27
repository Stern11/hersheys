import type { Customer } from "@/types/planning";

/**
 * The real US confectionery account set.
 *
 * NOTE ON `channel`: `Customer["channel"]` in types/planning.ts only offers
 * mass | grocery | club | drug | ecommerce. Three genuinely distinct
 * Hershey channels have no member — Convenience, Dollar/Value and Vending —
 * and neither does "distributor", which is what McLane actually is. Those
 * accounts are mapped to their nearest available member and their true
 * channel is stated in `CHANNEL_NOTES` below rather than silently
 * misrepresented. Widening the union is a types/ change, which is outside
 * this file's ownership.
 */
export const CUSTOMERS: Customer[] = [
  // Distribution — the single named 10-K customer.
  { id: "cust_mclane", name: "McLane Company", channel: "mass" },

  // Mass
  { id: "cust_walmart", name: "Walmart", channel: "mass" },
  { id: "cust_target", name: "Target", channel: "mass" },
  { id: "cust_meijer", name: "Meijer", channel: "mass" },

  // Club
  { id: "cust_sams_club", name: "Sam's Club", channel: "club" },
  { id: "cust_costco", name: "Costco Wholesale", channel: "club" },

  // Grocery
  { id: "cust_kroger", name: "Kroger", channel: "grocery" },
  { id: "cust_albertsons", name: "Albertsons", channel: "grocery" },
  { id: "cust_publix", name: "Publix", channel: "grocery" },
  { id: "cust_ahold_delhaize", name: "Ahold Delhaize USA", channel: "grocery" },
  { id: "cust_heb", name: "H-E-B", channel: "grocery" },

  // Drug
  { id: "cust_walgreens", name: "Walgreens", channel: "drug" },
  { id: "cust_cvs", name: "CVS Health", channel: "drug" },

  // Dollar / value — no dedicated channel member exists in the type.
  { id: "cust_dollar_general", name: "Dollar General", channel: "mass" },
  { id: "cust_dollar_tree", name: "Dollar Tree", channel: "mass" },

  // e-Commerce
  { id: "cust_amazon", name: "Amazon", channel: "ecommerce" },
];

/** True commercial channel for accounts the `Customer["channel"]` union cannot express. */
export const CHANNEL_NOTES: Record<string, string> = {
  cust_mclane: "Distributor — sells through into convenience, drug, club and mass; not a retailer itself.",
  cust_dollar_general: "Dollar / value channel.",
  cust_dollar_tree: "Dollar / value channel.",
};

export interface CustomerConcentration {
  customerId: string;
  /** Share of consolidated net sales, as disclosed in the FY2024 10-K. */
  shareOfConsolidatedNetSales: number;
  basis: string;
}

/**
 * Customer concentration matters to seasonal planning because a single
 * distributor carries roughly a quarter of the volume: a verbally-committed
 * seasonal pack that never becomes a PO is a materially larger unmodelled
 * exposure through McLane than through any individual retailer.
 */
export const CUSTOMER_CONCENTRATION: CustomerConcentration[] = [
  {
    customerId: "cust_mclane",
    shareOfConsolidatedNetSales: 0.27,
    basis: "FY2024 Form 10-K — the only customer disclosed above the 10% reporting threshold.",
  },
];

export const customerById = (id: string): Customer => {
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown customer id: ${id}`);
  return c;
};
