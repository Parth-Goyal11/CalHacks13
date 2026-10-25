import type { IconName } from "./sky-data";

export function SkyIcon({
  name,
  size = 24,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home")
    return (
      <svg {...common}>
        <path d="M3.5 16.5c2.8-5.4 13.8-5.8 17 0" />
        <path d="M7 18.7h10" />
        <path d="m12.5 4 .6 1.8L15 6.5l-1.9.7-.6 1.8-.7-1.8-1.8-.7 1.8-.7z" />
      </svg>
    );
  if (name === "explore")
    return (
      <svg {...common}>
        <ellipse
          cx="12"
          cy="12"
          rx="8.2"
          ry="4.7"
          transform="rotate(-28 12 12)"
        />
        <path d="m13 7 .65 1.8 1.85.7-1.85.65L13 12l-.65-1.85-1.85-.65 1.85-.7z" />
        <circle cx="5.1" cy="16.3" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "gallery")
    return (
      <svg {...common}>
        <rect x="4.5" y="6.5" width="13" height="12" rx="2.3" />
        <path d="m7 15 2.9-3 2.2 2.1 1.5-1.4 3.8 3.8" />
        <path d="M8 4.2h9.8a2 2 0 0 1 2 2v8" />
        <circle cx="14.4" cy="10.2" r=".8" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg {...common}>
        <rect x="4" y="5.5" width="16" height="14" rx="3" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" />
        <path d="m11.9 12.1.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z" />
      </svg>
    );
  if (name === "camera")
    return (
      <svg {...common}>
        <path d="M8.5 5.5 10 3.8h4l1.5 1.7h2.8a2.2 2.2 0 0 1 2.2 2.2v9.6a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2V7.7a2.2 2.2 0 0 1 2.2-2.2z" />
        <path d="M15.9 10.4a4.2 4.2 0 1 1-2.5-2.4" />
        <path
          d="m18.2 2.7.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z"
          fill="currentColor"
        />
      </svg>
    );
  if (name === "bell")
    return (
      <svg {...common}>
        <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5 2 6 2 6h-15s2-1 2-6Z" />
        <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
        <circle cx="18.6" cy="5.1" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "upload")
    return (
      <svg {...common}>
        <path d="M5 17.5c2.7-3.1 11.5-3.3 14 0" />
        <path d="M12 14V5m0 0L8.7 8.3M12 5l3.3 3.3" />
        <circle cx="18.4" cy="9.1" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "bookmark")
    return (
      <svg {...common}>
        <path d="M6.5 5.5A2.5 2.5 0 0 1 9 3h6a2.5 2.5 0 0 1 2.5 2.5V21L12 17.3 6.5 21z" />
        <circle cx="17.5" cy="5" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "close")
    return (
      <svg {...common}>
        <path d="m7 7 10 10M17 7 7 17" />
        <circle cx="19" cy="5" r=".8" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "arrow")
    return (
      <svg {...common}>
        <path d="M5 12h13m-5-5 5 5-5 5" />
        <circle cx="5" cy="12" r=".8" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "location")
    return (
      <svg {...common}>
        <path d="M18 10c0 4-6 10-6 10S6 14 6 10a6 6 0 1 1 12 0Z" />
        <circle cx="12" cy="10" r="1.7" />
      </svg>
    );
  if (name === "plus")
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
        <circle cx="18.5" cy="5.5" r=".8" fill="currentColor" stroke="none" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4z" />
      <circle cx="18.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconButton({
  label,
  icon,
  onClick,
  active,
  className = "",
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <SkyIcon name={icon} />
    </button>
  );
}
