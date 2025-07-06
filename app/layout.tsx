import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <header className="w-full flex items-center justify-between px-6 py-4 bg-black/80 border-b border-yellow-400/20 shadow-lg z-50">
          <Link href="/" className="text-2xl font-extrabold text-yellow-400 hover:text-yellow-300 transition-colors">Maze Game</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
