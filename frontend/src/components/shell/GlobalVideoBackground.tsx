'use client';

import React from 'react';

/**
 * GlobalVideoBackground
 * Mounts the high-fidelity CloudFront background video globally across all screens of MEMORAG.
 * Ensures seamless, uninterrupted playback during navigation across /, /tasks, /memory, /skills, /settings, /dashboard.
 */
export const GlobalVideoBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-50 overflow-hidden bg-black select-none"
    >
      <video
        className="w-full h-full object-cover opacity-80 dark:opacity-75 scale-[1.02] transform-gpu"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
          type="video/mp4"
        />
      </video>

      {/* Atmospheric Contrast Mesh: clean, translucent overlay allowing video to shine through with sharp UI contrast */}
      <div className="absolute inset-0 bg-black/35 dark:bg-black/45 pointer-events-none" />
    </div>
  );
};
