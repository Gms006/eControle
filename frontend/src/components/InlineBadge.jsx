import React from "react";
import { Chip } from "@/components/Chip";

function InlineBadge({ children, className = "", variant = "solid", ...props }) {
  const variantMap = {
    solid: "neutral",
    outline: "outline",
    plain: "outline",
  };

  const resolvedVariant = variantMap[variant] || "neutral";

  return (
    <Chip variant={resolvedVariant} className={className} {...props}>
      {children}
    </Chip>
  );
}

export default InlineBadge;
