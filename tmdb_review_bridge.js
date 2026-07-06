// ==UserScript==
// @name         TMDB Review Bridge
// @namespace    tmdb-review-bridge
// @version      1.0.0
// @description  Adds Obsidian util tools
// @author       EastRane
// @match        https://www.themoviedb.org/movie/*
// @match        https://www.themoviedb.org/tv/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // insert tmdb api key
  const TMDB_API_KEY = '';

  const STORAGE_KEY_BTNS = 'east_tmdb_obsidian_btns_enabled';
  const activePromises = new Map();

  function getMediaInfo() {
    const path = window.location.pathname;
    const m = path.match(/^\/(movie|tv)\/\d+/);
    if (!m) return null;

    const rawId = window.location.pathname.split('/')[2].split('-')[0];
    return { id: rawId, rawCategory: m[1], category: m[1] === 'tv' ? 'series' : 'movies' };
  }

  function toSlug(title) {
    return title.toLowerCase().replace(/[:;]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  }

  function getCurrentISODate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${(-now.getTimezoneOffset()>=0?'+':'-')}${pad(Math.floor(Math.abs(now.getTimezoneOffset())/60))}:${pad(Math.abs(now.getTimezoneOffset())%60)}`;
  }

  function isObsidianEnabled() { return localStorage.getItem(STORAGE_KEY_BTNS) === 'true'; }

  async function fetchMediaDataFromApi(rawCategory, id) {
    const cacheKey = `east_tmdb_data_v3_${id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }

    if (activePromises.has(id)) return activePromises.get(id);

    const promise = (async () => {
      const result = { imdbId: '', ruTitle: '', ukTitle: '' };

      if (!TMDB_API_KEY) {
        console.error('TMDB Review Bridge: Please set your TMDB_API_KEY in the script');
        return result;
      }

      try {
        const [idRes, transRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/${rawCategory}/${id}/external_ids?api_key=${TMDB_API_KEY}`),
          fetch(`https://api.themoviedb.org/3/${rawCategory}/${id}/translations?api_key=${TMDB_API_KEY}`)
        ]);

        if (idRes.ok) {
          const idJson = await idRes.json();
          result.imdbId = idJson.imdb_id || '';
        }

        if (transRes.ok) {
          const transJson = await transRes.json();
          const translations = transJson.translations || [];

          const ruData = translations.find(t => t.iso_639_1 === 'ru');
          const ukData = translations.find(t => t.iso_639_1 === 'uk');

          if (ruData && ruData.data) {
            result.ruTitle = ruData.data.title || ruData.data.name || '';
          }
          if (ukData && ukData.data) {
            result.ukTitle = ukData.data.title || ukData.data.name || '';
          }
        }

        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {
        console.error('TMDb Bridge: Error fetching data from TMDB API', e);
      }

      return result;
    })();

    activePromises.set(id, promise);
    const res = await promise;
    activePromises.delete(id);
    return res;
  }

  async function injectObsidian() {
    const media = getMediaInfo();
    if (!media) return;

    const titleHeader = document.querySelector('.title h2 a') || document.querySelector('.title h2');
    if (!titleHeader) return;

    const targetContainer = titleHeader.closest('h2');
    if (!targetContainer || document.getElementById('obsidian-copy-btns')) return;

    const originalTitleSpan = document.querySelector('.original_title');
    let originalTitle = titleHeader.textContent.trim();
    if (originalTitleSpan) {
        originalTitle = originalTitleSpan.textContent.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').trim();
    } else {
        originalTitle = originalTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    }

    const wrapper = document.createElement('span');
    wrapper.id = 'obsidian-copy-btns';
    wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:15px;vertical-align:middle;font-weight:normal;font-size:1rem;';

    const obsidianBtns = document.createElement('span');
    obsidianBtns.style.cssText = `display:${isObsidianEnabled() ? 'inline-flex' : 'none'};gap:6px;align-items:center;`;

    const btnStyle = 'cursor:pointer;font-size:1.1rem;opacity:0.5;transition:opacity 0.2s;user-select:none;display:inline-flex;align-items:center;justify-content:center;';

    const createBtn = (icon, tip, textFn) => {
      const b = document.createElement('span');
      b.innerHTML = icon; b.title = tip; b.style.cssText = btnStyle;
      b.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const original = b.innerHTML;
          b.innerHTML = '⏳';
          const text = await textFn(e);
          navigator.clipboard.writeText(text).then(() => {
              b.innerHTML = '✅'; setTimeout(() => b.innerHTML = original, 1500);
          });
      };
      b.onmouseenter = () => b.style.opacity = '0.9';
      b.onmouseleave = () => b.style.opacity = '0.5';
      return b;
    };

    obsidianBtns.appendChild(createBtn('📄', 'Copy filename', () => `${media.id}-${toSlug(originalTitle)}`));

    obsidianBtns.appendChild(createBtn('📋', 'Copy frontmatter', async () => {
        const escapeYaml = (str) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        const apiData = await fetchMediaDataFromApi(media.rawCategory, media.id);

        const akaList = [];
        if (apiData.ruTitle && apiData.ruTitle !== originalTitle) akaList.push(`  - "${escapeYaml(apiData.ruTitle)}"`);
        if (apiData.ukTitle && apiData.ukTitle !== originalTitle && apiData.ukTitle !== apiData.ruTitle) akaList.push(`  - "${escapeYaml(apiData.ukTitle)}"`);

        const akaBlock = akaList.length > 0 ? `aka:\n${akaList.join('\n')}\n` : 'aka:\n';

        return `---
title: "${escapeYaml(originalTitle)}"
${akaBlock}category: ${media.category}
score:
locale:
tags:
  -
spoiler: false
created: ${getCurrentISODate()}
modified:
ids:
  tmdb: ${media.id}
  imdb: ${apiData.imdbId}
---`;
    }));

    const toggle = document.createElement('span');
    toggle.innerHTML = '⚙️';
    toggle.title = 'Toggle Obsidian Tools';
    toggle.style.cssText = btnStyle;
    toggle.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !isObsidianEnabled();
      localStorage.setItem(STORAGE_KEY_BTNS, next);
      obsidianBtns.style.display = next ? 'inline-flex' : 'none';
    };
    toggle.onmouseenter = () => toggle.style.opacity = '0.9';
    toggle.onmouseleave = () => toggle.style.opacity = '0.5';

    wrapper.appendChild(toggle);
    wrapper.appendChild(obsidianBtns);
    targetContainer.appendChild(wrapper);
  }

  let lastUrl = '';
  function checkAndInject() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById('obsidian-copy-btns')?.remove();
    }
    injectObsidian();
  }

  function debounce(func, wait) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
  }

  const debouncedInject = debounce(() => {
    if (/^\/(movie|tv)/.test(window.location.pathname)) {
      checkAndInject();
    }
  }, 100);

  const observer = new MutationObserver(() => {
    debouncedInject();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  debouncedInject();
})();
