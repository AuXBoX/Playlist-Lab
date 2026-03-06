import type { FC } from 'react';

interface Props {
  serviceId: string;
  size?: number;
}

// Services that have real logo files in /public/service-logos/
const LOGO_MAP: Record<string, string> = {
  plex: '/service-logos/plex.png',
  spotify: '/service-logos/spotify.png',
  deezer: '/service-logos/deezer.png',
  youtube: '/service-logos/youtube.png',
  'youtube-music': '/service-logos/youtube-music.png',
  apple: '/service-logos/apple.png',
  amazon: '/service-logos/amazon.png',
  tidal: '/service-logos/tidal.png',
  qobuz: '/service-logos/qobuz.png',
  listenbrainz: '/service-logos/listenbrainz.png',
};

// Per-service scale multipliers — some logos are naturally smaller/larger
const SCALE_MAP: Record<string, number> = {
  spotify: 1.4,
  youtube: 1.1,
  'youtube-music': 1.8,
  amazon: 1.4,
  listenbrainz: 1.4,
};

export const ServiceIcon: FC<Props> = ({ serviceId, size = 40 }) => {
  const base = serviceId.split(':')[0];
  const logoSrc = LOGO_MAP[base];
  const scale = SCALE_MAP[base] ?? 1;
  const scaledSize = Math.round(size * scale);

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={base}
        width={scaledSize}
        height={scaledSize}
        style={{
          objectFit: 'contain',
          display: 'block',
        }}
      />
    );
  }

  // Fallback SVG for services without a logo file (aria, file, ai, unknown)
  return <FallbackIcon serviceId={base} size={size} />;
};

const FallbackIcon: FC<{ serviceId: string; size: number }> = ({ serviceId, size }) => {
  const label = serviceId.slice(0, 2).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#374151" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fill="white"
        fontSize="13"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
};
