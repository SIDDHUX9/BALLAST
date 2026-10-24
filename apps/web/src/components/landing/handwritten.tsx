import React from 'react';

interface HandwrittenProps {
  children: React.ReactNode;
  className?: string;
  rotation?: string; // e.g. "-rotate-3" or "rotate-6"
  arrow?: 'curved-down-left' | 'curved-down-right' | 'curved-right' | 'none';
  underline?: boolean;
}

export function Handwritten({
  children,
  className = '',
  rotation = '-rotate-3',
  arrow = 'none',
  underline = false,
}: HandwrittenProps) {
  return (
    <div
      className={`inline-flex flex-col font-hand text-[#CA461E] font-bold tracking-wider uppercase select-none pointer-events-none transition-transform ${rotation} ${className}`}
    >
      <div className="leading-[1.15] text-[15px] sm:text-[17px] md:text-[19px] whitespace-pre-line text-center sm:text-left">
        {children}
      </div>

      {/* Hand-drawn underline stroke */}
      {underline && (
        <svg
          viewBox="0 0 140 14"
          className="w-full h-3 mt-0.5 text-[#CA461E] stroke-current"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 8 C 35 12, 85 4, 137 7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Hand-drawn curved arrow pointing down and left */}
      {arrow === 'curved-down-left' && (
        <div className="mt-1 self-start sm:self-center w-10 sm:w-12 h-10 sm:h-12 text-[#CA461E]">
          <svg
            viewBox="0 0 54 54"
            className="w-full h-full stroke-current"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M44 8 C 40 26, 26 38, 10 42"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 42 L 20 38"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 42 L 14 30"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Hand-drawn curved arrow pointing right toward pointing finger */}
      {arrow === 'curved-right' && (
        <div className="mt-1 self-center sm:self-end w-12 sm:w-16 h-8 sm:h-10 text-[#CA461E]">
          <svg
            viewBox="0 0 64 36"
            className="w-full h-full stroke-current"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 24 C 20 30, 42 28, 56 16"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M56 16 L 44 14"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M56 16 L 48 26"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
