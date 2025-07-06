'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ClientNavbar() {
  const pathname = usePathname()
  const isLandingPage = pathname === '/'
  if (isLandingPage) return null
  return (
    <header className="w-full flex items-center justify-between px-6 py-4 bg-black/80 border-b border-yellow-400/20 shadow-lg z-50">
      <Link href="/" className="text-2xl font-extrabold text-yellow-400 hover:text-yellow-300 transition-colors">Maze Game</Link>
    </header>
  )
} 