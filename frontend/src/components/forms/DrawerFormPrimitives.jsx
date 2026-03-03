import React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const PRIMARY_BUTTON_CLASS =
  "bg-[#0e2659] text-white hover:bg-[#22489c] disabled:cursor-not-allowed disabled:opacity-70";

export function PrimaryButton({ className, ...props }) {
  return <Button className={cn(PRIMARY_BUTTON_CLASS, className)} {...props} />;
}

export function SecondaryButton({ className, variant = "outline", ...props }) {
  return <Button variant={variant} className={cn("border-slate-300 text-slate-700", className)} {...props} />;
}

export function FieldRow({ label, description, htmlFor, required = false, children, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="text-red-600"> *</span> : ""}
      </Label>
      {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      {children}
    </div>
  );
}

export function SectionCard({ title, description, children, className }) {
  return (
    <Card className={cn("rounded-2xl border-slate-200 shadow-sm", className)}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-sm text-slate-900">{title}</CardTitle>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
