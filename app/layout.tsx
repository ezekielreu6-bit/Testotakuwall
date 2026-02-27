// app/layout.tsx
import './global.css'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata = { title: 'OTAKUWALL', description: 'Free 4K Anime Wallpapers & Shorts' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-sans overflow-x-hidden antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}