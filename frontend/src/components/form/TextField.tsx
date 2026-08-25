import type { UseFormRegisterReturn } from "react-hook-form";

interface TextFieldProps {
  label: string;
  type?: string;
  registration: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
}

export function TextField({ label, type = "text", registration, error, placeholder }: TextFieldProps) {
  return (
    <div>
      <label
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        htmlFor={registration.name}
      >
        {label}
      </label>
      <input
        id={registration.name}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        {...registration}
      />
      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
