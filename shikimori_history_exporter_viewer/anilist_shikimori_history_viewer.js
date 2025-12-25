// ==UserScript==
// @name         AniList Shikimori History Viewer
// @namespace    anilist-shikimori-history-viewer
// @version      1.1.0
// @description  Shows history from exported Shikimori History JSON on Anilist social page
// @author       you
// @match        https://anilist.co/*
// @grant        none
// ==/UserScript==

(function() {
		"use strict";

		let loadingInProgress = false;

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
			const entry = {
				timestamp: Date.now(),
				data
			};
			try {
				localStorage.setItem(key, JSON.stringify(entry));
			} catch (e) {
				// localStorage full or disabled
			}
		}

		async function loadShikiHistory() {
			if (document.getElementById("shikiHistoryBlock") || loadingInProgress) return;
			loadingInProgress = true;

			try {
				if (!location.pathname.includes("/social")) {
					loadingInProgress = false;
					return;
				}
				const match = location.pathname.match(/\/(anime|manga|ranobe|novel)\/(\d+)/);
				if (!match) {
					loadingInProgress = false;
					return;
				}

				const anilistId = parseInt(match[2], 10);

				let idMal = null;
				const cached = getFromCache(anilistId);
				if (cached && cached.idMal != null) {
					idMal = cached.idMal;
				} else {
					const gql = {
						query: `
          query ($id: Int!) {
            Media(id: $id) { idMal }
          }
        `,
						variables: {
							id: anilistId
						}
					};

					const gqlRes = await fetch("https://graphql.anilist.co", {
						method: "POST",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify(gql)
					});

					const data = await gqlRes.json();
					idMal = data?.data?.Media?.idMal;

					setToCache(anilistId, {idMal});
				}

				if (!idMal) {
					loadingInProgress = false;
					return;
				}

				const shikiEvents = EVENTS_BY_SHIKI_ID[String(idMal)];
				if (!shikiEvents || !shikiEvents.length) {
					loadingInProgress = false;
					return;
				}

				await waitForElement("#activityTimeline", 10000);
				const timeline = document.getElementById("activityTimeline");
				if (!timeline) {
					loadingInProgress = false;
					return;
				}

				renderEventsBlock(shikiEvents, timeline);
				loadingInProgress = false;

			} catch (err) {
				console.error("Shikimori History Viewer error:", err);
				loadingInProgress = false;
			}
		}

		function waitForElement(selector, timeout = 5000) {
			return new Promise(resolve => {
				const el = document.querySelector(selector);
				if (el) return resolve(el);

				let resolved = false;
				const mo = new MutationObserver(() => {
					const e = document.querySelector(selector);
					if (e && !resolved) {
						resolved = true;
						mo.disconnect();
						resolve(e);
					}
				});
				mo.observe(document.body, {
					childList: true,
					subtree: true
				});

				setTimeout(() => {
					if (!resolved) {
						resolved = true;
						mo.disconnect();
						resolve(null);
					}
				}, timeout);
			});
		}

		function formatTimelineDate_isoInput(dateIso) {
			const dateObj = new Date(dateIso);
			const short = dateObj.toLocaleDateString("en-UK", {
				weekday: "short",
				day: "2-digit",
				month: "short",
				year: "numeric"
			});
			const pad = n => String(n).padStart(2, "0");
			const full = `${pad(dateObj.getDate())}.${pad(dateObj.getMonth()+1)}.${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
			return {
				short,
				full
			};
		}

		function renderEventsBlock(events, timelineElement) {
			if (document.getElementById("shikiHistoryBlock")) return;

			const container = document.createElement("div");
			container.id = "shikiHistoryBlock";
			container.style.marginTop = "12px";

			const title = document.createElement("h2");
			title.textContent = "Shikimori History";
			title.style.marginTop = "20px";
			container.appendChild(title);

			const listContainer = document.createElement("div");
			container.appendChild(listContainer);
			timelineElement.parentNode.insertBefore(container, timelineElement.nextSibling);

			for (const [dateStr, action] of events) {
				const entry = document.createElement("div");
				entry.className = "hohTimelineEntry";

				const actionNode = document.createElement("a");
				actionNode.className = "newTab";
				actionNode.href = "#";
				actionNode.textContent = action;
				actionNode.style.color = "inherit";
				actionNode.style.textDecoration = "none";

				const {
					short,
					full
				} = formatTimelineDate_isoInput(dateStr);
				const dateNode = document.createElement("span");
				dateNode.textContent = " " + short;
				dateNode.title = full;

				entry.appendChild(actionNode);
				entry.appendChild(dateNode);
				listContainer.appendChild(entry);
			}
		}

		(function hijackHistoryEvents() {
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
		})();

		let lastPath = location.pathname + location.search + location.hash;

		function handleUrlChange() {
			const cur = location.pathname + location.search + location.hash;
			if (cur === lastPath) return;
			lastPath = cur;
			if (cur.includes("/social")) setTimeout(() => {
				if (!document.getElementById("shikiHistoryBlock")) loadShikiHistory();
			}, 200);
		}

		window.addEventListener("pushState", handleUrlChange);
		window.addEventListener("replaceState", handleUrlChange);
		window.addEventListener("popstate", handleUrlChange);
		document.addEventListener("click", () => setTimeout(handleUrlChange, 80), true);

		if (location.pathname.includes("/social")) setTimeout(() => {
			loadShikiHistory();
		}, 200);

        const EVENTS_BY_SHIKI_ID = {};

})();