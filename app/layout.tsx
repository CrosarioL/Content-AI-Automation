import type { Metadata } from 'next'
import {
  Inter,
  Montserrat,
  Oswald,
  Poppins,
  Nunito,
  Playfair_Display,
  Source_Code_Pro,
  Yesteryear,
  Abel,
  Libre_Baskerville,
} from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'

const inter = Inter({ subsets: ['latin'] })

// TikTok-style fonts for text overlays
const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
})

const oswald = Oswald({ 
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
})

const nunito = Nunito({ 
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
})

// TikTok in-app font lookalikes (open + legal)
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-playfair',
  display: 'swap',
})

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  variable: '--font-source-code-pro',
  display: 'swap',
})

const yesteryear = Yesteryear({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-yesteryear',
  display: 'swap',
})

const abel = Abel({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-abel',
  display: 'swap',
})

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-libre-baskerville',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Content Generator',
  description: 'AI social media content generation tool',
}

// Disable caching - force fresh data on every request
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} ${montserrat.variable} ${oswald.variable} ${poppins.variable} ${nunito.variable} ${playfair.variable} ${sourceCodePro.variable} ${yesteryear.variable} ${abel.variable} ${libreBaskerville.variable}`}
      >
        <div className="flex h-screen bg-background">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

