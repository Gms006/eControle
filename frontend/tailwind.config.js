/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        certhub: {
          navy: "#0e2659",
          blue: "#22489c",
          ink: "#071226",
          mist: "#f3f6fc",
        },
        app: "hsl(var(--bg-app))",
        surface: "hsl(var(--bg-surface))",
        cardlayer: "hsl(var(--bg-card))",
        "border-subtle": "hsl(var(--border-subtle))",
        "border-strong": "hsl(var(--border-strong))",
        "text-primary": "hsl(var(--text-primary))",
        "text-muted": "hsl(var(--text-muted))",
        "status-ok": "hsl(var(--status-ok))",
        "status-warn": "hsl(var(--status-warn))",
        "status-danger": "hsl(var(--status-danger))",
        "status-info": "hsl(var(--status-info))",
        "brand-navy": "hsl(var(--brand-navy) / <alpha-value>)",
        "brand-navy-700": "hsl(var(--brand-navy-700) / <alpha-value>)",
        "brand-navy-soft": "hsl(var(--brand-navy-soft) / <alpha-value>)",
        "brand-navy-foreground": "hsl(var(--brand-navy-foreground) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(0,0,0,0.12)",
        panel: "0 12px 30px rgba(15, 23, 42, 0.08)",
        "card-hover": "0 14px 28px rgba(15, 23, 42, 0.12)",
      },
      borderRadius: {
        xl: "calc(var(--radius) - 4px)",
        "2xl": "var(--radius)",
        "3xl": "calc(var(--radius) + 8px)",
      },
    },
  },
  plugins: [],
};
