import { DEMO_NOW, lineById } from "./master-data";
import { materialById } from "./materials";
import { productById } from "./products";
import { eventById, seasonalPhasesForEvent } from "./events";
import { currentFormalPlanValue } from "./planning-snapshots";
import { purchaseOrdersForMaterial, lineMappingSummary } from "./execution-history";
import { supplierForMaterial } from "./suppliers";
import { HISTORICAL_PERIODS } from "./historical-demand";
import { customerById } from "./customers";

/**
 * The integration inbox.
 *
 * Heizen does not own a system of record — every fact it reasons about
 * arrives from somewhere else: an EDI document from a customer, a
 * confirmation from a supplier, a master-data change in SAP, an alert from
 * Kinaxis or Aera. This file is that arrival log, so the product can show
 * *when* it last heard from each system rather than presenting a plan of
 * unknown vintage as though it were current.
 *
 * RULES THIS FILE OBEYS
 *
 * 1. DETERMINISTIC. Every record is a literal, and every number quoted in a
 *    record is read back out of the data layer (`materialById`,
 *    `currentFormalPlanValue`, `lineMappingSummary`, ...) rather than typed
 *    in by hand. No `Math.random()`, no `Date.now()`, no seeded RNG draw —
 *    two renders, server and client, produce byte-identical output.
 *
 * 2. NO FABRICATED PRECISION. A signal may *quote* a number that already
 *    exists in the source data; it may never introduce one. Where a real
 *    integration would carry a quantity we do not have (the McLane PO's
 *    ordered cases, for instance) the record says so explicitly instead of
 *    inventing a plausible figure. Nothing here is a planning calculation —
 *    all derived planning numbers still come from `lib/planning-engine/*`.
 *
 * 3. PRODUCTION TIMING != SALES TIMING. Halloween 2027 is committed Jan-Mar,
 *    built Mar-Jul, shipped Jul-Sep and sells through Sep-Oct. A POS /
 *    sell-through file landing on the demo's "now" (8 Mar 2027) therefore
 *    CANNOT be Halloween 2027 sell-through — that season has not sold yet.
 *    The POS record below is a prior-season restatement, and says so.
 *
 * 4. ARRIVALS ONLY. A signal reports what a system sent. It never asserts a
 *    conclusion; the gap it links to is where the conclusion lives.
 */

export type SignalSourceSystem =
  | "SAP S/4HANA"
  | "Kinaxis RapidResponse"
  | "Aera Technology"
  | "POS / Syndicated"
  | "EDI 850"
  | "EDI 852";

/** Every source system, in the order the sync strip lists them. */
export const SIGNAL_SOURCE_SYSTEMS: SignalSourceSystem[] = [
  "SAP S/4HANA",
  "Kinaxis RapidResponse",
  "Aera Technology",
  "EDI 850",
  "EDI 852",
  "POS / Syndicated",
];

export type SignalKind =
  | "customer_po"
  | "supplier_confirmation"
  | "pos_sell_through"
  | "item_master_change"
  | "bom_change"
  | "norm_alert"
  | "capacity_alert";

export const SIGNAL_KIND_LABEL: Record<SignalKind, string> = {
  customer_po: "Customer PO",
  supplier_confirmation: "Supplier confirmation",
  pos_sell_through: "Sell-through",
  item_master_change: "Item master",
  bom_change: "BOM / plant extension",
  norm_alert: "Norm setting",
  capacity_alert: "Capacity alert",
};

/**
 * How far the signal has got through Heizen's own pipeline. This is a
 * routing state, not a judgement about the underlying business fact.
 */
export type SignalDisposition =
  /** Landed and parsed; nothing in the current plan contradicts it. */
  | "ingested"
  /** Landed and matched to an open planning gap. */
  | "matched"
  /** Landed, but needs a planner decision before anything can consume it. */
  | "needs_review";

export const SIGNAL_DISPOSITION_LABEL: Record<SignalDisposition, string> = {
  ingested: "Ingested",
  matched: "Matched to gap",
  needs_review: "Needs review",
};

export interface SignalEntities {
  productId?: string;
  materialId?: string;
  lineId?: string;
  customerId?: string;
  eventId?: string;
}

export interface IngestionSignal {
  id: string;
  /** ISO-8601 UTC. Always <= DEMO_NOW — nothing arrives from the future. */
  receivedAt: string;
  sourceSystem: SignalSourceSystem;
  /** The document / IDoc / alert reference the source system stamped on it. */
  sourceRef: string;
  kind: SignalKind;
  /** One line, entity-first. */
  headline: string;
  /** What actually arrived, and what it does or does not let the plan do. */
  detail: string;
  entities: SignalEntities;
  /** A gap id from lib/planning-engine/gaps.ts, when the signal bears on one. */
  relatedGapId?: string;
  disposition: SignalDisposition;
}

