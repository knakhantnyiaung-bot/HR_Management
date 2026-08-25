import { useState } from "react";
import { OrganizationSettingsSection } from "@/features/organization/OrganizationSettingsSection";
import { DepartmentsAdmin } from "@/features/organization/DepartmentsAdmin";
import { PositionsAdmin } from "@/features/organization/PositionsAdmin";

const TABS = ["Organization", "Departments", "Positions"] as const;
type Tab = (typeof TABS)[number];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Organization");

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                tab === t
                  ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
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
      </div>
    </div>
  );
}
