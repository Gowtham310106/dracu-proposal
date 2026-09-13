'use client';

import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * The five acupuncture points from the Acu Heal mark, arranged around a radiating centre.
 * Loading is shown as a pulse travelling point to point, the way a treatment works along a
 * meridian, rather than a generic spinner.
 *
 * Colours are the logo's own: red, green, gold, navy and stone.
 */
const POINTS = [
  { colour: 'var(--color-point-red)', angle: -90 },
  { colour: 'var(--color-point-yellow)', angle: -18 },
  { colour: 'var(--color-point-stone)', angle: 54 },
  { colour: 'var(--color-point-blue)', angle: 126 },
  { colour: 'var(--color-point-green)', angle: 198 },
];

const ORBIT = 30;
const CENTRE = 44;
const CYCLE = 1.6;

export function PointsSpinner({ size = 64, className, label = 'Loading' }: { size?: number; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 88 88" width={size} height={size} className={cn('acu-spin', className)} role="img" aria-label={label}>
      {/* hairlines radiating from the centre, as in the mark */}
      <g stroke="currentColor" strokeWidth="0.9" opacity="0.22">
        {POINTS.map((p) => {
          const rad = (p.angle * Math.PI) / 180;
          return <line key={p.angle} x1={CENTRE} y1={CENTRE} x2={CENTRE + Math.cos(rad) * ORBIT} y2={CENTRE + Math.sin(rad) * ORBIT} />;
        })}
      </g>

      <circle cx={CENTRE} cy={CENTRE} r="2.1" fill="currentColor" opacity="0.55" />

      {POINTS.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const cx = CENTRE + Math.cos(rad) * ORBIT;
        const cy = CENTRE + Math.sin(rad) * ORBIT;
        return (
          <g key={p.angle} className="acu-point" style={{ animationDelay: `${(i * CYCLE) / POINTS.length}s`, transformOrigin: `${cx}px ${cy}px` }}>
            <circle cx={cx} cy={cy} r="8.4" fill="none" stroke={p.colour} strokeWidth="4.6" />
            <circle cx={cx} cy={cy} r="2.4" fill={p.colour} />
          </g>
        );
      })}

      <style>{`
        .acu-spin { color: var(--color-brand-700); }
        .acu-point { animation: acu-pulse ${CYCLE}s ease-in-out infinite; opacity: .34; }
        @keyframes acu-pulse {
          0%, 62%, 100% { opacity: .34; transform: scale(1); }
          18%           { opacity: 1;   transform: scale(1.22); }
        }
        @media (prefers-reduced-motion: reduce) {
          .acu-point { animation: none; opacity: .8; }
        }
      `}</style>
    </svg>
  );
}

/**
 * Whole-screen loader used while the session is being restored or a route is resolving.
 * Shows the wordmark so a cold start still reads as the clinic's own software.
 */
export function BrandLoader({ label = 'Loading…', withLogo = true }: { label?: string; withLogo?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6">
      {withLogo && (
        <Image src="/brand/logo.png" alt="Dr. Bharath's Acu Heal" width={190} height={64} priority className="acu-fade opacity-90" />
      )}
      <PointsSpinner size={62} label={label} />
      <p className="acu-fade text-sm text-muted">{label}</p>
      <style>{`
        .acu-fade { animation: acu-in .5s ease-out both; }
        @keyframes acu-in { from { opacity: 0; transform: translateY(4px); } to { opacity: .9; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .acu-fade { animation: none; } }
      `}</style>
    </div>
  );
}

/** In-page loader for a panel or list that is still fetching. */
export function SectionLoader({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}>
      <PointsSpinner size={46} label={label} />
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
