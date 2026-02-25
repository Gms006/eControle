import { cn } from "@/lib/utils";

function getInitials(name?: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function CompanyAvatar({
  name,
  seed,
  className,
}: {
  name?: string;
  seed?: string | number;
  className?: string;
}) {
  const palette = [
    "from-sky-500 to-blue-600",
    "from-indigo-500 to-blue-700",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
  ];
  const hash = String(seed ?? name ?? "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = palette[hash % palette.length];

  return (
    <div
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-xs font-semibold text-white",
        color,
        className,
      )}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}
