// ==UserScript==
// @name         AniList Review Bridge
// @namespace    anilist-review-bridge
// @version      1.0.2
// @description  Adds a review link and Obsidian util tools
// @author       EastRane
// @match        https://anilist.co/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const NOTES_BASE = 'https://notes.eastrane.top/reviews';
  const STORAGE_KEY_BTNS = 'east_obsidian_btns_enabled';
  const REVIEW_CACHE_PREFIX = 'east_rev_';

  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const CACHE_TTL_404_MS = 1 * 60 * 1000;

  const activeFetches = new Set();

  const REVIEW_ICON_SVG = `
    <svg viewBox="0 0 512 512" style="width: 15px; height: 15px; fill: currentColor;">
      <path d="M256 32C114.6 32 0 125.1 0 240c0 49.6 21.4 95 57 130.7C44.5 421.1 2.7 466 2.2 466.5c-2.2 2.3-2.8 5.7-1.5 8.7S4.8 480 8 480c66.3 0 116-31.8 140.6-51.4 32.7 12.3 69 19.4 107.4 19.4 141.4 0 256-93.1 256-208S397.4 32 256 32z"></path>
    </svg>
  `;

  function getMediaInfo() {
    const path = window.location.pathname;
    const m = path.match(/^\/(anime|manga)\/(\d+)/);
    return m ? { id: m[2], category: m[1] } : null;
  }

  function toSlug(title) {
    return title.toLowerCase().replace(/[:;]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  }

  function getCurrentISODate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${(-now.getTimezoneOffset()>=0?'+':'-')}${pad(Math.floor(Math.abs(now.getTimezoneOffset())/60))}:${pad(Math.abs(now.getTimezoneOffset())%60)}`;
  }

  function getMalId(id) { try { return JSON.parse(localStorage.getItem('east_'+id))?.data?.idMal || null; } catch { return null; } }
  function getRomajiTitle(id) { try { return JSON.parse(localStorage.getItem('east_'+id))?.data?.romaji || null; } catch { return null; } }
  function getAkaTitles(id) {
    try {
        const data = JSON.parse(localStorage.getItem('east_' + id))?.data;
        if (!data) return [];
        const aka = [data.english, data.russian, data.ukrainian].filter(Boolean);
        return aka;
    } catch {
        return [];
    }
  }
  function isObsidianEnabled() { return localStorage.getItem(STORAGE_KEY_BTNS) === 'true'; }

  function ensureStyles() {
    if (document.getElementById('east-bridge-styles')) return;
    const s = document.createElement('style');
    s.id = 'east-bridge-styles';
    s.textContent = `
      .cover-wrap-inner .actions:has(#east-review-action):has(.favourite) {
        grid-template-columns: auto 35px 35px !important;
        grid-gap: 10px;
      }
      .cover-wrap-inner .actions:has(#east-review-action):not(:has(.favourite)) {
        grid-template-columns: auto 35px !important;
      }
      #east-review-tooltip {
        position: fixed; z-index: 99999; background: rgb(var(--color-foreground)); border: 1px solid #444;
        border-radius: 3px; padding: 8px 12px; font-size: 12px; color: #ccc;
        pointer-events: none; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        transition: opacity 0.15s; opacity: 0; line-height: 1.6;
      }
      #east-review-tooltip.visible { opacity: 1; }
      #east-review-tooltip b { color: #eee; }
      #east-review-action {
        display: flex; align-items: center; justify-content: center;
        width: 35px; height: 35px; border-radius: 5px;
        background: rgb(var(--color-blue)); color: rgb(var(--color-white));
        cursor: pointer; user-select: none; transition: filter .2s;
      }
    `;
    document.head.appendChild(s);
  }

  async function fetchReviewInfo(media, url) {
    const cacheKey = `${REVIEW_CACHE_PREFIX}${media.category}_${media.id}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const p = JSON.parse(cached);
        const currentTTL = p.data.found ? CACHE_TTL_MS : CACHE_TTL_404_MS;

        if (Date.now() - p.timestamp < currentTTL) {
          return p.data;
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    return new Promise(async (resolve) => {
      try {
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 404) {
            const r = { found: false };
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: r }));
            resolve(r);
          } else {
            resolve({ found: false });
          }
          return;
        }

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const h1Text = doc.querySelector('h1')?.textContent.toLowerCase() || '';
        if (doc.title.includes('404') || h1Text.includes('404') || h1Text.includes('not found')) {
            const r = { found: false };
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: r }));
            resolve(r); return;
        }

        let created = null, updated = null;
        doc.querySelectorAll('p.content-meta span').forEach(s => {
          const b = s.querySelector('b'), t = s.querySelector('time');
          if (b && t) {
            if (b.textContent.toLowerCase().includes('created')) created = t.textContent;
            if (b.textContent.toLowerCase().includes('updated')) updated = t.textContent;
          }
        });

        let type = 'Review';
        const tags = Array.from(doc.querySelectorAll('ul.tags a.tag-link')).map(a => a.textContent.trim().toLowerCase());
        if (tags.includes('review')) type = 'Review';
        else if (tags.includes('note')) type = 'Note';
        else if (tags.includes('log')) type = 'Log';
        else if (tags.length > 0) {
            type = tags[0].charAt(0).toUpperCase() + tags[0].slice(1);
        }

        const result = { found: true, created, updated, type };
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
        resolve(result);
      } catch (e) {
        resolve({ found: false });
      }
    });
  }

  function injectObsidian(title, media, malId) {
    const h1 = document.querySelector('div.content h1');
    if (!h1) return;

    const targetTitle = document.querySelector('.amt-wrap') || h1;
    const aka = getAkaTitles(media.id);

    let wrapper = document.getElementById('obsidian-copy-btns');
    if (wrapper) {
        if (wrapper.parentNode === targetTitle) return;
        wrapper.remove();
    }

    wrapper = document.createElement('span');
    wrapper.id = 'obsidian-copy-btns';
    wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:10px;vertical-align:middle;';

    const obsidianBtns = document.createElement('span');
    obsidianBtns.style.cssText = `display:${isObsidianEnabled() ? 'inline-flex' : 'none'};gap:6px;align-items:center;`;

    const btnStyle = 'cursor:pointer;font-size:1.1rem;opacity:0.4;transition:opacity 0.2s;user-select:none;display:inline-flex;align-items:center;justify-content:center;';

    const createBtn = (icon, tip, textFn) => {
      const b = document.createElement('span');
      b.innerHTML = icon; b.title = tip; b.style.cssText = btnStyle;
      b.onclick = (e) => {
          const original = b.innerHTML;
          navigator.clipboard.writeText(textFn(e)).then(() => {
              b.innerHTML = '✅'; setTimeout(() => b.innerHTML = original, 1500);
          });
      };
      b.onmouseenter = () => b.style.opacity = '0.9';
      b.onmouseleave = () => b.style.opacity = '0.4';
      return b;
    };

    obsidianBtns.appendChild(createBtn('📄', 'Copy filename', () => `${media.id}-${toSlug(title)}`));
        obsidianBtns.appendChild(createBtn('📋', 'Copy frontmatter', () => {
    const aka = getAkaTitles(media.id);

    const escapeYaml = (str) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const akaBlock = aka.length > 0
        ? `aka:\n${aka.map(t => `  - "${escapeYaml(t)}"`).join('\n')}\n`
        : '';
    return `---
title: "${escapeYaml(title)}"
category: ${media.category}
score:
locale:
tags:
  -
spoiler: false
${akaBlock}created: ${getCurrentISODate()}
modified:
ids:
  anilist: ${media.id}
  mal: ${malId || ''}
---`;
}));
    obsidianBtns.appendChild(createBtn('💬', 'Copy commit (Alt+Click for update)', (e) => `${e.altKey ? 'update' : 'add'}(${media.category}): ${toSlug(title)}`));

    const toggle = document.createElement('span');
    toggle.innerHTML = '⚙️';
    toggle.title = 'Toggle Obsidian Tools';
    toggle.style.cssText = btnStyle;
    toggle.onclick = () => {
      const next = !isObsidianEnabled();
      localStorage.setItem(STORAGE_KEY_BTNS, next);
      obsidianBtns.style.display = next ? 'inline-flex' : 'none';
    };
    toggle.onmouseenter = () => toggle.style.opacity = '0.9';
    toggle.onmouseleave = () => toggle.style.opacity = '0.4';

    wrapper.appendChild(toggle);
    wrapper.appendChild(obsidianBtns);
    targetTitle.appendChild(wrapper);
  }

