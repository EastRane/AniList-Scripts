// ==UserScript==
// @name         AniList Multilingual Titles
// @namespace    anilist-multilingual-titles
// @version      1.2.0
// @description  Shows multilingual titles on anime/manga pages
// @author       EastRane
// @match        https://anilist.co/*
// @grant        GM.xmlHttpRequest
// @connect      graphql.anilist.co
// @connect      shikimori.one
// @connect      api.hikka.io
// ==/UserScript==

(function() {
    'use strict';

    const ANILIST_API = 'https://graphql.anilist.co';
    const SHIKIMORI_API = 'https://shikimori.one/api';
    const HIKKA_API = 'https://api.hikka.io/integrations/mal';

    const LOG_PREFIX = '[Multilingual Title]';

    function logWarn(msg, ...args) {
        console.warn(`${LOG_PREFIX} ${msg}`, ...args);
    }

    function logInfo(msg, ...args) {
        console.info(`${LOG_PREFIX} ${msg}`, ...args);
    }

    let currentMediaId = null;
    let isUpdating = false;

    if (!document.getElementById('anilist-multilingual-title-style')) {
        const style = document.createElement('style');
        style.id = 'anilist-multilingual-title-style';
        style.textContent = `
            .amt-wrap {
                position: relative;
                display: block;
            }

            .amt-title {
                font-size: 1.9rem;
                color: var(--color-text-bright);
                cursor: help;
                display: inline;
            }

            .amt-popup {
                display: none;
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                z-index: 99999;
                background: rgb(var(--color-foreground));
                border: 1px solid #444;
                border-radius: 3px;
                padding: 8px 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                white-space: nowrap;
                line-height: 1.6;
                pointer-events: none;
            }

            .amt-title:hover + .amt-popup {
                display: block;
            }

            .amt-popup-row {
                display: flex;
                align-items: baseline;
                gap: 10px;
                font-size: 14px;
                color: #ccc;
            }

            .amt-popup-tag {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.08em;
                color: #eee;
                flex-shrink: 0;
                width: 16px;
            }

            .amt-popup-text {
                color: #ccc;
            }

            .amt-wrap + h1 {
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

    const CACHE_KEY_PREFIX = 'east_';
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

    function getFromCache(id) {
        const key = CACHE_KEY_PREFIX + id;
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
                return parsed.data;
            } else {
                localStorage.removeItem(key);
            }
        } catch (e) {
            localStorage.removeItem(key);
        }
        return null;
    }

    function setToCache(id, data) {
        const key = CACHE_KEY_PREFIX + id;
        try {
            localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) {}
    }

    function getHikkaType(anilistType, anilistFormat) {
        if (anilistType === 'ANIME') return 'anime';
        if (anilistFormat === 'NOVEL') return 'novel';
        return 'manga';
    }

    function getShikiType(anilistType) {
        return anilistType === 'ANIME' ? 'animes' : 'mangas';
    }

    function getMediaIdAndType() {
        const path = window.location.pathname;
        const animeMatch = path.match(/^\/anime\/(\d+)/);
        const mangaMatch = path.match(/^\/manga\/(\d+)/);
        if (animeMatch) return { id: animeMatch[1], anilistType: 'ANIME' };
        if (mangaMatch) return { id: mangaMatch[1], anilistType: 'MANGA' };
        return null;
    }

    function buildWrap(fallbackText) {
        const wrap = document.createElement('div');
        wrap.className = 'amt-wrap';

        const titleEl = document.createElement('div');
        titleEl.className = 'amt-title';
        titleEl.textContent = fallbackText;
        wrap.appendChild(titleEl);

        return wrap;
    }

        function fillWrap(wrap, { romaji, english, russian, ukrainian }, fallbackText) {
        const titleEl = wrap.querySelector('.amt-title');
        titleEl.textContent = romaji || fallbackText;

        const oldPopup = wrap.querySelector('.amt-popup');
        if (oldPopup) oldPopup.remove();

        const titles = [
            { tag: 'EN', value: english },
            { tag: 'RU', value: russian },
            { tag: 'UA', value: ukrainian },
        ].filter(t => t.value);

        if (titles.length === 0) return;

        const popup = document.createElement('div');
        popup.className = 'amt-popup';

        for (const { tag, value } of titles) {
            const row = document.createElement('div');
            row.className = 'amt-popup-row';

            const tagEl = document.createElement('span');
            tagEl.className = 'amt-popup-tag';
            tagEl.textContent = tag;

            const textEl = document.createElement('span');
            textEl.className = 'amt-popup-text';
            textEl.textContent = value;

            row.appendChild(tagEl);
            row.appendChild(textEl);
            popup.appendChild(row);
        }

        titleEl.insertAdjacentElement('afterend', popup);
    }

    async function fetchAniListData(mediaId) {
        const res = await new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'POST',
                url: ANILIST_API,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    query: `query ($id: Int) {
                        Media(id: $id) {
                            idMal
                            format
                            title {
                                romaji
                                english
                            }
                        }
                    }`,
                    variables: { id: parseInt(mediaId) },
                }),
                onload: r => resolve(r),
                onerror: err => reject(new Error(`Network error: ${err}`)),
                ontimeout: () => reject(new Error('Timeout')),
            });
        });

        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

        const data = JSON.parse(res.responseText).data?.Media;
        if (!data) throw new Error('Empty response body');

        return {
            romaji:  data.title?.romaji  || null,
            english: data.title?.english || null,
            idMal:   data.idMal          || null,
            format:  data.format         || null,
        };
    }

    async function fetchShikimoriRussian(idMal, shikiType) {
        if (!idMal) return null;
        try {
            const res = await new Promise((resolve, reject) => {
                GM.xmlHttpRequest({
                    method: 'GET',
                    url: `${SHIKIMORI_API}/${shikiType}/${idMal}`,
                    onload: r => resolve(r),
                    onerror: err => reject(new Error(`Network error: ${err}`)),
                    ontimeout: () => reject(new Error('Timeout')),
                });
            });

            logInfo(`Shikimori: HTTP ${res.status} for ${shikiType}/${idMal}`);

            if (res.status !== 200) {
                logWarn(`Shikimori: failed to fetch ${shikiType}/${idMal} — HTTP ${res.status}`);
                return null;
            }

            const data = JSON.parse(res.responseText);
            const russian = data.russian || null;

            if (!russian) {
                logWarn(`Shikimori: no russian title for ${shikiType}/${idMal} (field missing or empty)`);
            }

            return russian;
        } catch (e) {
            logWarn(`Shikimori: failed to fetch ${shikiType}/${idMal} —`, e.message);
            return null;
        }
    }

    async function fetchHikkaUkrainian(idMal, hikkaType) {
        if (!idMal) return null;
        try {
            const res = await new Promise((resolve, reject) => {
                GM.xmlHttpRequest({
                    method: 'GET',
                    url: `${HIKKA_API}/${hikkaType}/${idMal}`,
                    onload: r => resolve(r),
                    onerror: err => reject(new Error(`Network error: ${err}`)),
                    ontimeout: () => reject(new Error('Timeout')),
                });
            });

            logInfo(`Hikka: HTTP ${res.status} for ${hikkaType}/${idMal}`);

            if (res.status !== 200) {
                logWarn(`Hikka: failed to fetch ${hikkaType}/${idMal} — HTTP ${res.status}`);
                return null;
            }

            const data = JSON.parse(res.responseText);
            const ukrainian = data.title_ua || null;

            if (!ukrainian) {
                logWarn(`Hikka: no ukrainian title for ${hikkaType}/${idMal} (field missing or empty)`);
            }

            return ukrainian;
        } catch (e) {
            logWarn(`Hikka: failed to fetch ${hikkaType}/${idMal} —`, e.message);
            return null;
        }
    }

    async function updateTitle() {
        if (isUpdating) return;
        isUpdating = true;

        const media = getMediaIdAndType();

        if (!media) {
            currentMediaId = null;
            isUpdating = false;
            return;
        }

        if (media.id === currentMediaId) {
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

        const prev = h1.previousElementSibling;
        if (prev && prev.classList.contains('amt-wrap')) {
            prev.remove();
        }

        const wrap = buildWrap(h1.textContent);
        h1.parentNode.insertBefore(wrap, h1);

        try {
            const cached = getFromCache(media.id);
            let romaji, english, idMal, format, russian, ukrainian;

            if (cached && 'russian' in cached && 'ukrainian' in cached) {
                ({ romaji, english, idMal, format, russian, ukrainian } = cached);
            } else {
                if (cached?.romaji && cached?.idMal) {
                    romaji  = cached.romaji;
                    english = cached.english;
                    idMal   = cached.idMal;
                    format  = cached.format ?? null;
                } else {
                    try {
                        const anilistData = await fetchAniListData(media.id);
                        romaji  = anilistData.romaji;
                        english = anilistData.english;
                        idMal   = anilistData.idMal;
                        format  = anilistData.format;
                    } catch (e) {
                        logWarn(`AniList: failed to fetch media/${media.id} —`, e.message);
                        return;
                    }
                }

                const shikiType = getShikiType(media.anilistType);
                const hikkaType = getHikkaType(media.anilistType, format);

                logInfo(`Fetching titles — idMal=${idMal}, shiki=${shikiType}, hikka=${hikkaType}`);

                [russian, ukrainian] = await Promise.all([
                    'russian'   in (cached ?? {}) ? Promise.resolve(cached.russian)   : fetchShikimoriRussian(idMal, shikiType),
                    'ukrainian' in (cached ?? {}) ? Promise.resolve(cached.ukrainian) : fetchHikkaUkrainian(idMal, hikkaType),
                ]);

                setToCache(media.id, { romaji, english, idMal, format, russian, ukrainian });
            }

            fillWrap(wrap, { romaji, english, russian, ukrainian }, h1.textContent);

        } catch (e) {
            logWarn('Unexpected error —', e.message);
        } finally {
            isUpdating = false;
        }
    }

    const wrapHistory = (type) => {
        const orig = history[type];
        return function() {
            const res = orig.apply(this, arguments);
            setTimeout(updateTitle, 300);
            return res;
        };
    };
    history.pushState    = wrapHistory('pushState');
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
