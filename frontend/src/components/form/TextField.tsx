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
      <label className="label-field" htmlFor={registration.name}>
        {label}
      </label>
      <input
        id={registration.name}
        type={type}
        placeholder={placeholder}
        className="input-field-inset w-full"
        {...registration}
      />
      {error && <p className="field-error-text">{error}</p>}
    </div>
  );
}
