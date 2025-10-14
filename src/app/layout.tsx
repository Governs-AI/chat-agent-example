import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GovernsAI Demo Chat',
  description: 'A demo chat application showcasing precheck-before-every-call governance pattern',
  keywords: ['AI', 'governance', 'chat', 'precheck', 'demo'],
  authors: [{ name: 'GovernsAI Team' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <SessionProvider>
          <div className="min-h-screen bg-gray-50">
            <main className="h-screen max-w-4xl mx-auto bg-white shadow-sm">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  )
}
