"use client";

import { createTheme } from "@mantine/core";

const SYSTEM_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Shared Mantine theme: indigo primary to match the existing palette, system font stack. */
export const theme = createTheme({
  primaryColor: "indigo",
  defaultRadius: "md",
  fontFamily: SYSTEM_FONT,
  headings: { fontFamily: SYSTEM_FONT },
});