async function injectReview(title, media) {
    if (document.getElementById('east-review-action')) return;
    const actions = document.querySelector('.cover-wrap-inner .actions');
    if (!actions) return;

    const fetchUrl = `${NOTES_BASE}/${media.category}/${media.id}-${toSlug(title)}`;

    if (activeFetches.has(fetchUrl)) return;
    activeFetches.add(fetchUrl);

    try {
      const info = await fetchReviewInfo(media, fetchUrl);

      const currentMedia = getMediaInfo();
      if (!currentMedia || currentMedia.id !== media.id) return;

      if (document.getElementById('east-review-action')) return;
      if (!info.found) return;

      ensureStyles();
      const btn = document.createElement('div');
      btn.id = 'east-review-action'; btn.innerHTML = REVIEW_ICON_SVG;
      btn.onclick = () => window.open(fetchUrl, '_blank');
      btn.onmouseenter = () => {
          const typeStr = info.type || 'Review';
          let h = `<b>EastRane's ${typeStr}</b><br>`;
          if (info.created) h += `Created: ${info.created}<br>`;
          if (info.updated) h += `Updated: ${info.updated}`;

          let tip = document.getElementById('east-review-tooltip') || document.createElement('div');
          tip.id = 'east-review-tooltip'; document.body.appendChild(tip);
          tip.innerHTML = h; tip.classList.add('visible');
          const r = btn.getBoundingClientRect();
          tip.style.left = (r.left + r.width/2 - tip.offsetWidth/2) + 'px';
          tip.style.top = (r.top - tip.offsetHeight - 8) + 'px';
      };
      btn.onmouseleave = () => document.getElementById('east-review-tooltip')?.classList.remove('visible');

      const fav = actions.querySelector('.favourite');
      if (fav) actions.insertBefore(btn, fav); else actions.appendChild(btn);

    } finally {
      activeFetches.delete(fetchUrl);
    }
  }

  function run() {
    const media = getMediaInfo();
    if (!media) return;
    ensureStyles();

    const h1 = document.querySelector('div.content h1');
    if (h1 && h1.textContent.trim()) {
      const title = getRomajiTitle(media.id) || h1.childNodes[0].textContent.trim();
      const malId = getMalId(media.id);
      injectObsidian(title, media, malId);
      injectReview(title, media);
    }
  }

  let lastUrl = '';

  function checkAndInject() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById('obsidian-copy-btns')?.remove();
      document.getElementById('east-review-action')?.remove();

      const actions = document.querySelector('.cover-wrap-inner .actions');
      if (actions) actions.style.gridTemplateColumns = '';
    }
    run();
  }

  function debounce(func, wait) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
  }

  const debouncedInject = debounce(() => {
    if (/^\/(anime|manga)\/\d+/.test(window.location.pathname)) {
      checkAndInject();
    }
  }, 100);

  const observer = new MutationObserver(() => {
    debouncedInject();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  debouncedInject();
})();
