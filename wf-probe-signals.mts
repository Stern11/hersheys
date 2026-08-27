import { PURCHASE_ORDER_RECORDS, LINE_MAPPING_RECORDS, lineMappingSummary, leadTimeP80, OBSERVED_PERFORMANCE } from "@/data/synthetic/execution-history";
const film = PURCHASE_ORDER_RECORDS.filter(p=>p.materialId==="mat_printed_film"&&!p.excluded).sort((a,b)=>a.goodsReceiptDate<b.goodsReceiptDate?1:-1);
console.log("film latest GR", film.slice(0,3).map(f=>[f.id,f.poDate,f.goodsReceiptDate,f.elapsedDays,f.quantity]));
console.log("film sample", film.length, "p80", leadTimeP80("mat_printed_film"));
const lm=[...LINE_MAPPING_RECORDS].sort((a,b)=>a.date<b.date?1:-1);
console.log("lm latest", lm.slice(0,3));
console.log("summary", lineMappingSummary());
console.log("l03 rate", OBSERVED_PERFORMANCE.find(o=>o.metric==="run_rate_units_per_hour"&&o.scopeId==="line_03"));
