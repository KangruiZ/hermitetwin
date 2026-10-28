'use strict';
document.querySelectorAll('[role="tablist"]').forEach(list => {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const activate = selected => {
    let previousTime = 0;
    let wasPlaying = false;
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      const video = panel.querySelector('video');
      if (!panel.hidden && video) {
        previousTime = video.currentTime;
        wasPlaying = !video.paused;
        video.pause();
      }
    }
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.hidden = !active;
      const video = panel.querySelector('video');
      if (active && video) {
        const resume = () => {
          video.currentTime = Math.min(previousTime, Number.isFinite(video.duration) ? Math.max(0, video.duration - .05) : previousTime);
          if (wasPlaying) video.play().catch(() => {});
        };
        if (video.readyState >= 1) resume();
        else video.addEventListener('loadedmetadata', resume, {once: true});
      }
    }
  };
  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab)));
  list.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();activate(tabs[next]);
  });
});
const dialog = document.getElementById('figure-dialog');
document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
  const image = document.getElementById('dialog-image');
  image.src = button.dataset.zoom;image.alt = button.dataset.caption;
  document.getElementById('dialog-caption').textContent = button.dataset.caption;
  dialog.showModal();
}));
document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (!entry.isIntersecting) entry.target.pause();
}, {threshold: 0});
document.querySelectorAll('video:not(.showcase video)').forEach(video => observer.observe(video));

// Each input/result pair is one encoded video, so it cannot drift out of sync.
(() => {
  const section = document.getElementById('showcase');
  const carousel = section.querySelector('.showcase-carousel');
  const cards = [...section.querySelectorAll('.showcase-card')];
  const pages = section.querySelector('.carousel-pages');
  const status = section.querySelector('.showcase-status');
  const toggle = section.querySelector('.motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 459px)');
  const medium = matchMedia('(max-width: 639px)');
  let perPage = narrow.matches ? 1 : medium.matches ? 2 : 3;
  let start = 0;
  let wantsMotion = !reduced.matches;
  const initialBounds = carousel.getBoundingClientRect();
  let onScreen = initialBounds.bottom > 0 && initialBounds.top < innerHeight;
  const updateButton = () => {
    toggle.innerHTML = wantsMotion ? '<span aria-hidden="true">Ⅱ</span> Pause animations' : '<span aria-hidden="true">▷</span> Play animations';
    toggle.setAttribute('aria-label', wantsMotion ? 'Pause showcase animations' : 'Play showcase animations');
  };
  const playClip = card => {
    const video = card.querySelector('video');
    if (!video.paused || card.dataset.playPending === 'true') return;
    card.dataset.playPending = 'true';
    video.muted = true;
    Promise.resolve(video.play()).catch(() => {
      card.querySelector('.paired-media').classList.remove('is-playing');
      if (cards.filter(c => !c.hidden).every(c => c.querySelector('video').paused)) {
        wantsMotion = false;
        updateButton();
      }
    }).finally(() => { card.dataset.playPending = 'false'; });
  };
  for (const card of cards) {
    const video = card.querySelector('video');
    const media = card.querySelector('.paired-media');
    video.addEventListener('playing', () => {
      media.classList.add('is-playing');
      const reveal = () => { if (video.readyState >= 2) media.classList.add('has-frame'); };
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(reveal);
      else reveal();
    });
    video.addEventListener('pause', () => media.classList.remove('is-playing'));
    video.addEventListener('error', () => media.classList.remove('has-frame', 'is-playing'));
    card.querySelector('.clip-play').addEventListener('click', () => {
      wantsMotion = true;
      if (video.error) video.load();
      playClip(card);
      updateButton();
    });
  }
  const syncMotion = () => {
    for (const card of cards) {
      const video = card.querySelector('video');
      if (!card.hidden && wantsMotion && onScreen && !document.hidden) {
        playClip(card);
      } else video.pause();
    }
    updateButton();
  };
  const draw = () => {
    cards.forEach((card, i) => { card.hidden = i < start || i >= start + perPage; });
    pages.replaceChildren();
    const count = Math.ceil(cards.length / perPage);
    section.querySelector('.previous').hidden = count <= 1;
    section.querySelector('.next').hidden = count <= 1;
    pages.hidden = count <= 1;
    for (let i = 0; i < count; i++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Show example group ${i + 1} of ${count}`);
      button.setAttribute('aria-current', String(i === Math.floor(start / perPage)));
      button.addEventListener('click', () => { start = i * perPage; draw(); });
      pages.append(button);
    }
    status.textContent = `Showing examples ${start + 1}–${Math.min(start + perPage, cards.length)} of ${cards.length}`;
    syncMotion();
  };
  const move = direction => {
    const count = Math.ceil(cards.length / perPage);
    start = ((Math.floor(start / perPage) + direction + count) % count) * perPage;
    draw();
  };
  section.querySelector('.previous').addEventListener('click', () => move(-1));
  section.querySelector('.next').addEventListener('click', () => move(1));
  toggle.addEventListener('click', () => { wantsMotion = !wantsMotion; syncMotion(); });
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  const resize = () => {
    perPage = narrow.matches ? 1 : medium.matches ? 2 : 3;
    start = Math.floor(start / perPage) * perPage;
    draw();
  };
  narrow.addEventListener('change', resize);
  medium.addEventListener('change', resize);
  reduced.addEventListener('change', () => { wantsMotion = !reduced.matches; syncMotion(); });
  document.addEventListener('visibilitychange', syncMotion);
  new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; syncMotion(); }, {threshold: .05}).observe(carousel);
  draw();
})();

(() => {
  const button = document.getElementById('copy-citation');
  const code = document.getElementById('citation-code');
  const status = document.getElementById('citation-status');
  if (!button || !code) return;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = 'Copied!';
      status.textContent = 'BibTeX copied to clipboard.';
      setTimeout(() => { button.textContent = 'Copy BibTeX'; }, 2200);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      code.focus();
      status.textContent = 'Text selected. Press Ctrl+C or ⌘C to copy.';
    }
  });
})();
