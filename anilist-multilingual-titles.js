// ==UserScript==
// @name         AniList Multilingual Titles
// @namespace    anilist-multilingual-titles
// @version      1.0.0
// @description  Shows "Romaji / English / Russian" titles on anime/manga pages
// @author       EastRane
// @match        https://anilist.co/*
// @grant        GM.xmlHttpRequest
// @connect      graphql.anilist.co
// @connect      shikimori.one
// ==/UserScript==

(function () {
  'use strict';

  const ANILIST_API = 'https://graphql.anilist.co';
  const SHIKIMORI_API = 'https://shikimori.one/api';

  let currentMediaId = null;
  let isUpdating = false;

  if (!document.getElementById('anilist-triple-title-style')) {
    const style = document.createElement('style');
    style.id = 'anilist-triple-title-style';
    style.textContent = `
      .anilist-triple-title {
        font-size: 1.9rem;
        font-weight: 400;
        line-height: 1.3;
        color: var(--color-text-bright);
      }
      .anilist-triple-title + h1 {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0,0,0,0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getMediaIdAndType() {
    const path = window.location.pathname;
    const animeMatch = path.match(/^\/anime\/(\d+)/);
    const mangaMatch = path.match(/^\/manga\/(\d+)/);
    if (animeMatch) return { id: animeMatch[1], type: 'ANIME', shikiType: 'animes' };
    if (mangaMatch) return { id: mangaMatch[1], type: 'MANGA', shikiType: 'mangas' };
    return null;
  }

  async function updateTitle() {
    if (isUpdating) return;
    isUpdating = true;

    const media = getMediaIdAndType();
    if (!media || media.id === currentMediaId) {
      isUpdating = false;
      return;
    }

    currentMediaId = media.id;

    let h1 = null;
    for (let i = 0; i < 50; i++) {
      h1 = document.querySelector('div.content h1');
      if (h1 && h1.textContent.trim()) break;
      await new Promise(r => setTimeout(r, 200));
    }

    if (!h1) {
      isUpdating = false;
      return;
    }

    const oldTriple = h1.previousElementSibling;
    if (oldTriple && oldTriple.classList.contains('anilist-triple-title')) {
      oldTriple.remove();
    }

    const tripleTitle = document.createElement('div');
    tripleTitle.className = 'anilist-triple-title';
    tripleTitle.textContent = h1.textContent;
    h1.parentNode.insertBefore(tripleTitle, h1);

    try {
      const anilistRes = await new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
          method: 'POST',
          url: ANILIST_API,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            query: `query ($id: Int) { Media(id: $id) { idMal title { romaji english } } }`,
            variables: { id: parseInt(media.id) },
          }),
          onload: r => (r.status === 200 ? resolve(r) : reject(new Error(r.status))),
          onerror: reject,
        });
      });

      const data = JSON.parse(anilistRes.responseText).data?.Media;
      if (!data) throw new Error('No media data');

      const { romaji, english } = data.title;
      const malId = data.idMal;
      let russian = null;

      if (malId) {
        try {
          const shikiRes = await new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
              method: 'GET',
              url: `${SHIKIMORI_API}/${media.shikiType}/${malId}`,
              onload: r => (r.status === 200 ? resolve(r) : reject(new Error(r.status))),
              onerror: reject,
            });
          });
          const shikiData = JSON.parse(shikiRes.responseText);
          russian = shikiData.russian || null;
        } catch (e) {
          console.debug(`[Triple Title] Shikimori error for ${media.shikiType}/${malId}`, e);
        }
      }

      const parts = [romaji, english, russian].filter(p => p);
      if (parts.length > 0) {
        tripleTitle.textContent = parts.join(' / ');
        tripleTitle.title = 'Romaji / English / Russian (from AniList + Shikimori)';
      }

    } catch (e) {
      console.warn('[Triple Title] Failed to fetch data', e);
    } finally {
      isUpdating = false;
    }
  }

  // === SPA SUPPORT ===
  const wrapHistory = (type) => {
    const orig = history[type];
    return function () {
      const res = orig.apply(this, arguments);
      setTimeout(updateTitle, 300);
      return res;
    };
  };
  history.pushState = wrapHistory('pushState');
  history.replaceState = wrapHistory('replaceState');

  const observer = new MutationObserver(() => {
    if (/^\/(anime|manga)\/\d+/.test(window.location.pathname)) {
      updateTitle();
    }
  });

  const pageContent = document.querySelector('.page-content') || document.body;
  observer.observe(pageContent, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateTitle);
  } else {
    updateTitle();
  }
})();