// --- Facts read back out of the data layer, so no number below is typed twice ---

const film = materialById("mat_printed_film");
const filmSupplier = supplierForMaterial("mat_printed_film");
const filmPoCount = purchaseOrdersForMaterial("mat_printed_film").length;
const tin = materialById("mat_tin_trim");
const halloween = eventById("evt_halloween_2027");
const holiday = eventById("evt_holiday_2027");
const halloweenShipment = seasonalPhasesForEvent("evt_halloween_2027").find((p) => p.phase === "shipment")!;
const halloweenCommit = seasonalPhasesForEvent("evt_halloween_2027").find((p) => p.phase === "packaging_commit")!;
const halloweenFormal = currentFormalPlanValue("event", "evt_halloween_2027");
const pumpkins = productById("prod_halloween_variety_classic");
const clubTin = productById("prod_holiday_kroger_exclusive_tin");
const pdq = productById("prod_counter_display_standard");
const l01 = lineById("line_01");
const l02 = lineById("line_02");
const l03 = lineById("line_03");
const mclane = customerById("cust_mclane");
const samsClub = customerById("cust_sams_club");
const hall2026 = HISTORICAL_PERIODS.find((p) => p.id === "hist_halloween_2026")!;
const routing = lineMappingSummary();
const routedSharePct = Math.round(routing.misroutedShare * 100);

const usDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
const units = (n: number) => new Intl.NumberFormat("en-US").format(n);

/**
 * The log, newest last. `sortSignalsByRecency()` in
 * components/live/signal-feed.ts is what any surface should read — this
 * array's own order is authoring order and carries no meaning.
 *
 * All timestamps sit inside the 8 working days before DEMO_NOW
 * (2027-03-08T09:00Z), which is the close of Halloween's film-commit window.
 */
