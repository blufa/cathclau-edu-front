import * as React from "react";
import { NativeSelect } from "@mantine/core";

/** Native select backed by Mantine; keeps the children-<option> API used across the app. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">
>(function Select({ children, ...props }, ref) {
  return (
    <NativeSelect ref={ref} {...props}>
      {children}
    </NativeSelect>
  );
});
