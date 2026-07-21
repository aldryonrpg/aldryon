export function BrazilFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <rect width="60" height="30" fill="#009c3b" />
      <polygon points="30,4 56,15 30,26 4,15" fill="#ffdf00" />
      <circle cx="30" cy="15" r="8" fill="#002776" />
    </svg>
  );
}