export const INGESTION_SIGNALS: IngestionSignal[] = [
  {
    id: "sig_aera_film_norm",
    receivedAt: "2027-03-01T04:15:00.000Z",
    sourceSystem: "Aera Technology",
    sourceRef: "NORM-PDT-2027-0311",
    kind: "norm_alert",
    headline: `Norm-setting alert — planned delivery time, ${film.name}`,
    detail: `Aera flagged the planned delivery time on ${film.name} (${film.unit}) as materially out of line with execution: the ERP norm is ${film.systemLeadTimeDays} days, while ${filmPoCount} PO-to-goods-receipt observations over the rolling 12-month window run a ${film.historicalMedianLeadTimeDays}-day median and a ${film.historicalP80LeadTimeDays}-day P80. Raised as a norm candidate, not applied.`,
    entities: { materialId: film.id },
    relatedGapId: "printed-film-lead-time",
    disposition: "matched",
  },
  {
    id: "sig_sap_bom_film_stuarts_draft",
    receivedAt: "2027-03-02T13:26:00.000Z",
    sourceSystem: "SAP S/4HANA",
    sourceRef: "CS02 / BOM 50041182-0001",
    kind: "bom_change",
    headline: `${film.name} extended to ${l03.plant}`,
    detail: `Component ${film.name} (${film.unit}) was extended to plant ${l03.plant} on the BOM for ${pumpkins.name}. The component is now valid where ${l03.name} carries the seasonal build; it does not change the quantity per unit, and the order-by date still computes off the ${usDate(halloween.productionWindow.start)} – ${usDate(halloween.productionWindow.end)} production window, never the sell-through window.`,
    entities: { materialId: film.id, productId: pumpkins.id, lineId: l03.id, eventId: halloween.id },
    relatedGapId: "halloween-2027",
    disposition: "ingested",
  },
  {
    id: "sig_sap_item_master_club_tin",
    receivedAt: "2027-03-03T09:41:00.000Z",
    sourceSystem: "SAP S/4HANA",
    sourceRef: "MM02 / IDoc MATMAS 0084417739",
    kind: "item_master_change",
    headline: `2026 club-exclusive Holiday tin set to Discontinued — no 2027 successor`,
    detail: `The 2026 predecessor of ${clubTin.name} moved to status Discontinued in the item master, with no successor material assigned. There is still no 2027 item, artwork, tin part number or BOM for the ${samsClub.name} exclusive, so MRP cannot see it — and ${tin.name} runs a ${tin.systemLeadTimeDays}-day system lead time against a Holiday build that opens ${usDate(holiday.productionWindow.start)}.`,
    entities: { productId: clubTin.id, customerId: samsClub.id, materialId: tin.id, eventId: holiday.id },
    relatedGapId: "holiday-gift-tins-representation",
    disposition: "needs_review",
  },
  {
    id: "sig_edi852_pos_halloween_2026",
    receivedAt: "2027-03-04T02:08:00.000Z",
    sourceSystem: "EDI 852",
    sourceRef: "852 / PRDSLS-2027-W09",
    kind: "pos_sell_through",
    headline: `Sell-through restatement received — ${hall2026.periodLabel}`,
    detail: `A retailer product-activity restatement closed out ${hall2026.periodLabel} sell-through (${usDate(hall2026.start)} – ${usDate(hall2026.end)}) at ${units(hall2026.actualUnits)} units, refreshing the historical base the seasonal profile is fitted against. No ${halloween.name} sell-through exists yet — that window is ${usDate(halloween.salesWindow.start)} – ${usDate(halloween.salesWindow.end)}, six months out.`,
    entities: { eventId: halloween.id },
    relatedGapId: "halloween-2027",
    disposition: "matched",
  },
  {
    id: "sig_kinaxis_l03_june_load",
    receivedAt: "2027-03-05T06:55:00.000Z",
    sourceSystem: "Kinaxis RapidResponse",
    sourceRef: "ALERT / CAP-L03-2027-06",
    kind: "capacity_alert",
    headline: `${l03.name} flagged over target in the June 2027 build bucket`,
    detail: `RapidResponse republished the constrained-resource alert for ${l03.name} (${l03.plant}) against the 2027-06 rough-cut bucket — the peak Halloween PRODUCTION month, not a sell month. The alert carries committed load only; the unresolved seasonal volume Heizen adds on top is not in RapidResponse's picture.`,
    entities: { lineId: l03.id, eventId: halloween.id },
    relatedGapId: "line-03-september-capacity",
    disposition: "matched",
  },
  {
    id: "sig_sap_routing_pdq_confirmations",
    receivedAt: "2027-03-05T18:30:00.000Z",
    sourceSystem: "SAP S/4HANA",
    sourceRef: "CO11N / batch 2027-064",
    kind: "bom_change",
    headline: `PDQ Display Shell extended to ${l01.name} for ${pdq.name}`,
    detail: `The display-shell component and its production version were extended to work centre ${l01.name}, matching where the work has actually been confirmed: ${routing.misroutedConfirmations} of ${routing.totalConfirmations} confirmations over the last 12 months (${routedSharePct}%) ran on ${l01.name} while the routing master still points at ${l02.name}. The routing master itself is unchanged, so RCCP still books the wrong work centre.`,
    entities: { productId: pdq.id, lineId: l01.id },
    relatedGapId: "counter-display-line-mapping",
    disposition: "needs_review",
  },
  {
    id: "sig_sap_film_supplier_confirmation",
    receivedAt: "2027-03-06T15:12:00.000Z",
    sourceSystem: "SAP S/4HANA",
    sourceRef: "ME12 / info record 5300019844",
    kind: "supplier_confirmation",
    headline: `${filmSupplier.name} confirmed a revised lead time on ${film.name}`,
    detail: `${filmSupplier.name} returned a revised planned delivery time against the purchasing info record for ${film.name} (${film.unit}), citing plate and art-approval turnaround on seasonal print. The ERP record still carries ${film.systemLeadTimeDays} days; observed execution runs a ${film.historicalP80LeadTimeDays}-day P80. Halloween's film commit window closes ${usDate(halloweenCommit.end)}.`,
    entities: { materialId: film.id, eventId: halloween.id },
    relatedGapId: "printed-film-lead-time",
    disposition: "matched",
  },
  {
    id: "sig_edi850_mclane_pumpkins",
    receivedAt: "2027-03-08T06:42:00.000Z",
    sourceSystem: "EDI 850",
    sourceRef: "850 / PO 4500219871",
    kind: "customer_po",
    headline: `${mclane.name} seasonal PO received — ${pumpkins.name}`,
    detail: `A seasonal sell-in purchase order landed from ${mclane.name} against the ${usDate(halloweenShipment.start)} – ${usDate(halloweenShipment.end)} shipment window. It has not been netted against the ${halloweenFormal.period} formal plan of ${units(halloweenFormal.value)} units yet, so the ordered quantity is not yet a planning number and is deliberately not shown as one.`,
    entities: { customerId: mclane.id, productId: pumpkins.id, eventId: halloween.id },
    relatedGapId: "halloween-2027",
    disposition: "ingested",
  },
];

/** The demo's "now" — the clock the freshness strip reads against. */
export const SIGNAL_CLOCK_NOW = DEMO_NOW;
