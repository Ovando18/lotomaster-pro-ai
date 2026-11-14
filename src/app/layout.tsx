import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/toast";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "LotoMaster Pro AI",
  description: "Gerador de jogos com fechamentos combinatórios, filtros estatísticos e conferência automática das Loterias CAIXA.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LotoMaster", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} antialiased`}>
        <StoreProvider>
          <ToastProvider>{children}</ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
