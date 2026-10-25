import type { Metadata } from 'next';
import './globals.css';
import { RagnarokProvider } from '@/lib/context/RagnarokContext';

export const metadata: Metadata = {
  title: 'MEMORAG | Sovereign AI Agent — Intelligence Designed To Evolve',
  description:
    'A sovereign personal AI agent running locally on this device with persistent memory, multi-step workflows, and complete user control.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts: Inter (Replicate UI), Newsreader (Claude Editorial Serif), JetBrains Mono (Code Wells) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&display=swap"
          rel="stylesheet"
        />

        {/* BubbledotICG-FinePos for Display Headline & Retro Glyphs */}
        <link
          href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos"
          rel="stylesheet"
        />

        {/* Font Awesome 6.5.2 for Enterprise Brand Icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="bg-canvas text-main antialiased min-h-screen selection:bg-[#ea2804]/20 selection:text-main">
        <RagnarokProvider>{children}</RagnarokProvider>
      </body>
    </html>
  );
}
