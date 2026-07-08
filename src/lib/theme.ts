"use client";

import { createTheme } from "@mantine/core";

const SYSTEM_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Shared Mantine theme: teal primary (Skolengo-style accent), system font stack. */
export const theme = createTheme({
  primaryColor: "teal",
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
