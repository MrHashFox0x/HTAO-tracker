import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HTAO/USDC // Hyperliquid Terminal",
  description:
    "Real-time market intelligence for the HTAO/USDC spot pair on Hyperliquid — volume, trades, traders, order book, flow and MM participation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
