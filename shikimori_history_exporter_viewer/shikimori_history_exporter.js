// ==UserScript==
// @name         Shikimori History Exporter
// @author       EastRane
// @namespace    shikimori-history-exporter
// @version      1.0.0
// @description  Export Shikimori history directly into JSON grouped by Shikimori (MAL) ID
// @match        https://shikimori.one/*/history
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function capitalizeFirstLetter(text) {
        if (!text) return text;
        return text.length > 1 ? text[0].toUpperCase() + text.slice(1) : text.toUpperCase();
    }

    function formatDate(dateStr) {
        let d = new Date(dateStr);
        if (isNaN(d)) return "Unknown";
        return d.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // ------------------ SCROLLING ------------------
    function autoScrollToEnd(callback) {
        let lastCount = 0;
        let sameCount = 0;

        let interval = setInterval(() => {
            window.scrollTo(0, document.body.scrollHeight);
            let currentCount = document.querySelectorAll('.history-page .history-interval .b-user_history-line').length;

            if (currentCount === lastCount) sameCount++;
            else sameCount = 0;

            lastCount = currentCount;

            if (sameCount >= 5) {
                clearInterval(interval);
                callback();
            }
        }, 800);
    }

    // ------------------ DATA EXTRACTION ------------------
    function extractHistoryToJSON() {
        let lines = document.querySelectorAll('.history-page .history-interval .b-user_history-line');
        let result = {};

        lines.forEach(line => {
            let $line = $(line);

            // a.db-entry → ссылка на тайтл
            let a = $line.find('a.db-entry').first();
            let title = a.find('.name-en').text().trim() || "";
            let href = a.length ? a.attr('href') : "";

            // ---- ID ----
            let shikiId = null;
            if (href) {
                let m = href.match(/\/(animes|mangas|ranobe)\/([xyz]?\d+)/);
                if (m) {
                    let raw = m[2];
                    shikiId = raw.replace(/^[xyz]/, ""); // remove x/y/z prefix
                }
            }

            // ---- FULL TEXT ----
            let action = "";
            $line.find('span').first().contents().each(function() {
                if (!$(this).is('a')) {
                    let txt = $(this).text ? $(this).text() : this.nodeValue;
                    if (txt) action += txt;
                }
            });
            action = action.trim().replace(/\s+/g, " ");

            let fullText = title + (action ? ' ' + action : "");

            // ---- Extract action text ----
            let actionText = action;
            if (title && fullText.startsWith(title)) {
                actionText = fullText.slice(title.length).trim();
            }

            actionText = actionText.replace(/\s+/g, " ");
            actionText = capitalizeFirstLetter(actionText);

            // ---- DATE ----
            let timeEl = $line.find('time.date');
            let date = timeEl.length ? formatDate(timeEl.attr('datetime')) : "";

            // ---- Save ----
            if (!result[shikiId]) result[shikiId] = [];
            result[shikiId].push([date, actionText]);
        });

        return result;
    }

    // ------------------ EXPORT JSON ------------------
    function saveJSON(obj) {
        let json = JSON.stringify(obj, null, 2);
        let blob = new Blob([json], {type: "application/json;charset=utf-8"});
        let link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "shikimori_history.json";
        link.click();
    }

    // ------------------ BUTTON ------------------
    function addExportButton() {
        let btn = document.createElement('button');
        btn.innerText = "Export Shikimori History";
        btn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            padding: 10px 15px;
            border: none;
            background: #3b82f6;
            color: #fff;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        `;

        btn.onclick = () => {
            btn.innerText = "Scrolling...";
            autoScrollToEnd(() => {
                btn.innerText = "Parsing...";
                let json = extractHistoryToJSON();
                btn.innerText = "Saving...";
                saveJSON(json);
                btn.innerText = "Export Shikimori History";
            });
        };

        document.body.appendChild(btn);
    }

    addExportButton();
})();
