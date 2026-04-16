import { MaintenanceLane } from "@/components/maintenance/MaintenanceLane";
import { OperationalAiPanel } from "@/components/maintenance/OperationalAiPanel";
import { useDashboardData } from "@/hooks/useDashboardData";

export const MaintenanceRoute = () => {
  const { snapshot } = useDashboardData();

  return (
    <div className="space-y-8">
      <OperationalAiPanel ai={snapshot.ai} />
      <div className="grid gap-6 xl:grid-cols-3">
        <MaintenanceLane category="corrective" items={snapshot.maintenance.filter((item) => item.category === "corrective")} />
        <MaintenanceLane category="preventive" items={snapshot.maintenance.filter((item) => item.category === "preventive")} />
        <MaintenanceLane category="predictive" items={snapshot.maintenance.filter((item) => item.category === "predictive")} />
      </div>
    </div>
  );
};
