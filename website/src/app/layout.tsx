import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Foundry - Autonomous Development That Works While You Sleep',
  description: 'Foundry works on your Linear tickets autonomously. Create a ticket, go to sleep, wake up to a PR. AI-powered development that actually ships code.',
  keywords: 'autonomous development, ai coding, linear integration, ai agent, code generation, automated programming',
  openGraph: {
    type: 'website',
    url: 'https://foundry.dev/',
    title: 'Foundry - Autonomous Development That Works While You Sleep',
    description: 'Foundry works on your Linear tickets autonomously. Create a ticket, go to sleep, wake up to a PR.',
    images: [{ url: '/og-image.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Foundry - Autonomous Development That Works While You Sleep',
    description: 'Foundry works on your Linear tickets autonomously. Create a ticket, go to sleep, wake up to a PR.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
