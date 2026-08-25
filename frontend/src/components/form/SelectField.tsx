import type { UseFormRegisterReturn } from "react-hook-form";

interface SelectFieldProps {
  label: string;
  registration: UseFormRegisterReturn;
  options: Array<{ value: string; label: string }>;
  error?: string;
  placeholder?: string;
}

export function SelectField({ label, registration, options, error, placeholder }: SelectFieldProps) {
  return (
    <div>
      <label
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        htmlFor={registration.name}
      >
        {label}
      </label>
      <select
        id={registration.name}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        {...registration}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
