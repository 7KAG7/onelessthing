import React from 'react'

export default function AvatarIcon({ id, size = 56 }: { id: string; size?: number }) {
  const common = { width: size, height: size }
  switch (id) {
    case 'sun':
      return (
        <svg {...common} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="32" cy="28" r="10" fill="#ffd166" />
        </svg>
      )
    case 'cloud':
      return (
        <svg {...common} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <ellipse cx="36" cy="34" rx="18" ry="10" fill="#e6eefc" />
          <ellipse cx="22" cy="36" rx="10" ry="7" fill="#eef5ff" />
        </svg>
      )
    case 'umbrella':
      return (
        <svg {...common} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M6 34 C18 20,46 20,58 34 Z" fill="#ffd1dc" />
          <rect x="30" y="34" width="4" height="18" rx="2" fill="#c8c8c8" />
        </svg>
      )
    case 'boots':
      return (
        <svg {...common} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="10" y="34" width="16" height="10" rx="4" fill="#fff" stroke="#e6e9ef" />
          <rect x="38" y="36" width="16" height="8" rx="4" fill="#fff" stroke="#e6e9ef" />
        </svg>
      )
    default:
      return (
        <svg {...common} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="32" cy="32" r="14" fill="#f3f4f6" />
        </svg>
      )
  }
}
