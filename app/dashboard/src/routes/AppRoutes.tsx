import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardDataProvider } from "@/hooks/useDashboardData";
import { DashboardLayout } from "@/app/layout/DashboardLayout";
import { translateDashboard } from "@/i18n/translations";

const OverviewRoute = lazy(() => import("./OverviewRoute").then((module) => ({ default: module.OverviewRoute })));
const DigitalTwinRoute = lazy(() => import("./DigitalTwinRoute").then((module) => ({ default: module.DigitalTwinRoute })));
const TelemetryRoute = lazy(() => import("./TelemetryRoute").then((module) => ({ default: module.TelemetryRoute })));
const AlarmsRoute = lazy(() => import("./AlarmsRoute").then((module) => ({ default: module.AlarmsRoute })));
const MaintenanceRoute = lazy(() => import("./MaintenanceRoute").then((module) => ({ default: module.MaintenanceRoute })));
const DeviceRoute = lazy(() => import("./DeviceRoute").then((module) => ({ default: module.DeviceRoute })));
const Twin3DRoute = lazy(() => import("./Twin3DRoute").then((module) => ({ default: module.Twin3DRoute })));

export const AppRoutes = () => (
  <DashboardDataProvider>
    {/*
      Static fallback stays in English only during initial bootstrap, before the
      language preference has been hydrated from the provider.
    */}
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600 dark:bg-noctua-950 dark:text-slate-300">
          {translateDashboard("en", "common.loading")}
        </div>
      }
    >
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<OverviewRoute />} />
          <Route path="/digital-twin" element={<DigitalTwinRoute />} />
          <Route path="/telemetry" element={<TelemetryRoute />} />
          <Route path="/alarms" element={<AlarmsRoute />} />
          <Route path="/maintenance" element={<MaintenanceRoute />} />
          <Route path="/device" element={<DeviceRoute />} />
        </Route>
        {/* Immersive full-bleed 3D twin lives outside the dashboard shell */}
        <Route path="/twin-3d" element={<Twin3DRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </DashboardDataProvider>
);
