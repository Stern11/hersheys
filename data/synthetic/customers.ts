import type { Customer } from "@/types/planning";

export const CUSTOMERS: Customer[] = [
  { id: "cust_walmart", name: "Walmart", channel: "mass" },
  { id: "cust_target", name: "Target", channel: "mass" },
  { id: "cust_kroger", name: "Kroger", channel: "grocery" },
];

export const customerById = (id: string): Customer => {
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown customer id: ${id}`);
  return c;
};
