import { Mail, MapPin, Phone } from "lucide-react";

const CONTACTS = [
  { icon: Mail, label: "Email", value: "support@hrpayroll.example.com" },
  { icon: Phone, label: "Phone", value: "+1 (555) 010-2024" },
  { icon: MapPin, label: "Office", value: "123 Market Street, Suite 400, San Francisco, CA" },
];

export function ContactPage() {
  return (
    <div>
      <div>
        <h1 className="page-title">Contact</h1>
        <p className="page-subtitle">Reach out with questions or support requests.</p>
      </div>

      <div className="card mt-6 max-w-2xl">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {CONTACTS.map((c) => (
            <li key={c.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <c.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.value}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
