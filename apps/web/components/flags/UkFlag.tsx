export function UkFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <clipPath id="uk-flag-clip">
        <rect width="60" height="30" />
      </clipPath>
      <g clipPath="url(#uk-flag-clip)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 L25,15 M60,0 L35,15 M0,30 L25,15 M60,30 L35,15"
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}
