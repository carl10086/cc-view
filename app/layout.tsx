import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "cc-view | Claude Code Dashboard",
  description: "View and manage your Claude Code projects and sessions",
}

function Navbar() {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            cc-view
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/projects"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Projects
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
