import * as React from "react";
import { Input as MantineInput } from "@mantine/core";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">
>(function Input(props, ref) {
  return <MantineInput ref={ref} {...props} />;
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-slate-700", className)} {...props} />;
}

export function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}
