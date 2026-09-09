export function AboutPage() {
  return (
    <div>
      <div>
        <h1 className="page-title">About</h1>
        <p className="page-subtitle">What this platform is and who it&apos;s for.</p>
      </div>

      <div className="card mt-6 max-w-2xl">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          The HR &amp; Payroll Platform brings employee records, attendance, leave, overtime, and
          payroll into a single system. HR admins manage the organization while employees track
          their own attendance, leave balances, overtime requests, and payslips in one place.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          It&apos;s built to keep everyday HR operations simple, transparent, and accurate for
          both administrators and staff.
        </p>
      </div>
    </div>
  );
}
