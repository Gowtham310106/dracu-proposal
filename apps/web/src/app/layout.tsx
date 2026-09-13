import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

const CLINIC = process.env.NEXT_PUBLIC_CLINIC_NAME ?? "Dr. Bharath's Acu Heal";

export const metadata: Metadata = {
  title: { default: `${CLINIC} — Clinic Management`, template: `%s · ${CLINIC}` },
  description: 'Multi-branch acupuncture clinic management: patients, appointments, treatment packages, billing, CRM and accounts.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/brand/logo.png', apple: '/brand/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Acu Heal', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#1f2a68',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
