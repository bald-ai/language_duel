import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit, Bebas_Neue } from "next/font/google";
import { ConvexClientProvider } from "@/app/components/convex-provider";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { themes, DEFAULT_THEME_NAME } from "@/lib/theme";
import "./globals.css";

// Source theme colors from centralized theme config
const defaultTheme = themes[DEFAULT_THEME_NAME].colors;

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LangDuel",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: defaultTheme.primary.DEFAULT,
  viewportFit: "cover",
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
          colorBackground: defaultTheme.background.elevated,
          colorInputBackground: defaultTheme.background.elevated,
          colorPrimary: defaultTheme.primary.DEFAULT,
          colorText: defaultTheme.text.DEFAULT,
          colorTextSecondary: defaultTheme.text.muted,
          colorNeutral: defaultTheme.text.DEFAULT,
          colorTextOnPrimaryBackground: defaultTheme.text.DEFAULT,
        },
      }}
    >
      <ConvexClientProvider>
        <html lang="en" suppressHydrationWarning>
          <body
            className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${bebasNeue.variable} antialiased`}
          >
            <ThemeProvider>
              {children}
              <Toaster richColors position="top-center" />
            </ThemeProvider>
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
