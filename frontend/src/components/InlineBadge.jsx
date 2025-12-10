import React from "react";
import Chip from "@/components/Chip";

const COLOR_TOKEN = /^(bg-|text-|border-)/;

function InlineBadge({ children, className = "", variant = "solid", ...props }) {
  const mappedVariant = variant === "solid" ? "neutral" : variant === "plain" ? "outline" : variant;
  const sanitizedClassName = className
    .split(" ")
    .filter(Boolean)
    .filter((token) => !COLOR_TOKEN.test(token))
    .join(" ");

  return (
    <Chip variant={mappedVariant} className={sanitizedClassName} {...props}>
      {children}
    </Chip>
  );
}

export default InlineBadge;
