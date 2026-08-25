import defaultTheme from "tailwindcss/defaultTheme";
import colors from "tailwindcss/colors";

/**
 * Design tokens.
 *
 * - `indigo` is overridden as the single primary brand ramp (deeper/more
 *   saturated than stock Tailwind indigo) so every existing `indigo-*`
 *   utility in the app picks up the refined palette automatically.
 * - `success` / `warning` / `danger` / `info` are semantic aliases onto
 *   Tailwind's own emerald/amber/rose/blue ramps, used for status framing
 *   (attendance, approvals, payroll) instead of ad-hoc color picks.
 * - Spacing (4/8/12/16/24/32/48) and the 12/14/16/20 type steps already
 *   match Tailwind's default scale 1:1; `title`/`display` fill in the
 *   28px/36px steps the default scale skips.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        indigo: {
          50: "#eef1ff",
          100: "#e0e5ff",
          200: "#c6cdff",
          300: "#a3adfd",
          400: "#7c86f9",
          500: "#5c5cf2",
          600: "#4638e0",
          700: "#392dbd",
          800: "#2f2699",
          900: "#28217a",
          950: "#191349",
        },
        success: colors.emerald,
        warning: colors.amber,
        danger: colors.rose,
        info: colors.blue,
      },
      fontSize: {
        title: ["28px", { lineHeight: "34px", letterSpacing: "-0.015em", fontWeight: "700" }],
        display: ["36px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        button: "var(--shadow-button)",
        popover: "var(--shadow-popover)",
      },
      backgroundImage: {
        "app-shell": "var(--app-shell-gradient)",
      },
    },
  },
  plugins: [],
};
