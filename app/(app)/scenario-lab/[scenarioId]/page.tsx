import { ScenarioLabView } from "@/components/scenario/scenario-lab-view";

export default async function ScenarioLabScenarioPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  return <ScenarioLabView scenarioId={scenarioId} />;
}
