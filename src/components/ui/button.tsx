import * as React from "react";
import { Button as MantineButton, type ButtonProps as MantineButtonProps } from "@mantine/core";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    Pick<MantineButtonProps, "leftSection" | "rightSection" | "fullWidth"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** Maps the project's button vocabulary onto Mantine variants/colors. */
const VARIANT: Record<Variant, { variant: string; color?: string }> = {
  primary: { variant: "filled", color: "indigo" },
  secondary: { variant: "default" },
  ghost: { variant: "subtle", color: "gray" },
  danger: { variant: "filled", color: "red" },
};
const SIZE: Record<Size, string> = { sm: "sm", md: "md" };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, children, ...props },
  ref,
) {
  const v = VARIANT[variant];
  return (
    <MantineButton ref={ref} variant={v.variant} color={v.color} size={SIZE[size]} loading={loading} {...props}>
      {children}
    </MantineButton>
  );
});
