import * as React from "react";
import { Badge as MantineBadge } from "@mantine/core";

type Tone = "gray" | "green" | "amber" | "red" | "indigo" | "blue";

/** Maps the project's tone vocabulary onto Mantine colors. */
const TONE_COLOR: Record<Tone, string> = {
  gray: "gray",
  green: "green",
  amber: "yellow",
  red: "red",
  indigo: "indigo",
  blue: "blue",
};

export function Badge({
  tone = "gray",
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <MantineBadge color={TONE_COLOR[tone]} variant="light" radius="sm" className={className}>
      {children}
    </MantineBadge>
  );
}
