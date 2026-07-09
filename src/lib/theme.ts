"use client";

import { createTheme, type MantineColorsTuple } from "@mantine/core";

const SYSTEM_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Charte « CathClau Edu » dérivée du logo : bleu vif #2b6fe0 (600) + marine #16365a (800). */
const brand: MantineColorsTuple = [
  "#eef5ff", "#dbe8fe", "#bcd2fb", "#93b6f8", "#6a97f2",
  "#3b82f6", "#2b6fe0", "#1e4fa8", "#16365a", "#0f2744",
];

/** Shared Mantine theme: brand blue primary (logo-aligned), system font stack. */
export const theme = createTheme({
  colors: { brand },
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 6 },
  defaultRadius: "md",
  fontFamily: SYSTEM_FONT,
  headings: { fontFamily: SYSTEM_FONT },
  // Comfortable, consistent form fields across the app (clean admin style).
  components: {
    TextInput: { defaultProps: { size: "md" } },
    NativeSelect: { defaultProps: { size: "md" } },
    NumberInput: { defaultProps: { size: "md" } },
    Textarea: { defaultProps: { size: "md" } },
    PasswordInput: { defaultProps: { size: "md" } },
    // Dropdowns stylés (popover ombré, coche à droite, recherche fluide).
    MultiSelect: {
      defaultProps: {
        size: "md",
        checkIconPosition: "right",
        comboboxProps: { shadow: "md", radius: "md", transitionProps: { transition: "pop", duration: 150 } },
      },
    },
    Select: {
      defaultProps: {
        size: "md",
        checkIconPosition: "right",
        comboboxProps: { shadow: "md", radius: "md", transitionProps: { transition: "pop", duration: 150 } },
      },
    },
    Autocomplete: {
      defaultProps: {
        size: "md",
        comboboxProps: { shadow: "md", radius: "md", transitionProps: { transition: "pop", duration: 150 } },
      },
    },
    // Sélecteurs de date : calendrier en popover, format FR, ombre douce.
    DatePickerInput: {
      defaultProps: {
        size: "md",
        valueFormat: "DD/MM/YYYY",
        popoverProps: { shadow: "md", radius: "md", transitionProps: { transition: "pop", duration: 150 } },
      },
    },
  },
});
