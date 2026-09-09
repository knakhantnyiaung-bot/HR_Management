import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { JobPostingsAdmin } from "@/features/recruitment/JobPostingsAdmin";
import { ApplicationsPipeline } from "@/features/recruitment/ApplicationsPipeline";
import { HiringManagersAdmin } from "@/features/recruitment/HiringManagersAdmin";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);
const TABS = ["Pipeline", "Postings", "Hiring Managers"] as const;
type Tab = (typeof TABS)[number];

export function RecruitmentPage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));
  const [tab, setTab] = useState<Tab>("Pipeline");
  const visibleTabs = isHrRole ? TABS : (["Pipeline"] as const);

  return (
    <div>
      <div>
        <h1 className="page-title">Recruitment</h1>
        <p className="page-subtitle">Job postings, candidate pipeline, interviews, and offers.</p>
      </div>

      {isHrRole && (
        <div className="mt-6 border-b border-slate-200 dark:border-slate-800">
          <nav className="-mb-px flex gap-6">
            {visibleTabs.map((t) => (
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
      )}

      <div className="mt-4">
        {(!isHrRole || tab === "Pipeline") && <ApplicationsPipeline />}
        {isHrRole && tab === "Postings" && <JobPostingsAdmin />}
        {isHrRole && tab === "Hiring Managers" && <HiringManagersAdmin />}
      </div>
    </div>
  );
}
