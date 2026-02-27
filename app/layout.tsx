import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google"; // Official Next.js Font handling
import "./global.css";
import { AuthProvider } from "@/components/AuthProvider";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: "OTAKUWALL • 4K Anime Wallpapers",
  description: "Free 4K Anime Wallpapers & Anime Shorts",
  appleWebApp: { title: 'OTAKUWALL', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Fixes safe area / notch issues
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} font-sans bg-black text-white antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}