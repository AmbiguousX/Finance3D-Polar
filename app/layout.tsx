import Provider from "@/app/provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://finance3d.com/"),
  title: {
    default: 'Finance3D - Advanced Financial Visualization',
    template: `%s | Finance3D`
  },
  description:
    "Transform complex financial data into intuitive 3D visualizations. Make better decisions with our advanced analytics platform.",
  keywords: ["finance", "3D visualization", "stock market", "financial data", "trading", "investment", "analytics"],
  authors: [{ name: "Finance3D Team" }],
  creator: "Finance3D",
  publisher: "Finance3D",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Finance3D - Advanced Financial Visualization",
    description:
      "Transform complex financial data into intuitive 3D visualizations. Make better decisions with our advanced analytics platform.",
    siteName: "Finance3D",
    images: [
      {
        url: "/images/finance3d-og.png",
        width: 1200,
        height: 630,
        alt: "Finance3D Platform"
      }
    ],
    url: "https://finance3d.com/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finance3D - Advanced Financial Visualization",
    description:
      "Transform complex financial data into intuitive 3D visualizations. Make better decisions with our advanced analytics platform.",
    creator: "@finance3d",
    images: [
      "/images/finance3d-twitter.png"
    ],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png" }
    ],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#5bbad5" }
    ]
  },
  manifest: "/site.webmanifest",
  applicationName: "Finance3D",
  category: "finance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider dynamic>
      <html lang="en" suppressHydrationWarning>
        <body className={GeistSans.className}>
          <Provider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </Provider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
