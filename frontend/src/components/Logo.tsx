import React from 'react';

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 28 }: LogoProps) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Argus">
      <defs>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) rotate(90) scale(28)">
          <stop offset="0%" stopColor="#00ff9f" stopOpacity="0.85"/>
          <stop offset="60%" stopColor="#00e5ff" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.15"/>
        </radialGradient>
        <linearGradient id="iris" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00e5ff"/>
          <stop offset="100%" stopColor="#00ff9f"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#glow)" opacity="0.55"/>
      <path d="M8 32C12 25 20 16 32 16C44 16 52 25 56 32C52 39 44 48 32 48C20 48 12 39 8 32Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <circle cx="32" cy="32" r="9" fill="url(#iris)" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
      <circle cx="30" cy="30" r="2" fill="#fff" opacity="0.8"/>
    </svg>
  );
}


