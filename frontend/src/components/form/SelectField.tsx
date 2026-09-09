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
      <label className="label-field" htmlFor={registration.name}>
        {label}
      </label>
      <select id={registration.name} className="input-field-inset w-full" {...registration}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="field-error-text">{error}</p>}
    </div>
  );
}
