import React from "react";
import { Chip } from "@/components/Chip";

function InlineBadge({ children, className = "", variant = "solid", ...props }) {
  const variantMap = {
    solid: "neutral",
    outline: "outline",
    plain: "outline",
  };

  return (
    <Chip variant={variantMap[variant] || "neutral"} className={className} {...props}>
      {children}
    </Chip>
  );
}

export default InlineBadge;
