interface SproutIconProps {
  className?: string;
  title?: string;
}

export function SproutIcon({ className = 'h-6 w-6', title }: SproutIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path d="M16 29V15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M16 17c0-6-4-9-10-9 0 6 4 9 10 9z" className="fill-sprout-400" />
      <path d="M16 14c0-5 3.5-8 9-8 0 5-3.5 8-9 8z" className="fill-sprout-300" />
    </svg>
  );
}
