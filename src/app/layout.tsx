import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { theme } from "@/lib/theme";
import { AuthProvider } from "@/providers/auth-provider";

export const metadata: Metadata = {
  title: "LacaÉducation",
  description: "Plateforme de gestion d'établissements scolaires",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" {...mantineHtmlProps} className="h-full antialiased">
      <head>
        <ColorSchemeScript />
      </head>
      <body className="min-h-full">
        <MantineProvider theme={theme}>
          <AuthProvider>{children}</AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
