/**
 * INTELLIGENCE DESIGNED TO EVOLVE — JAVASCRIPT
 * Count-up animation & mobile navigation interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initStatsCountUp();
});

/* --------------------------------------------------------------------------
   Mobile Sheet Menu
   -------------------------------------------------------------------------- */
function initMobileMenu() {
  const burgerBtn = document.querySelector('.mobile-burger');
  const overlay = document.querySelector('.mobile-overlay');
  const menu = document.querySelector('.mobile-menu');
  const links = document.querySelectorAll('.mobile-nav-link, .mobile-signin-btn');

  if (!burgerBtn || !overlay || !menu) return;

  function openMenu() {
    burgerBtn.setAttribute('aria-expanded', 'true');
    overlay.removeAttribute('hidden');
    menu.removeAttribute('hidden');
    document.body.classList.add('menu-open');
  }

  function closeMenu() {
    burgerBtn.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('hidden', '');
    menu.setAttribute('hidden', '');
    document.body.classList.remove('menu-open');
  }

  burgerBtn.addEventListener('click', () => {
    const isOpen = burgerBtn.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);

  links.forEach((link) => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burgerBtn.getAttribute('aria-expanded') === 'true') {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720 && burgerBtn.getAttribute('aria-expanded') === 'true') {
      closeMenu();
    }
  });
}

/* --------------------------------------------------------------------------
   Stats Count-Up Animation
   -------------------------------------------------------------------------- */
function initStatsCountUp() {
  const statElements = document.querySelectorAll('.stat-item');
  if (!statElements.length) return;

  const statsData = [
    { target: 100, decimals: 0, suffix: '%' },
    { target: 0, decimals: 0, suffix: ' Bytes' },
    { target: 24, decimals: 0, suffix: '/7' },
    { target: 1428, decimals: 0, suffix: ' Runes' },
  ];

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function runCounter(el, data, index) {
    const valueEl = el.querySelector('.stat-value');
    if (!valueEl) return;

    const target = data.target;
    const decimals = data.decimals;
    const suffix = data.suffix;
    const duration = 1500 + index * 80;
    const delay = 480 + index * 90;

    setTimeout(() => {
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const currentVal = (easedProgress * target).toFixed(decimals);

        valueEl.textContent = `${currentVal}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          valueEl.textContent = `${target.toFixed(decimals)}${suffix}`;
        }
      }

      requestAnimationFrame(update);
    }, delay);
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          statElements.forEach((el, idx) => {
            if (statsData[idx]) {
              runCounter(el, statsData[idx], idx);
            }
          });
          obs.disconnect();
        }
      });
    },
    { threshold: 0.25 }
  );

  const statsFooter = document.querySelector('.stats-footer');
  if (statsFooter) {
    observer.observe(statsFooter);
  }
}
