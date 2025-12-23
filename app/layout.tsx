import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit, Bebas_Neue } from "next/font/google";
import { ConvexClientProvider } from "@/app/components/convex-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Bebas Neue for display headings - bold, impactful display font
const bebasNeue = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Language-Duel",
  description: "Language learning app for couples",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorBackground: "#1a1a2e",
          colorInputBackground: "#1a1a2e",
          colorPrimary: "#3C34C5",
          colorText: "#F4F3F0",
          colorTextSecondary: "#A09C8E",
          colorNeutral: "#F4F3F0",
          colorTextOnPrimaryBackground: "#F4F3F0",
        },
      }}
    >
      <ConvexClientProvider>
        <html lang="en">
          <body
            className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${bebasNeue.variable} antialiased`}
          >
            {children}
            <Toaster richColors position="top-center" />
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
