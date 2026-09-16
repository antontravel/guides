(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.querySelector('.motion-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const findings = [...document.querySelectorAll('.hero-sticker')];
  const placeLabel = document.getElementById('hero-place');
  const placeLink = document.querySelector('.hero-place-link');
  // The finds remain interactive when decorative motion is disabled.
  if (placeLabel && placeLink) findings.forEach(sticker => {
    sticker.addEventListener('click', () => {
      findings.forEach(item => item.setAttribute('aria-pressed', String(item === sticker)));
      placeLabel.textContent = sticker.dataset.place;
      placeLink.setAttribute('href', sticker.dataset.guide);
      placeLink.setAttribute('aria-label', sticker.dataset.guide === '#suzdal' ? 'К путеводителю по Суздалю' : 'К путеводителю по Плёсу');
    });
  });
  const scenes = [...document.querySelectorAll('[data-scene]')].map(node => ({
    node,
    layers: [...node.querySelectorAll('[data-depth]')].map(layer => ({
      node: layer, depth: Number(layer.dataset.depth) || 0
    })),
    pointerX: 0,
    pointerY: 0,
    visible: false
  }));
  let preference = true;
  try { preference = localStorage.getItem('anton-travel-motion') !== 'off'; } catch (_) { /* Storage is optional. */ }
  let enabled = false;
  let frame = 0;
  let revealObserver;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function paint() {
    frame = 0;
    if (!enabled || document.hidden) return;
    const viewport = window.innerHeight;
    // Read geometry first, then write transforms: no interleaved layout reads.
    const positions = scenes.filter(scene => scene.visible).map(scene => {
      const rect = scene.node.getBoundingClientRect();
      const progress = clamp((viewport / 2 - (rect.top + rect.height / 2)) / ((viewport + rect.height) / 2), -1, 1);
      return { scene, scrollY: progress * 18 };
    });
    positions.forEach(({ scene, scrollY }) => {
      scene.layers.forEach(layer => {
        layer.node.style.setProperty('--px', `${(scene.pointerX * 6 * layer.depth).toFixed(2)}px`);
        layer.node.style.setProperty('--py', `${((scrollY + scene.pointerY * 4) * layer.depth).toFixed(2)}px`);
      });
    });
  }

  function requestPaint() {
    if (enabled && !document.hidden && !frame) frame = requestAnimationFrame(paint);
  }

  function showAllReveals() {
    document.querySelectorAll('[data-reveal]').forEach(node => node.classList.add('is-visible'));
    if (revealObserver) revealObserver.disconnect();
  }

  function applyPreference() {
    enabled = preference && !reduced.matches;
    root.classList.toggle('motion-on', enabled && !document.hidden);
    root.classList.toggle('motion-off', !enabled);
    if (toggle) {
      toggle.hidden = false;
      toggle.disabled = reduced.matches;
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.textContent = `Анимация: ${enabled ? 'вкл.' : 'выкл.'}`;
      toggle.title = reduced.matches ? 'Отключена по настройке уменьшения движения на вашем устройстве' : 'Включить или отключить декоративную анимацию';
    }
    if (!enabled) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      scenes.forEach(scene => {
        scene.pointerX = 0;
        scene.pointerY = 0;
        scene.layers.forEach(layer => {
          layer.node.style.removeProperty('--px');
          layer.node.style.removeProperty('--py');
        });
      });
      showAllReveals();
    }
    requestPaint();
  }

  if ('IntersectionObserver' in window) {
    const sceneObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const scene = scenes.find(item => item.node === entry.target);
        if (!scene) return;
        scene.visible = entry.isIntersecting;
        scene.node.classList.toggle('scene-visible', scene.visible);
      });
      requestPaint();
    }, { rootMargin: '40px 0px', threshold: 0 });
    scenes.forEach(scene => sceneObserver.observe(scene.node));

    if (preference && !reduced.matches) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px 30px 0px' });
      document.querySelectorAll('[data-reveal]').forEach(node => {
        node.classList.add('reveal-ready');
        revealObserver.observe(node);
      });
      // Anchor navigation must never land on content waiting for an observer.
      window.addEventListener('hashchange', showAllReveals);
      document.addEventListener('focusin', event => {
        const section = event.target.closest('[data-reveal]');
        if (section) section.classList.add('is-visible');
      });
    }
  } else {
    scenes.forEach(scene => {
      scene.visible = true;
      scene.node.classList.add('scene-visible');
    });
  }

  scenes.forEach(scene => {
    scene.node.addEventListener('pointermove', event => {
      if (!enabled || !finePointer.matches) return;
      const rect = scene.node.getBoundingClientRect();
      scene.pointerX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      scene.pointerY = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
      requestPaint();
    }, { passive: true });
    scene.node.addEventListener('pointerleave', () => {
      scene.pointerX = 0;
      scene.pointerY = 0;
      requestPaint();
    }, { passive: true });
  });
  window.addEventListener('scroll', requestPaint, { passive: true });
  window.addEventListener('resize', requestPaint, { passive: true });
  document.addEventListener('visibilitychange', applyPreference);
  reduced.addEventListener('change', applyPreference);
  if (toggle) toggle.addEventListener('click', () => {
    preference = !enabled;
    try { localStorage.setItem('anton-travel-motion', preference ? 'on' : 'off'); } catch (_) { /* Keep session preference. */ }
    applyPreference();
  });
  applyPreference();
  if (window.location.hash) showAllReveals();
})();
