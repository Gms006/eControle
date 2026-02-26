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
  // Marca institucional (navy): #0e2659
  // Mantém variação sutil (opcional) via seed -> 2 tons próximos
  const palette = [
    "from-[#0e2659] to-[#163a7a]",
    "from-[#0e2659] to-[#1b438b]",
    "from-[#0e2659] to-[#12346f]",
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
