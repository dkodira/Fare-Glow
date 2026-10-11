import type { Metadata, Viewport } from "next";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";
import "./innovative.css";

export const metadata: Metadata = {
  title: "Fare Glow — Find your best dates",
  description: "Find lower-priced return flight dates with Fare Glow.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10263c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
