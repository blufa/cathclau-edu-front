"use client";

import Link from "next/link";
import { Button, type ButtonProps } from "./button";

/**
 * A Button that navigates via next/link. Lives in a client component so it can be used from
 * server components (which can't pass the Link function as a prop to a client component).
 */
export function LinkButton({ href, children, ...props }: ButtonProps & { href: string }) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  );
}
