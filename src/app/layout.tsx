import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "./globals.css";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { theme } from "@/lib/theme";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";

export const metadata: Metadata = {
  title: "CathClau Edu — Gestion scolaire",
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
      <body className="min-h-full" suppressHydrationWarning>
        <MantineProvider theme={theme}>
          <Notifications position="top-right" />
          <ModalsProvider>
            <QueryProvider>
              <AuthProvider>{children}</AuthProvider>
            </QueryProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
