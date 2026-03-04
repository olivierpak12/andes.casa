import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Playfair_Display } from "next/font/google";
import ClerkProviderWrapper from "./ClerkProvider";
import "./globals.css";
import NextAuthSessionProvider from "./SessionProvider";
import { ToasterWrapper } from "./ToasterWrapper";
import ConvexClientProvider from "./ConvexClientProvider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ANDES - Empowering a Global Sharing Economy",
  description: "ANDES - Empowering a Global Sharing Economy for Tomorrow's Leaders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${playfairDisplay.variable} antialiased`}
      >
        <NextAuthSessionProvider>
          {/* <ClerkProviderWrapper> */}
          <ConvexClientProvider>

            <main>

              {children}
            </main>
           <Toaster/>
          {/* </ClerkProviderWrapper> */}
          </ConvexClientProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}