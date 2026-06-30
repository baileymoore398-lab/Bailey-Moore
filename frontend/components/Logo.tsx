import { cn } from "@/lib/utils";

const sizes = {
  sm: { box: "h-7 w-7", text: "text-base", tm: "text-[8px]" },
  md: { box: "h-8 w-8", text: "text-lg", tm: "text-[9px]" },
  lg: { box: "h-10 w-10", text: "text-2xl", tm: "text-[11px]" },
};

/** The RouteForge logo: an orienteering route mark + wordmark. */
export function Logo({
  size = "md",
  showText = true,
  showTrademark = false,
  className,
}: {
  size?: keyof typeof sizes;
  showText?: boolean;
  showTrademark?: boolean;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={s.box} />
      {showText && (
        <span className={cn("font-bold tracking-tight", s.text)}>
          Route<span className="text-accent">Forge</span>
          {showTrademark && (
            <span className={cn("align-super text-muted", s.tm)}>™</span>
          )}
        </span>
      )}
    </span>
  );
}

/** Just the square mark — usable standalone (favicons, avatars, badges). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="RouteForge"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient
          id="rf-mark"
          x1="6"
          y1="6"
          x2="58"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#34d977" />
          <stop offset="1" stopColor="#1c9e57" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#rf-mark)" />
      <path
        d="M7 45 Q21 37 32 43 T57 39"
        fill="none"
        stroke="#0b3a1f"
        strokeOpacity="0.28"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M15 50 L26 31 L38 41 L49 17"
        fill="none"
        stroke="#0a1a10"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 50 L26 31 L38 41 L49 17"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="50" r="4.6" fill="#ffffff" />
      <circle cx="15" cy="50" r="2" fill="#1c9e57" />
      <circle cx="49" cy="17" r="7.5" fill="none" stroke="#f97316" strokeWidth="3.6" />
      <circle cx="49" cy="17" r="2.7" fill="#f97316" />
    </svg>
  );
}
