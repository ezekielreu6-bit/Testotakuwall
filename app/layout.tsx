// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./global.css";
import { AuthProvider } from "@/components/AuthProvider";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "OTAKUWALL",
  appleWebApp: { title: 'OTAKUWALL', statusBarStyle: 'black-translucent', capable: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // THIS REMOVES THE WHITE GAP ON TOP
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body className={`${jakarta.variable} font-sans h-full w-full bg-black text-white antialiased m-0 p-0`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}