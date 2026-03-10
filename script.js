/* =====================================================
   PARTH SONI PORTFOLIO — script.js
   - Mobile menu toggle
   - Scroll fade-in animations
   - Active nav link highlighting
   - Smooth section reveal on load
   ===================================================== */

(function () {
  'use strict';

  // ---- Mobile menu ----
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav  = document.getElementById('mobileNav');

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen);
      menuToggle.textContent = isOpen ? '✕' : '☰';
    });

    // Close on link click
    mobileNav.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuToggle.textContent = '☰';
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!mobileNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mobileNav.classList.remove('open');
        menuToggle.textContent = '☰';
      }
    });
  }

  // ---- Fade-up scroll animations ----
  const fadeTargets = document.querySelectorAll(
    '.exp-block, .proj-row, .cert-card, .edu-entry, ' +
    '.resume-inline-card, .skill-chip, .role-card, .about-body'
  );

  // Add fade-up class to animatable elements
  fadeTargets.forEach(el => el.classList.add('fade-up'));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  fadeTargets.forEach(el => observer.observe(el));

  // ---- Staggered cert card reveal ----
  const certCards = document.querySelectorAll('.cert-card');
  certCards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 60}ms`;
  });

  // ---- Active nav link on scroll ----
  const sections  = document.querySelectorAll('section[id], div[id], footer[id]');
  const navLinks  = document.querySelectorAll('nav a');
  const headerH   = 70;

  function setActiveNav() {
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - headerH - 20) {
        current = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.style.color = '';
      const href = link.getAttribute('href');
      if (href === '#' + current) {
        link.style.color = '#e85d04';
      }
    });
  }

  window.addEventListener('scroll', setActiveNav, { passive: true });
  setActiveNav();

  // ---- Header shrink on scroll ----
  const header = document.getElementById('site-header');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      header.style.boxShadow = '0 2px 24px rgba(0,0,0,0.4)';
    } else {
      header.style.boxShadow = 'none';
    }
  }, { passive: true });

})();
