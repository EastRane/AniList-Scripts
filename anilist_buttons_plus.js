// ==UserScript==
// @author      Deathwing, EastRane
// @name        AniList Buttons Plus
// @include     https://anilist.co/*
// @description A script that adds buttons on Anilist for searching various sites.
// @version     2.820-east2
// @grant       GM_addStyle
// @namespace   https://greasyfork.org/users/18375
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        .anilist-button-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 6px;
            margin-bottom: 4px;
        }
        .anilist-button-container a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 2px 6px;
            border-radius: 3px;
            text-decoration: none;
            background: color-mix(in srgb, rgba(var(--color-blue)), transparent 40%);
            color: #fff;
            transition: background 0.2s;
            font-size: 12px;
            height: 22px;
        }
        .anilist-button-container a:hover {
            color: #fff;
        }

        .anilist-button-container img {
            width: 18px;
            height: 18px;
            margin-right: 4px;
        }
    `);

    function getButtons(title, isManga) {
        const encoded = encodeURIComponent(title);
        const buttons =[];

        if (!isManga) {
            buttons.push(
                { title: "Animelib", url: `https://animelib.org/ru/catalog?q=${encoded}` },
                { title: "AnimeKai", url: `https://animekai.to/browser?keyword=${encoded}` },
                { title: "HiAnime", url: `https://hianime.to/search?keyword=${encoded}` },
                { title: "aniDB", url: `https://anidb.net/anime/?adb.search=${encoded}&do.search=1` }
            );
        }

        buttons.push({
            title: "Nyaa",
            url: isManga ?
                `https://nyaa.si/?f=0&c=3_1&q=${encoded}` :
                `https://nyaa.si/?f=0&c=1_2&q=${encoded}`
        });

        return buttons;
    }

    function createButtons(title, isManga) {
        const buttonsData = getButtons(title, isManga);
        const outerButtonsDiv = document.createElement('div');
        outerButtonsDiv.className = 'anilist-button-container';
        outerButtonsDiv.dataset.title = title;

        buttonsData.forEach(b => {
            const btn = document.createElement('a');
            btn.href = b.url;
            btn.target = '_blank';
            btn.title = b.title;

            const icon = document.createElement('img');
            const domain = b.url.match(/:\/\/(www\.)?(.[^/]+)/)[2];
            icon.src = `https://www.google.com/s2/favicons?domain=${domain}`;
            btn.appendChild(icon);

            const text = document.createElement('span');
            text.textContent = b.title;
            btn.appendChild(text);

            outerButtonsDiv.appendChild(btn);
        });

        return outerButtonsDiv;
    }

    let lastUrl = '';

    function checkAndInject() {
        const currentUrl = window.location.href;

        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            document.querySelectorAll('.anilist-button-container').forEach(el => el.remove());
        }

        const path = window.location.pathname;
        const animeMatch = path.match(/^\/anime\/\d+/);
        const mangaMatch = path.match(/^\/manga\/\d+/);
        if (!animeMatch && !mangaMatch) return;

        const isManga = !!mangaMatch;
        const header = document.querySelector('div.content h1');
        if (!header) return;

        let currentTitle = '';
        header.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) currentTitle += node.textContent;
        });
        currentTitle = currentTitle.trim();

        if (!currentTitle) return;

        const existingButtons = document.querySelector('.anilist-button-container');
        const isCorrectTitle = existingButtons && existingButtons.dataset.title === currentTitle;

        if (existingButtons && isCorrectTitle) return;

        if (existingButtons) existingButtons.remove();

        const buttonsBlock = createButtons(currentTitle, isManga);

        const scoresBlock = header.parentNode.querySelector('.user-script-ani-list-unlimited-scores');
        if (scoresBlock) {
            scoresBlock.parentNode.insertBefore(buttonsBlock, scoresBlock.nextSibling);
        } else {
            header.parentNode.insertBefore(buttonsBlock, header.nextSibling);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, arguments), wait);
        };
    }

    const debouncedInject = debounce(checkAndInject, 100);
    const observer = new MutationObserver(() => {
        debouncedInject();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    debouncedInject();

})();
