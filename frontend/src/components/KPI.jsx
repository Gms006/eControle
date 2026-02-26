import React from "react";
import StatCard from "@/components/common/StatCard";

function KPI({ title, value, icon, accent }) {
  return (
    <StatCard
      label={title}
      value={value}
      icon={icon}
      accentClassName={accent}
    />
  );
}

export default KPI;
