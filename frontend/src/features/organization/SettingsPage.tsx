import { useState } from "react";
import { OrganizationSettingsSection } from "@/features/organization/OrganizationSettingsSection";
import { DepartmentsAdmin } from "@/features/organization/DepartmentsAdmin";
import { PositionsAdmin } from "@/features/organization/PositionsAdmin";
import { GeofenceSettingsSection } from "@/features/geofence/GeofenceSettingsSection";

const TABS = ["Organization", "Departments", "Positions", "Geofence"] as const;
type Tab = (typeof TABS)[number];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Organization");

  return (
    <div>
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Organization profile, departments, and positions.
        </p>
      </div>

      <div className="mt-6 border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex gap-6">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4">
        {tab === "Organization" && <OrganizationSettingsSection />}
        {tab === "Departments" && <DepartmentsAdmin />}
        {tab === "Positions" && <PositionsAdmin />}
        {tab === "Geofence" && <GeofenceSettingsSection />}
      </div>
    </div>
  );
}
