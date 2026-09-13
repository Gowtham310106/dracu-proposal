export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json({
    name: "Dr. Bharath's Acu Heal — Clinic Management",
    short_name: 'Acu Heal',
    description: 'Multi-branch acupuncture clinic management for patients, appointments, treatment packages, billing and accounts.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f6f7fb',
    theme_color: '#1f2a68',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: "Today's queue", url: '/doctor' },
      { name: 'Register patient', url: '/patients/new' },
      { name: 'Appointments', url: '/appointments' },
    ],
  });
}
