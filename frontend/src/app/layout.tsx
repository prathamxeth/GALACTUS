import type { Metadata } from 'next';
import './globals.css';
import { RagnarokProvider } from '@/lib/context/RagnarokContext';
import { ForgeProvider } from '@/lib/forge/ForgeContext';

export const metadata: Metadata = {
  title: 'MEMORAG Forge | Sovereign Local-First AI IDE',
  description:
    'A sovereign, local-first AI-native development environment with persistent project memory, on-device inspector, flight recorder, and approval-gated recovery.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="bg-canvas text-main antialiased min-h-screen selection:bg-[#ea2804]/20 selection:text-main">
        <RagnarokProvider>
          <ForgeProvider>{children}</ForgeProvider>
        </RagnarokProvider>
      </body>
    </html>
  );
}

