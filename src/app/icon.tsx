import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#D97706',
          borderRadius: 14,
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="42"
          height="48"
          viewBox="0 0 42 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fork — three tines */}
          <line x1="8" y1="1" x2="8" y2="14" stroke="white" stroke-width="3.5" stroke-linecap="round" />
          <line x1="15" y1="1" x2="15" y2="14" stroke="white" stroke-width="3.5" stroke-linecap="round" />
          <line x1="22" y1="1" x2="22" y2="14" stroke="white" stroke-width="3.5" stroke-linecap="round" />
          {/* Fork bridge + handle */}
          <path d="M8 14 Q8 20 15 20 Q22 20 22 14" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <line x1="15" y1="20" x2="15" y2="47" stroke="white" stroke-width="3.5" stroke-linecap="round" />
          {/* Spoon */}
          <ellipse cx="34" cy="9" rx="5" ry="8" stroke="white" stroke-width="3.5" />
          <line x1="34" y1="17" x2="34" y2="47" stroke="white" stroke-width="3.5" stroke-linecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
