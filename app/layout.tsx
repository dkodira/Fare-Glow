import type { Metadata, Viewport } from "next";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";
import "./innovative.css";
import "./sunrise.css";

export const metadata: Metadata = {
  title: "Fare Glow — Find your best dates",
  description: "Find lower-priced return flight dates with Fare Glow.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf5ec",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
