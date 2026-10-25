import type { Metadata } from 'next';
import './globals.css';
import { RagnarokProvider } from '@/lib/context/RagnarokContext';

export const metadata: Metadata = {
  title: 'Ragnarok | Sovereign AI Agent',
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
      <body className="bg-canvas text-main antialiased min-h-screen">
        <RagnarokProvider>{children}</RagnarokProvider>
      </body>
    </html>
  );
}
