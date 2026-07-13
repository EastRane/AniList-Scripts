// ==UserScript==
// @name         AniList Wallhaven XML Exporter
// @namespace    anilist-wallhaven-exporter
// @version      1.0.0
// @description  Exports all the checkboxed animes for wallhaven JBS sets
// @author       EastRane
// @match        https://anilist.co/user/*/animelist*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const MIN_SCORE = 7;

    const style = document.createElement('style');
    style.textContent = `
        .entry.row { position: relative; }
        .east-checkbox-wrap { display: flex; align-items: center; justify-content: center; padding: 0 10px; z-index: 10; }
        .east-xml-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: rgb(var(--color-blue)); }
        #east-xml-status {
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            background: rgb(var(--color-foreground)); color: rgb(var(--color-text));
            padding: 12px 16px; border-radius: 6px; font-size: 13px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(var(--color-blue), 0.3);
            display: flex; align-items: center; gap: 12px;
        }
        .east-btn {
            background: rgb(var(--color-blue)); color: rgb(var(--color-white));
            padding: 8px 12px; border-radius: 4px; cursor: pointer;
            font-size: 1.2rem; font-weight: 600; margin-left: 8px;
            transition: .2s; display: inline-flex; align-items: center;
        }
        .east-btn:hover { opacity: 0.8; }
        .east-btn-reset { background: rgb(var(--color-red)); }
        .east-download-btn { background: #23a158; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .east-download-btn:hover { opacity: 0.9; }
    `;
    document.head.appendChild(style);

    const statusBar = document.createElement('div');
    statusBar.id = 'east-xml-status';
    statusBar.innerHTML = `
        <span id="east-xml-count">Chosen for XML: 0</span>
        <button id="east-download-trigger" class="east-download-btn">Download XML</button>
    `;
    document.body.appendChild(statusBar);

    function cleanTitle(title) {
        let clean = title.trim();

        clean = clean.replace(/[\s\-\(]+season\s+\d+\)?/i, '');
        clean = clean.replace(/[\s\-\(]+\d+(st|nd|rd|th)\s+season\)?/i, '');
        clean = clean.replace(/[\s\-\(]+(part|cour)\s+(\d+|[ivx]+)\)?/i, '');
        clean = clean.replace(/[\s\-\:\(]+[IVX]+\)?$/i, '');

        clean = clean.replace(/[\s\-\:\(]+[2-9]\)?$/, '');

        return clean.replace(/[\s\-\:\!]+$/, '').trim();
    }

    function makeXmlTemplate(title) {
        return `<WallhavenSet>
      <SortOrder>Random</SortOrder>
      <General>false</General>
      <Anime>true</Anime>
      <People>false</People>
      <SFW>true</SFW>
      <Sketchy>false</Sketchy>
      <NSFW>false</NSFW>
      <SearchTerms>${title}</SearchTerms>
      <Enabled>true</Enabled>
    </WallhavenSet>`;
    }

    function updateCount() {
        const checkedCount = document.querySelectorAll('.east-xml-checkbox:checked').length;
        document.getElementById('east-xml-count').textContent = `Chosen for XML: ${checkedCount}`;
    }

    function selectByScore() {
        const checkboxes = document.querySelectorAll('.east-xml-checkbox');
        checkboxes.forEach(cb => {
            const row = cb.closest('.entry.row');
            if (!row) return;
            const scoreEl = row.querySelector('.score');
            if (scoreEl) {
                const score = parseFloat(scoreEl.textContent.trim());
                if (!isNaN(score) && score >= MIN_SCORE) {
                    cb.checked = true;
                }
            }
        });
        updateCount();
    }

    function resetAllCheckboxes() {
        const checkboxes = document.querySelectorAll('.east-xml-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        updateCount();
    }

    document.getElementById('east-download-trigger').onclick = () => {
        const checkedBoxes = document.querySelectorAll('.east-xml-checkbox:checked');
        if (checkedBoxes.length === 0) {
            alert('No anime selected!');
            return;
        }

        const uniqueTitles = new Set();

        checkedBoxes.forEach(cb => {
            const row = cb.closest('.entry.row');
            const link = row ? row.querySelector('.title a') : null;
            if (link) {
                const rawTitle = link.textContent.trim();
                const cleaned = cleanTitle(rawTitle);
                if (cleaned) {
                    uniqueTitles.add(cleaned);
                }
            }
        });

        let xmlContent = "";
        const titlesArray = Array.from(uniqueTitles);

        titlesArray.forEach((title, index) => {
            xmlContent += makeXmlTemplate(title);
            if (index < titlesArray.length - 1) {
                xmlContent += "\n";
            }
        });

        const blob = new Blob([xmlContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "wallhaven_sets.txt");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    function injectCheckboxes() {
        const entries = document.querySelectorAll('.entry.row');
        entries.forEach(entry => {
            if (entry.querySelector('.east-checkbox-wrap')) return;

            const checkboxWrap = document.createElement('div');
            checkboxWrap.className = 'east-checkbox-wrap';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'east-xml-checkbox';
            checkbox.addEventListener('change', updateCount);

            checkboxWrap.appendChild(checkbox);
            entry.insertBefore(checkboxWrap, entry.firstChild);
        });
    }

    function injectButtons() {
        if (document.querySelector('.east-scan-btn')) return;

        const filters = document.querySelector('.filters-wrap .filter-group:last-child') || document.querySelector('.filters-wrap');
        if (!filters) return;

        const btnSelect = document.createElement('div');
        btnSelect.className = 'east-btn east-scan-btn';
        btnSelect.innerHTML = `✅ Score ${MIN_SCORE}+`;
        btnSelect.onclick = selectByScore;

        const btnReset = document.createElement('div');
        btnReset.className = 'east-btn east-btn-reset';
        btnReset.innerHTML = '❌ Reset';
        btnReset.onclick = resetAllCheckboxes;

        filters.appendChild(btnSelect);
        filters.appendChild(btnReset);
    }

    setInterval(() => {
        injectCheckboxes();
        injectButtons();
    }, 1000);

})();
