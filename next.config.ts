import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome pour une image Docker légère (server.js + assets nécessaires uniquement).
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Médias hébergés sur Cloudinary (photos élèves, logos…).
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  // Filet de sécurité pour les anciennes URLs suite au regroupement du menu en onglets (refonte
  // admin) — favoris, historique navigateur, liens éventuellement non mis à jour ailleurs.
  async redirects() {
    return [
      { source: "/personnel", destination: "/teachers/staff", permanent: false },
      { source: "/report-cards", destination: "/grading/report-cards", permanent: false },
      { source: "/discipline", destination: "/student-life/discipline", permanent: false },
      { source: "/health", destination: "/student-life/health", permanent: false },
      { source: "/bank-reconciliation", destination: "/accounting/reconciliation", permanent: false },
      { source: "/petty-cash", destination: "/accounting/petty-cash", permanent: false },
      { source: "/grants", destination: "/budget/grants", permanent: false },
      { source: "/expenses", destination: "/budget/expenses", permanent: false },
      { source: "/announcements", destination: "/communications/announcements", permanent: false },
      { source: "/templates", destination: "/communications/templates", permanent: false },
      { source: "/roles", destination: "/users/roles", permanent: false },
      { source: "/webhooks", destination: "/biometric/webhooks", permanent: false },
      { source: "/fees", destination: "/invoices/fees", permanent: false },
      { source: "/billing-rules", destination: "/invoices/rules", permanent: false },
      { source: "/re-enrollment", destination: "/enrollments/re-enrollment", permanent: false },
      { source: "/enrollment-movements", destination: "/enrollments/movements", permanent: false },
      { source: "/dashboard/rentree", destination: "/enrollments/overview", permanent: false },
    ];
  },
};

export default nextConfig;
