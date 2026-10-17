import { useId } from "react";

type LogoProps = { className?: string };

function useLogoId() {
  return `lg${useId().replace(/:/g, "")}`;
}

export function OfficeStudioLogo({ className }: LogoProps) {
  const id = useLogoId();
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#EE8DB4" />
          <stop offset=".5" stopColor="#B57DC8" />
          <stop offset="1" stopColor="#7457C2" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(12 8) rotate(50) scale(30 24)">
          <stop offset="0" stopColor="#FFC4D9" stopOpacity=".75" />
          <stop offset="1" stopColor="#FFC4D9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-gloss`} x1="24" y1="0" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" /></clipPath>
        <filter id={`${id}-shadow`} x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1" stdDeviation=".9" floodColor="#4A2A8C" floodOpacity=".35" />
        </filter>
      </defs>
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-bg)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-glow)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-gloss)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" stroke="#fff" strokeOpacity=".24" strokeWidth="2" clipPath={`url(#${id}-clip)`} />
      <g fill="#fff" filter={`url(#${id}-shadow)`}>
        <rect x="12" y="12" width="10.5" height="10.5" rx="2.6" />
        <circle cx="30.75" cy="17.25" r="5.4" fillOpacity=".9" />
        <path d="M12 36V30.75A5.25 5.25 0 0 1 17.25 25.5H22.5V30.75A5.25 5.25 0 0 1 17.25 36Z" fillOpacity=".9" />
        <path d="M30.75 26.6L35.9 35.3H25.6Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function OfficeStudioMark({ className }: LogoProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.75" />
      <circle cx="16.5" cy="7.5" r="3.6" />
      <path d="M4 20V16.5A3.5 3.5 0 0 1 7.5 13H11V16.5A3.5 3.5 0 0 1 7.5 20Z" />
      <path d="M16.5 13.75L19.9 19.6H13.1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function PrototypeLogo({ className }: LogoProps) {
  const id = useLogoId();
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7CC0FF" />
          <stop offset=".55" stopColor="#4C84F2" />
          <stop offset="1" stopColor="#3A4FD4" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="24" y1="0" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".24" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" /></clipPath>
        <filter id={`${id}-shadow`} x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1" stdDeviation=".9" floodColor="#1B2F8F" floodOpacity=".38" />
        </filter>
      </defs>
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-bg)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-gloss)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" stroke="#fff" strokeOpacity=".24" strokeWidth="2" clipPath={`url(#${id}-clip)`} />
      <g filter={`url(#${id}-shadow)`}>
        <rect x="9" y="12" width="26" height="21" rx="3.5" fill="#fff" />
        <rect x="12" y="15" width="20" height="3" rx="1.5" fill="#4C7EEE" fillOpacity=".3" />
        <rect x="12" y="20.5" width="8" height="9.5" rx="1.75" fill="#4C7EEE" fillOpacity=".55" />
        <rect x="22.5" y="21" width="9.5" height="2.2" rx="1.1" fill="#4C7EEE" fillOpacity=".45" />
        <rect x="22.5" y="25" width="6" height="2.2" rx="1.1" fill="#4C7EEE" fillOpacity=".3" />
        <circle cx="35" cy="12.5" r="4.6" fill="#FFB42E" stroke="#fff" strokeWidth="1.6" />
        <path d="M34.4 11.1L35.3 10.6V14.5" stroke="#fff" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28.2 25.6V37.4L31.3 34.6L33.5 39.4L35.7 38.4L33.6 33.7L37.7 33.4Z" fill="#fff" stroke="#2E47C2" strokeWidth="1.3" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function PaintLogo({ className }: LogoProps) {
  const id = useLogoId();
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC069" />
          <stop offset=".5" stopColor="#FF7E5F" />
          <stop offset="1" stopColor="#E8467A" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="24" y1="0" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".24" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-stroke`} x1="10" y1="34" x2="25" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" /></clipPath>
        <filter id={`${id}-shadow`} x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1" stdDeviation=".9" floodColor="#9A2340" floodOpacity=".38" />
        </filter>
      </defs>
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-bg)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-gloss)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" stroke="#fff" strokeOpacity=".24" strokeWidth="2" clipPath={`url(#${id}-clip)`} />
      <g filter={`url(#${id}-shadow)`}>
        <path d="M11.5 34.5C13.5 30.2 16.6 29.4 18 31.6C19.4 33.8 21.9 32.4 23.2 27.4" stroke={`url(#${id}-stroke)`} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
        <g transform="translate(29.4 19.2) rotate(40)">
          <rect x="-2.4" y="-13.5" width="4.8" height="10.5" rx="2.4" fill="#fff" />
          <rect x="-3.1" y="-3.6" width="6.2" height="3.8" rx="1" fill="#FFE2D2" />
          <path d="M-3.1 0.2H3.1C3.1 4.2 1.7 7.2 0 9.4C-1.7 7.2 -3.1 4.2 -3.1 0.2Z" fill="#7A1F4A" />
        </g>
      </g>
    </svg>
  );
}

export function SlidesLogo({ className }: LogoProps) {
  const id = useLogoId();
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EE6C4" />
          <stop offset=".55" stopColor="#1FB59C" />
          <stop offset="1" stopColor="#0E8A88" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="24" y1="0" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".24" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" /></clipPath>
        <filter id={`${id}-shadow`} x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1" stdDeviation=".9" floodColor="#0A5753" floodOpacity=".4" />
        </filter>
      </defs>
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-bg)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" fill={`url(#${id}-gloss)`} />
      <path d="M13 0H35C43 0 48 5 48 13V35C48 43 43 48 35 48H13C5 48 0 43 0 35V13C0 5 5 0 13 0Z" stroke="#fff" strokeOpacity=".24" strokeWidth="2" clipPath={`url(#${id}-clip)`} />
      <g filter={`url(#${id}-shadow)`}>
        <path d="M24 31V35.2M24 35.2L19.2 38.6M24 35.2L28.8 38.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="11" width="30" height="20.5" rx="3.2" fill="#fff" />
        <rect x="12.5" y="14.5" width="10" height="2.4" rx="1.2" fill="#14A08F" fillOpacity=".4" />
        <rect x="13" y="23" width="3.6" height="5" rx="1.1" fill="#14A08F" fillOpacity=".45" />
        <rect x="18.4" y="20.5" width="3.6" height="7.5" rx="1.1" fill="#14A08F" fillOpacity=".7" />
        <rect x="23.8" y="18" width="3.6" height="10" rx="1.1" fill="#F6AE2D" />
        <circle cx="32.6" cy="22.4" r="3.6" fill="#14A08F" fillOpacity=".25" />
        <path d="M32.6 22.4V18.8A3.6 3.6 0 0 1 36.2 22.4Z" fill="#14A08F" fillOpacity=".8" />
      </g>
    </svg>
  );
}
