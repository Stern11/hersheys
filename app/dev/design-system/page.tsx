import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { HISTORICAL_PERIODS } from "@/data/synthetic/historical-demand";
import { listMethodologies } from "@/lib/methodology/registry";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PlanningGapChart, type PlanningGapChartRow } from "@/components/charts/planning-gap-chart";
import { EffectiveCapacityChart } from "@/components/charts/effective-capacity-chart";
import { MethodologyBadge } from "@/components/methodology/methodology-badge";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { ConfidenceBand } from "@/components/planning/confidence-band";
import { MaterialReadinessBadge } from "@/components/planning/material-readiness-badge";
import { PlanningBasisCard } from "@/components/planning/planning-basis-card";

const PLANNING_STATE_TOKENS = ["formal", "validated", "inferred", "scenario", "historical", "unknown"] as const;
const RISK_TOKENS = ["positive", "warning", "critical"] as const;

export default function DesignSystemPage() {
  const gaps = detectPlanningGaps();
  const halloween = gaps.find((g) => g.gap.id === "halloween-2027")!;
  const printedFilm = gaps.find((g) => g.gap.id === "printed-film-lead-time")!;
  const valentines = gaps.find((g) => g.gap.id === "valentines-premium-tin")!;

  const gapChartRows: PlanningGapChartRow[] = [
    ...HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_halloween_2027" && !p.isAtypical).map((p) => ({ period: p.periodLabel, actual: p.actualUnits })),
    { period: "Halloween 2027 (Expected)", low: halloween.gap.expectedValueLow, high: halloween.gap.expectedValueHigh, base: (halloween.gap.expectedValueLow + halloween.gap.expectedValueHigh) / 2 },
  ];

  return (
    <div className="flex flex-col gap-12 pb-24">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight">Design System</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-[var(--text-secondary)]">
          Visual language for Heizen Planning Gap Intelligence — professional planning density, methodology transparency, and the formal/validated/inferred/scenario/historical/unknown state
          palette used consistently across every chart and table.
        </p>
      </header>

      {/* Typography */}
      <Section title="Typography">
        <div className="flex flex-col gap-2">
          <div className="text-[22px] font-semibold tracking-tight">Page title — 22px semibold</div>
          <div className="text-[15px] font-semibold">Section title — 15px semibold</div>
          <div className="text-[13px] font-medium">Body / label — 13px medium</div>
          <div className="text-[12px] text-[var(--text-secondary)]">Secondary body — 12px</div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Eyebrow / muted — 11px uppercase</div>
          <div className="font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">halloween-2027 · 2027-08-24T09:00:00Z — mono for IDs/timestamps</div>
          <div className="text-[20px] font-semibold tabular-nums">4,752,000 units — tabular numerals for comparison</div>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      {/* Planning state + risk palette */}
      <Section title="Planning state palette" description="Categorical — chart/table provenance layers. Never reused for risk.">
        <div className="flex flex-wrap gap-2">
          {PLANNING_STATE_TOKENS.map((t) => (
            <Badge key={t} variant={t}>
              {t}
            </Badge>
          ))}
        </div>
      </Section>
      <Section title="Risk palette" description="Reserved for status/severity only.">
        <div className="flex flex-wrap gap-2">
          {RISK_TOKENS.map((t) => (
            <Badge key={t} variant={t}>
              {t}
            </Badge>
          ))}
          <Badge variant="neutral">neutral</Badge>
        </div>
      </Section>

      {/* Confidence + readiness */}
      <Section title="Confidence &amp; material readiness">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Confidence band</CardTitle>
              <CardDescription>Valentine&apos;s Premium Tin — analogue-derived BOM confidence</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfidenceBand confidence={valentines.gap.confidence} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Material readiness states</CardTitle>
              <CardDescription>How ready each BOM material is to plan against</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <MaterialReadinessBadge readiness="plan_now" />
              <MaterialReadinessBadge readiness="review" />
              <MaterialReadinessBadge readiness="monitor" />
              <MaterialReadinessBadge readiness="wait" />
              <MaterialReadinessBadge readiness="unknown" />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Methodology */}
      <Section title="Methodology transparency">
        <div className="flex flex-wrap gap-2">
          {listMethodologies()
            .slice(0, 4)
            .map((m) => (
              <MethodologyBadge key={m.id} methodologyId={m.id} whySelected={halloween.planningBasis.whySelected} />
            ))}
        </div>
      </Section>

      {/* Planning basis card */}
      <Section title="Planning basis card" description="The reusable Result / Methodology / Basis / Confidence / Control pattern">
        <div className="max-w-sm">
          <PlanningBasisCard
            resultLabel="Expected Halloween 2027 demand"
            resultValue={`${(halloween.gap.expectedValueLow / 1_000_000).toFixed(1)}M–${(halloween.gap.expectedValueHigh / 1_000_000).toFixed(1)}M units`}
            basis={halloween.planningBasis}
            confidence={halloween.gap.confidence}
          />
        </div>
      </Section>

      {/* Signature Visual 1 */}
      <Section title="Signature visual — Planning Gap Curve" description={halloween.gap.title}>
        <Card>
          <CardContent className="pt-4">
            <PlanningGapChart data={gapChartRows} formalValue={halloween.gap.formalValue} />
          </CardContent>
        </Card>
      </Section>

      {/* Signature Visual 2 */}
      <Section title="Signature visual — Effective Capacity" description="Line 03 vs. Line 01/04, September 2027, from the live scenario engine">
        <Card>
          <CardContent className="pt-4">
            <EffectiveCapacityChart data={halloween.scenarioResult!.capacityImpact} />
          </CardContent>
        </Card>
      </Section>

      {/* Evidence panel */}
      <Section title="Evidence panel" description={`Printed Film lead time — ${printedFilm.evidence.length} PO/GR records shown`}>
        <EvidencePanel evidence={printedFilm.evidence.slice(0, 6)} />
      </Section>

      {/* Assumption inputs */}
      <Section title="Assumption inputs" description="Scenario Lab control primitives">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Historical lookback</Label>
            <Input type="number" defaultValue={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Lead-time basis</Label>
            <Select defaultValue="historical">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="historical">Historical</SelectItem>
                <SelectItem value="scenario">Scenario</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2.5">
            <Label>Target headroom</Label>
            <Slider defaultValue={[10]} max={30} step={1} />
          </div>
          <div className="flex items-center gap-2.5 pt-5">
            <Switch id="include-atypical" />
            <Label htmlFor="include-atypical" className="normal-case tracking-normal text-[var(--text-secondary)]">
              Include atypical year
            </Label>
          </div>
        </div>
      </Section>

      {/* Tabs */}
      <Section title="Tabs">
        <Tabs defaultValue="demand">
          <TabsList>
            <TabsTrigger value="demand">Demand</TabsTrigger>
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
          </TabsList>
          <TabsContent value="demand" className="pt-2 text-[12.5px] text-[var(--text-secondary)]">
            Demand controls panel.
          </TabsContent>
          <TabsContent value="capacity" className="pt-2 text-[12.5px] text-[var(--text-secondary)]">
            Capacity controls panel.
          </TabsContent>
          <TabsContent value="materials" className="pt-2 text-[12.5px] text-[var(--text-secondary)]">
            Materials controls panel.
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {description && <p className="text-[12px] text-[var(--text-muted)]">{description}</p>}
      </div>
      {children}
    </section>
  );
}
