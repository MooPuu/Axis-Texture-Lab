// Interactive Showcase & Lightbox Script for Axis Texture Lab
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.showcase-tab');
  const showcaseImage = document.getElementById('showcaseImage');
  const showcaseCaption = document.getElementById('showcaseCaption');
  const btnZoom = document.getElementById('btnZoom');
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');

  // Platform Tab Switching (Windows / macOS / Linux)
  const platformTabs = document.querySelectorAll('.platform-tab');
  const platformPanels = document.querySelectorAll('.platform-panel');

  const switchPlatform = (platform) => {
    platformTabs.forEach(t => {
      const isMatch = t.getAttribute('data-platform') === platform;
      t.classList.toggle('active', isMatch);
      t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    platformPanels.forEach(p => {
      p.classList.toggle('active', p.id === `panel-${platform}`);
    });
  };

  platformTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const platform = tab.getAttribute('data-platform');
      switchPlatform(platform);
    });
  });

  // OS Auto-Detection
  const ua = (navigator.userAgent || navigator.platform || '').toLowerCase();
  if (ua.includes('mac') || ua.includes('darwin')) {
    switchPlatform('macos');
  } else if (ua.includes('linux') && !ua.includes('android')) {
    switchPlatform('linux');
  } else {
    switchPlatform('windows');
  }

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const newSrc = tab.getAttribute('data-img');
      const newDesc = tab.getAttribute('data-desc');

      // Subtle fade animation
      showcaseImage.style.opacity = '0';
      setTimeout(() => {
        showcaseImage.src = newSrc;
        showcaseCaption.textContent = newDesc;
        showcaseImage.style.opacity = '1';
      }, 150);
    });
  });

  // Lightbox opening
  const openLightbox = () => {
    lightboxImg.src = showcaseImage.src;
    lightboxModal.classList.add('active');
  };

  const closeLightbox = () => {
    lightboxModal.classList.remove('active');
  };

  btnZoom?.addEventListener('click', openLightbox);
  showcaseImage?.addEventListener('click', openLightbox);
  lightboxClose?.addEventListener('click', closeLightbox);
  lightboxBackdrop?.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxModal.classList.contains('active')) {
      closeLightbox();
    }
  });

  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
