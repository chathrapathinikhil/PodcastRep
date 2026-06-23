import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vidpod – Dynamic Ad Placement',
  description: 'Podcast ad placement tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
