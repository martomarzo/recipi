interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="#D97706" />
      {/* Fork — three tines */}
      <line x1="22" y1="12" x2="22" y2="26" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="29" y1="12" x2="29" y2="26" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="36" y1="12" x2="36" y2="26" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      {/* Fork bridge + handle */}
      <path
        d="M22 26 Q22 32 29 32 Q36 32 36 26"
        stroke="white"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="29" y1="32" x2="29" y2="52" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      {/* Spoon */}
      <ellipse cx="47" cy="19" rx="5" ry="7" stroke="white" strokeWidth="3.5" />
      <line x1="47" y1="26" x2="47" y2="52" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
