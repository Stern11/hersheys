import { Badge } from "@/components/ui/badge";
import type { MaterialReadinessState } from "@/types/planning";

const READINESS_VARIANT: Record<MaterialReadinessState, "positive" | "neutral" | "warning" | "unknown"> = {
  plan_now: "positive",
  review: "neutral",
  monitor: "neutral",
  wait: "warning",
  unknown: "unknown",
};

const READINESS_LABEL: Record<MaterialReadinessState, string> = {
  plan_now: "Plan now",
  review: "Review",
  monitor: "Monitor",
  wait: "Wait",
  unknown: "Unknown",
};

export function MaterialReadinessBadge({ readiness }: { readiness: MaterialReadinessState }) {
  return <Badge variant={READINESS_VARIANT[readiness]}>{READINESS_LABEL[readiness]}</Badge>;
}
