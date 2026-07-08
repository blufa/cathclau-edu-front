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
};

export default nextConfig;
