import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Pill from "@/components/common/Pill";

export default function PageTitle({
  title,
  subtitle,
  right,
  chips = [],
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
  chips?: Array<{ label: string; variant?: "neutral" | "ok" | "warn" | "danger" | "info" }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-panel backdrop-blur sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Pill key={chip.label} variant={chip.variant ?? "neutral"}>
              {chip.label}
            </Pill>
          ))}
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </motion.div>
  );
}
