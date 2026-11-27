import React from 'react';

interface IdBadgeIconProps {
  className?: string;
  size?: number;
}

/**
 * IdBadgeIcon: Matches the user's reference badge image
 * featuring an ID badge with top lanyard clip, avatar profile, and detail lines.
 */
export const IdBadgeIcon: React.FC<IdBadgeIconProps> = ({
  className = 'w-4 h-4',
  size
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Top Clip Tab with Inner Slot */}
      <path
        d="M9.5 6V3.5C9.5 2.67 10.17 2 11 2H13C13.83 2 14.5 2.67 14.5 3.5V6"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="4" r="0.8" fill="currentColor" />

      {/* Main Badge Card Frame */}
      <rect
        x="3"
        y="6"
        width="18"
        height="15"
        rx="2.5"
        strokeWidth="1.8"
      />

      {/* Person Avatar: Head */}
      <circle
        cx="8.5"
        cy="11.2"
        r="1.8"
        fill="currentColor"
        strokeWidth="0"
      />

      {/* Person Avatar: Shoulders */}
      <path
        d="M5.8 16.5C5.8 14.8 7 14.2 8.5 14.2C10 14.2 11.2 14.8 11.2 16.5"
        strokeWidth="1.6"
      />

      {/* Information Lines on the Right */}
      <line
        x1="13.5"
        y1="11.5"
        x2="17.5"
        y2="11.5"
        strokeWidth="1.8"
      />
      <line
        x1="13.5"
        y1="14.5"
        x2="17.5"
        y2="14.5"
        strokeWidth="1.8"
      />
    </svg>
  );
};
