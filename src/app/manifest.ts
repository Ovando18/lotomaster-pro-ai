import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LotoMaster Pro AI",
    short_name: "LotoMaster",
    description: "Fechamentos, filtros estatísticos e conferência das Loterias CAIXA",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
