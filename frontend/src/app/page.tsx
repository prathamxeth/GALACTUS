'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState([
    { icon: '<', value: '0ms', label: 'Inference Time', target: 120, decimals: 0, suffix: 'ms' },
    { icon: '%', value: '0.00%', label: 'Platform Uptime', target: 99.99, decimals: 2, suffix: '%' },
    { icon: '*', value: '0/7', label: 'Autonomous Runtime', target: 24, decimals: 0, suffix: '/7' },
    { icon: '#', value: '0.0M', label: 'Context Windows', target: 2.4, decimals: 1, suffix: 'M' },
  ]);

  const statsRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Close mobile menu on Escape key or resize
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    const handleResize = () => {
      if (window.innerWidth > 720) setMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Stats count-up animation
  useEffect(() => {
    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;

          stats.forEach((stat, idx) => {
            const duration = 1500 + idx * 80;
            const delay = 480 + idx * 90;

            setTimeout(() => {
              const startTime = performance.now();

              function update(currentTime: number) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const currentVal = (easeOutCubic(progress) * stat.target).toFixed(stat.decimals);

                setStats((prev) => {
                  const copy = [...prev];
                  copy[idx] = {
                    ...copy[idx],
                    value: progress < 1 ? `${currentVal}${stat.suffix}` : `${stat.target.toFixed(stat.decimals)}${stat.suffix}`,
                  };
                  return copy;
                });

                if (progress < 1) {
                  requestAnimationFrame(update);
                }
              }

              requestAnimationFrame(update);
            }, delay);
          });
        }
      },
      { threshold: 0.25 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className={`landing-root ${menuOpen ? 'menu-open' : ''}`}>
      {/* Fallback & Custom Font Styles */}
      <style jsx global>{`
        @font-face {
          font-family: 'Geist Pixel Circle';
          src: url('/fonts/GeistPixel-Circle.woff2') format('woff2');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }

        :root {
          --landing-bg: #000000;
          --landing-text: #ffffff;
          --landing-muted: #8e8e8e;
          --landing-nav-text: #2e2e2e;
          --landing-pill-dark: #28282a;
          --landing-sign-in-text: #c8c8c8;
          --landing-nav-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
          --landing-trust-bg: #28282a;
          --landing-trust-border: rgba(255, 255, 255, 0.4);
          --landing-trust-text: #c4c2c3;
          --landing-font-sans: 'Inter', 'Segoe UI', system-ui, sans-serif;
          --landing-font-display: 'BubbledotICG-FinePos', 'Geist Pixel Circle', monospace;
        }

        .landing-root {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          background-color: var(--landing-bg);
          color: var(--landing-text);
          font-family: var(--landing-font-sans);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          z-index: 50;
        }

        /* Background Video */
        .landing-bg-video-wrapper {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background-color: var(--landing-bg);
          z-index: 0;
        }

        .landing-bg-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          pointer-events: none;
          z-index: 0;
        }

        /* 3 Vertical Regions Layout */
        .landing-page {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          padding: clamp(16px, 2.4vh, 28px) clamp(14px, 3vw, 32px);
          box-sizing: border-box;
        }

        /* Header */
        .landing-site-header {
          flex-shrink: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          z-index: 10;
          animation: landingSlideDown 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .landing-header-row {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 720px;
          gap: clamp(18px, 2.8vw, 28px);
        }

        /* Circular Logo */
        .landing-logo-btn {
          width: clamp(40px, 4.4vw, 46px);
          height: clamp(40px, 4.4vw, 46px);
          border-radius: 50%;
          background: #ffffff;
          box-shadow: var(--landing-nav-shadow);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          text-decoration: none;
          transition: transform 0.25s ease;
          cursor: pointer;
        }

        .landing-logo-btn:hover {
          transform: scale(1.04);
        }

        .landing-logo-btn img {
          width: 72%;
          height: 72%;
          object-fit: contain;
          display: block;
        }

        /* Nav Pill */
        .landing-nav-pill {
          flex: 1;
          max-width: 430px;
          height: clamp(44px, 5.2vw, 48px);
          background: #ffffff;
          border-radius: 999px;
          box-shadow: var(--landing-nav-shadow);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px;
        }

        .landing-nav-link {
          font-family: var(--landing-font-sans);
          font-weight: 500;
          font-size: clamp(13px, 1.4vw, 15px);
          letter-spacing: -0.01em;
          color: var(--landing-nav-text);
          text-decoration: none;
          padding: 8px 12px;
          border-radius: 999px;
          opacity: 0.5;
          transition: opacity 0.2s ease;
          position: relative;
          white-space: nowrap;
        }

        .landing-nav-link:hover {
          opacity: 0.75;
        }

        .landing-nav-link.active {
          opacity: 1;
        }

        .landing-nav-link.active::after {
          content: '';
          position: absolute;
          bottom: 5px;
          left: 50%;
          width: 3px;
          height: 3px;
          background: #000000;
          border-radius: 50%;
          transform: translateX(-50%);
          box-shadow: -5px 0 0 #000000, 5px 0 0 #000000;
        }

        /* Sign In Pill */
        .landing-signin-btn {
          height: clamp(44px, 5.2vw, 48px);
          background: var(--landing-pill-dark);
          color: var(--landing-sign-in-text);
          border-radius: 999px;
          box-shadow: var(--landing-nav-shadow);
          padding: 0 clamp(18px, 2.2vw, 24px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--landing-font-sans);
          font-weight: 500;
          font-size: clamp(13px, 1.4vw, 15px);
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .landing-signin-btn:hover {
          background: #323234;
          color: #ffffff;
          transform: translateY(-1px);
        }

        /* Mobile Burger */
        .landing-mobile-burger {
          display: none;
        }

        /* Hero */
        .landing-hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          max-width: 900px;
          width: 100%;
        }

        /* Trust Row */
        .landing-trust-row {
          --trust-size: clamp(36px, 4.5vw, 42px);
          display: inline-flex;
          align-items: center;
          margin-bottom: clamp(16px, 2.5vh, 26px);
        }

        .landing-trust-avatar {
          width: var(--trust-size);
          height: var(--trust-size);
          background: var(--landing-trust-bg);
          border: 1px solid var(--landing-trust-border);
          border-radius: 50%;
          padding: 5px;
          display: grid;
          place-items: center;
          transition: transform 0.35s ease;
          position: relative;
          flex-shrink: 0;
        }

        .landing-trust-avatar.a1 {
          z-index: 1;
        }

        .landing-trust-avatar.a2 {
          z-index: 2;
          margin-left: calc(var(--trust-size) * -0.42);
        }

        .landing-trust-avatar.a3 {
          z-index: 4;
          margin-left: calc(var(--trust-size) * -0.42);
        }

        .landing-trust-avatar.a1:hover {
          transform: translateY(-2px);
        }

        .landing-trust-avatar.a2:hover {
          transform: translateY(-4px);
        }

        .landing-trust-avatar.a3:hover {
          transform: translateY(-2px);
        }

        .landing-avatar-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .landing-avatar-inner i {
          color: #111111;
          font-size: calc(var(--trust-size) * 0.34);
        }

        .landing-trust-pill {
          height: var(--trust-size);
          background: var(--landing-trust-bg);
          border: 1px solid var(--landing-trust-border);
          border-radius: 999px;
          margin-left: calc(var(--trust-size) * -0.42);
          padding-left: calc(var(--trust-size) * 0.58);
          padding-right: clamp(12px, 1.8vw, 18px);
          display: flex;
          align-items: center;
          color: var(--landing-trust-text);
          font-family: var(--landing-font-sans);
          font-weight: 500;
          font-size: clamp(12px, 1.4vw, 13.5px);
          white-space: nowrap;
          user-select: none;
        }

        /* Headline */
        .landing-headline {
          font-family: var(--landing-font-display);
          font-weight: 400;
          color: #ffffff;
          font-size: clamp(28px, 6.2vw, 80px);
          letter-spacing: -0.04em;
          line-height: 1.12;
          white-space: nowrap;
          overflow: hidden;
          margin-bottom: clamp(14px, 2vh, 22px);
          user-select: none;
        }

        .landing-headline-line {
          display: block;
          opacity: 0;
          animation: landingHeadlineFade 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .landing-headline-line.line1 {
          animation-delay: 0.12s;
        }

        .landing-headline-line.line2 {
          animation-delay: 0.3s;
        }

        /* Subhead */
        .landing-subhead {
          max-width: min(500px, 92%);
          font-family: var(--landing-font-sans);
          font-weight: 400;
          font-size: clamp(calc(13.5px + 2pt), calc(1.55vw + 2pt), calc(16.5px + 2pt));
          line-height: 1.55;
          color: #d0d0d0;
          opacity: 0.8;
          margin-bottom: clamp(20px, 3vh, 32px);
        }

        /* CTA */
        .landing-cta-wrapper {
          display: flex;
          justify-content: center;
        }

        .landing-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #000000;
          font-family: var(--landing-font-sans);
          font-weight: 600;
          font-size: clamp(13.5px, 1.5vw, 14.5px);
          padding: clamp(11px, 1.6vh, 13px) clamp(22px, 3vw, 28px);
          border-radius: 999px;
          text-decoration: none;
          white-space: nowrap;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15),
                      0 0 22px rgba(255, 255, 255, 0.32),
                      0 0 44px rgba(255, 255, 255, 0.12);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          cursor: pointer;
        }

        .landing-cta-btn:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25),
                      0 0 28px rgba(255, 255, 255, 0.48),
                      0 0 56px rgba(255, 255, 255, 0.2);
        }

        /* Stats Footer */
        .landing-stats-footer {
          flex-shrink: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          z-index: 10;
        }

        .landing-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          width: 100%;
          max-width: 920px;
          gap: clamp(12px, 2vw, 24px);
        }

        .landing-stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 2px;
        }

        .landing-stat-icon {
          font-family: var(--landing-font-display);
          font-size: clamp(22px, 3vw, 33px);
          color: #ffffff;
          line-height: 1;
          margin-bottom: 2px;
          user-select: none;
        }

        .landing-stat-value {
          font-family: var(--landing-font-sans);
          font-weight: 600;
          font-size: clamp(18px, 2.2vw, 26px);
          letter-spacing: -0.025em;
          color: #ffffff;
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
        }

        .landing-stat-label {
          font-family: var(--landing-font-sans);
          font-size: clamp(11px, 1.2vw, 12.5px);
          color: var(--landing-muted);
          line-height: 1.3;
        }

        /* Animations */
        .landing-anim {
          opacity: 0;
          transform: translateY(22px) scale(0.98);
          filter: blur(6px);
          animation: landingReveal 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: var(--d, 0s);
        }

        .landing-cta-wrapper.landing-anim {
          animation-name: landingRevealPulse;
        }

        @keyframes landingReveal {
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes landingRevealPulse {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.96);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes landingSlideDown {
          from {
            opacity: 0;
            transform: translateY(-18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes landingHeadlineFade {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Mobile Breakpoints */
        @media (max-width: 720px) {
          .landing-header-row {
            justify-content: space-between;
            max-width: 100%;
          }

          .landing-nav-pill,
          .landing-site-header .landing-signin-btn {
            display: none;
          }

          .landing-logo-btn {
            width: 48px;
            height: 48px;
          }

          .landing-mobile-burger {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #28282a;
            border: none;
            box-shadow: var(--landing-nav-shadow);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            z-index: 101;
            transition: background 0.28s ease, transform 0.2s ease;
          }

          .landing-mobile-burger:active {
            transform: scale(0.96);
          }

          .landing-burger-bar {
            width: 18px;
            height: 1.5px;
            background: #ffffff;
            border-radius: 1px;
            transition: transform 0.28s ease, background 0.28s ease, opacity 0.2s ease;
          }

          .landing-root.menu-open .landing-mobile-burger {
            background: #ffffff;
          }

          .landing-root.menu-open .landing-burger-bar {
            background: #000000;
          }

          .landing-root.menu-open .landing-burger-bar:nth-child(1) {
            transform: translateY(5.5px) rotate(45deg);
          }

          .landing-root.menu-open .landing-burger-bar:nth-child(2) {
            opacity: 0;
          }

          .landing-root.menu-open .landing-burger-bar:nth-child(3) {
            transform: translateY(-5.5px) rotate(-45deg);
          }

          .landing-mobile-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.62);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            z-index: 90;
          }

          .landing-mobile-menu {
            position: fixed;
            top: clamp(72px, 10vh, 88px);
            left: 16px;
            right: 16px;
            max-width: 420px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 28px;
            padding: 22px 18px 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }

          .landing-mobile-nav-link {
            font-family: var(--landing-font-sans);
            font-weight: 500;
            font-size: 15px;
            color: var(--landing-nav-text);
            text-decoration: none;
            padding: 10px 16px;
            width: 100%;
            text-align: center;
            border-radius: 999px;
            opacity: 0.6;
            position: relative;
            transition: opacity 0.2s ease, background 0.15s ease;
          }

          .landing-mobile-nav-link:hover {
            opacity: 0.85;
            background: rgba(0, 0, 0, 0.04);
          }

          .landing-mobile-nav-link.active {
            opacity: 1;
            font-weight: 600;
          }

          .landing-mobile-nav-link.active::after {
            content: '';
            position: absolute;
            bottom: 8px;
            left: 50%;
            width: 3px;
            height: 3px;
            background: #000000;
            border-radius: 50%;
            transform: translateX(-50%);
            box-shadow: -5px 0 0 #000000, 5px 0 0 #000000;
          }

          .landing-mobile-signin-btn {
            width: 100%;
            height: 46px;
            margin-top: 6px;
            background: var(--landing-pill-dark);
            color: var(--landing-sign-in-text);
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--landing-font-sans);
            font-weight: 500;
            font-size: 14.5px;
            text-decoration: none;
            transition: background 0.2s ease, color 0.2s ease;
          }

          .landing-mobile-signin-btn:hover {
            background: #323234;
            color: #ffffff;
          }

          .landing-headline {
            letter-spacing: -0.08em;
            line-height: 1.05;
          }

          .landing-stats-grid {
            grid-template-columns: repeat(2, 1fr);
            row-gap: 16px;
          }
        }

        @media (max-width: 420px) {
          .landing-trust-row {
            --trust-size: 34px;
          }

          .landing-trust-pill {
            font-size: 12px;
          }

          .landing-headline {
            letter-spacing: -0.09em;
            line-height: 1.04;
          }
        }

        @media (max-height: 700px) {
          .landing-page {
            padding-top: 12px;
            padding-bottom: 12px;
          }

          .landing-trust-row {
            margin-bottom: 12px;
          }

          .landing-headline {
            margin-bottom: 10px;
          }

          .landing-subhead {
            margin-bottom: 16px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }

          .landing-anim,
          .landing-headline-line,
          .landing-site-header {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }

          .landing-headline {
            color: #ffffff !important;
          }
        }
      `}</style>

      {/* Full-viewport cover video behind all UI */}
      <div className="landing-bg-video-wrapper">
        <video className="landing-bg-video" autoPlay muted loop playsInline>
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      <div className="landing-page">
        {/* 1) Header */}
        <header className="landing-site-header">
          <div className="landing-header-row">
            {/* Logo */}
            <Link href="/" className="landing-logo-btn" aria-label="Home">
              <img src="/assets/logo.webp" alt="" width="52" height="52" />
            </Link>

            {/* Desktop Nav Pill (White) */}
            <nav className="landing-nav-pill" aria-label="Primary navigation">
              <Link href="/" className="landing-nav-link active">
                Home
              </Link>
              <Link href="/dashboard" className="landing-nav-link">
                Product
              </Link>
              <Link href="/tasks" className="landing-nav-link">
                Case Studies
              </Link>
              <Link href="/settings" className="landing-nav-link">
                Contact
              </Link>
            </nav>

            {/* Desktop Sign In (Dark Pill) -> Navigates to Dashboard */}
            <Link href="/dashboard" className="landing-signin-btn">
              Sign in
            </Link>

            {/* Mobile Burger Button */}
            <button
              className="landing-mobile-burger"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="landing-burger-bar"></span>
              <span className="landing-burger-bar"></span>
              <span className="landing-burger-bar"></span>
            </button>
          </div>
        </header>

        {/* 2) Hero */}
        <main className="landing-hero">
          {/* Trust row (“Trusted by 2000+ Enterprises”) */}
          <div className="landing-trust-row landing-anim" style={{ '--d': '0.05s' } as React.CSSProperties}>
            <div className="landing-trust-avatar a1">
              <div className="landing-avatar-inner">
                <i className="fa-brands fa-microsoft"></i>
              </div>
            </div>
            <div className="landing-trust-avatar a2">
              <div className="landing-avatar-inner">
                <i className="fa-brands fa-amazon"></i>
              </div>
            </div>
            <div className="landing-trust-avatar a3">
              <div className="landing-avatar-inner">
                <i className="fa-brands fa-google"></i>
              </div>
            </div>
            <div className="landing-trust-pill">Trusted by 2000+ Enterprises</div>
          </div>

          {/* Headline */}
          <h1 className="landing-headline">
            <span className="landing-headline-line line1">Intelligence</span>
            <span className="landing-headline-line line2">Designed To Evolve</span>
          </h1>

          {/* Subhead */}
          <p className="landing-subhead landing-anim" style={{ '--d': '0.28s' } as React.CSSProperties}>
            Build applications that reason, adapt and collaborate using a modular AI platform designed for production.
          </p>

          {/* CTA Button -> Launches Dashboard */}
          <div className="landing-cta-wrapper landing-anim" style={{ '--d': '0.4s' } as React.CSSProperties}>
            <Link href="/dashboard" className="landing-cta-btn">
              Get Started
            </Link>
          </div>
        </main>

        {/* 3) Stats Footer */}
        <footer className="landing-stats-footer" ref={statsRef}>
          <div className="landing-stats-grid">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="landing-stat-item landing-anim"
                style={{ '--d': `${0.5 + i * 0.08}s` } as React.CSSProperties}
              >
                <div className="landing-stat-icon">{stat.icon}</div>
                <div className="landing-stat-value">{stat.value}</div>
                <div className="landing-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </footer>
      </div>

      {/* Mobile Overlay & Sheet Menu */}
      {menuOpen && (
        <>
          <div className="landing-mobile-overlay" onClick={() => setMenuOpen(false)}></div>
          <div className="landing-mobile-menu">
            <Link href="/" className="landing-mobile-nav-link active" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
            <Link href="/dashboard" className="landing-mobile-nav-link" onClick={() => setMenuOpen(false)}>
              Product
            </Link>
            <Link href="/tasks" className="landing-mobile-nav-link" onClick={() => setMenuOpen(false)}>
              Case Studies
            </Link>
            <Link href="/settings" className="landing-mobile-nav-link" onClick={() => setMenuOpen(false)}>
              Contact
            </Link>
            <Link href="/dashboard" className="landing-mobile-signin-btn" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
