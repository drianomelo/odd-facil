import type { Metadata, Viewport } from 'next';
import { Urbanist, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-urbanist-loaded', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Odd Fácil - Análise Estatística de Basquete',
  description: 'Dashboard de oportunidades pré-jogo NBA com modelo estatístico próprio',
  metadataBase: new URL('https://odd-facil.vercel.app'),
  openGraph: {
    title: 'Odd Fácil',
    description: 'Análise estatística de basquete e seleção automática de oportunidades',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${urbanist.variable} ${mono.variable} antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-court-bg text-court-text min-h-screen">
        {children}
      </body>
    </html>
  );
}
