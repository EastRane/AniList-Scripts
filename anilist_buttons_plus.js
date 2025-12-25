// ==UserScript==
// @author      Deathwing, EastRane
// @name        AniList Buttons Plus
// @include     https://anilist.co/*
// @description A script that adds buttons on Anilist for searching various sites.
// @version     2.820-east
// @grant       GM_addStyle
// @grant       window.onurlchange
// @namespace   https://greasyfork.org/users/18375
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
    .anilist-button-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
        margin-bottom: 8px;
    }
    .anilist-button-container a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 6px;
        border-radius: 4px;
        text-decoration: none;
        background: #176297;
        border: 1px solid #1B2F7B;
        color: #fff;
        transition: background 0.2s;
        font-size: 12px;
    }
    .anilist-button-container a:hover {
        background: #0f4064;
    }
    .anilist-button-container img {
        width: 18px;
        height: 18px;
        margin-right: 4px;
    }
`);

    let outerButtonsDiv = null;
    let lastTitle = '';

    function getButtons(title) {
        const encoded = encodeURIComponent(title);
        const isManga = window.location.pathname.includes('/manga/');

        const buttons = [];

        if (!isManga) {
            buttons.push(
				{
					title: "Animelib",
					url: `https://animelib.org/ru/catalog?q=${encoded}`
				},
				{
					title: "AnimeKai",
					url: `https://animekai.to/browser?keyword=${encoded}`
				},
				{
					title: "HiAnime",
					url: `https://hianime.to/search?keyword=${encoded}`
				},
				{
					title: "aniDB",
					url: `https://anidb.net/anime/?adb.search=${encoded}&do.search=1`
				}
			);
        }

        buttons.push(
            {
                title: "Nyaa",
                url: isManga ?
                    `https://nyaa.si/?f=0&c=3_1&q=${encoded}` :
                    `https://nyaa.si/?f=0&c=1_2&q=${encoded}`
            }
        )

        return buttons;
    }

    function createButtons(title) {
        const buttonsData = getButtons(title);
        outerButtonsDiv = document.createElement('div');
        outerButtonsDiv.className = 'anilist-button-container';

        buttonsData.forEach(b => {
            const btn = document.createElement('a');
            btn.href = b.url;
            btn.target = '_blank';
            btn.title = b.title;

            const icon = document.createElement('img');
            icon.src = `https://www.google.com/s2/favicons?domain=${b.url.match(/:\/\/(www\.)?(.[^/]+)/)[2]}`;
            btn.appendChild(icon);

            const text = document.createElement('span');
            text.textContent = b.title;
            btn.appendChild(text);

            outerButtonsDiv.appendChild(btn);
        });

        return outerButtonsDiv;
    }

    function insertButtons() {
        const path = window.location.pathname;
        if (!/^\/(anime|manga)\/\d+/.test(path)) {
            return;
        }

        const header = document.querySelector('div.content h1');
        if (!header) return;

        let currentTitle = '';
        header.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) currentTitle += node.textContent;
        });
        currentTitle = currentTitle.trim();

        if (!currentTitle) return;

        const parent = header.parentNode;
        const existingButtons = parent.querySelector('.anilist-button-container');

        const isCorrectTitle = existingButtons && existingButtons.dataset.title === currentTitle;

        if (!existingButtons || !isCorrectTitle) {
            if (existingButtons) existingButtons.remove();

            const buttonsBlock = createButtons(currentTitle);
            buttonsBlock.dataset.title = currentTitle;
            header.parentNode.insertBefore(buttonsBlock, header.nextSibling);
        }
    }

    // SPA-aware MutationObserver
    const contentRoot = document.querySelector('div.content') || document.body;
    const observer = new MutationObserver(() => {
        insertButtons();
    });
    observer.observe(contentRoot, {
        childList: true,
        subtree: true
    });

    // hijack history.pushState/replaceState
    const _wr = type => {
        const orig = history[type];
        return function() {
            const rv = orig.apply(this, arguments);
            window.dispatchEvent(new Event(type));
            return rv;
        };
    };
    history.pushState = _wr("pushState");
    history.replaceState = _wr("replaceState");

    let lastPath = location.pathname + location.search + location.hash;

    function handleUrlChange() {
        const cur = location.pathname + location.search + location.hash;
        if (cur === lastPath) return;
        lastPath = cur;
        insertButtons();
    }

    window.addEventListener("pushState", handleUrlChange);
    window.addEventListener("replaceState", handleUrlChange);
    window.addEventListener("popstate", handleUrlChange);
    document.addEventListener("click", () => setTimeout(handleUrlChange, 50), true);

    insertButtons();
})();