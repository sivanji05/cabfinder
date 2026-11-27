import React from 'react';

interface CabFinderLogoProps {
  className?: string;
  size?: number;
}

/**
 * CabFinderLogo: The 1st original Searching Mirror icon
 * showing a cab framed inside a magnifying lens with headlights.
 */
export const CabFinderLogo: React.FC<CabFinderLogoProps> = ({
  className = 'w-6 h-6',
  size
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="CabFinder Search Lens Icon"
    >
      {/* Searching Mirror Outer Rim */}
      <circle
        cx="13"
        cy="13"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Searching Mirror Handle */}
      <path
        d="M20.2 20.2L28.5 28.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Lens Reflection / Search Highlight Arc */}
      <path
        d="M6.5 9.5C7.5 7 9.8 5.5 12.8 5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="opacity-40"
      />

      {/* Taxi Roof Beacon / Light */}
      <rect
        x="11.2"
        y="6.2"
        width="3.6"
        height="1.5"
        rx="0.6"
        fill="currentColor"
      />

      {/* Cab Windshield & Roof Frame */}
      <path
        d="M9.8 11L11.2 8.3H14.8L16.2 11H9.8Z"
        fill="currentColor"
      />

      {/* Main Cab Body */}
      <rect
        x="7.8"
        y="11"
        width="10.4"
        height="4"
        rx="1.2"
        fill="currentColor"
      />

      {/* Front Headlights (Bright Yellow Lens Flare) */}
      <circle cx="9.4" cy="13" r="0.95" fill="#FDE047" />
      <circle cx="16.6" cy="13" r="0.95" fill="#FDE047" />

      {/* Cab Grille Details */}
      <line
        x1="11.5"
        y1="13"
        x2="14.5"
        y2="13"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        className="opacity-75"
      />

      {/* Cab Wheels / Tires */}
      <rect x="8.6" y="14.8" width="2" height="1.8" rx="0.6" fill="currentColor" />
      <rect x="15.4" y="14.8" width="2" height="1.8" rx="0.6" fill="currentColor" />
    </svg>
  );
};
