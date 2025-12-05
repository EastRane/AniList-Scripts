// ==UserScript==
// @name         Automail Fixes
// @description  Small fixes to hoh's Automail script
// @author       EastRane
// @version      1.0.0
// @match        https://anilist.co/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {

    const ModuleManager = {
        modules: {},

        register(name, fn, enabledByDefault = true) {
            this.modules[name] = { fn, enabledByDefault };
        },

        isEnabled(name) {
            const val = GM_getValue(`module_${name}`);
            if (val === undefined) return this.modules[name].enabledByDefault;
            return val;
        },

        setEnabled(name, value) {
            GM_setValue(`module_${name}`, value);
        },

        initAll() {
            for (const name in this.modules) {
                if (this.isEnabled(name)) {
                    try {
                        this.modules[name].fn();
                    } catch(e) { console.error(`Module ${name} error:`, e); }
                }
            }
        }
    };

    // begin modules/dialogWindowRedesign
    ModuleManager.register("dialogWindowRedesign", function() {

        function createOverlay(onClose) {
            const overlay = document.createElement("div");
            overlay.id = "floaty-overlay";
            Object.assign(overlay.style, {
                position: "fixed", top: 0, left: 0,
                width: "100vw", height: "100vh",
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(2px)",
                zIndex: 9000,
            });
            overlay.onclick = onClose;
            document.body.appendChild(overlay);
            return overlay;
        }

        function createCloseButton(onClose) {
            const btn = document.createElement("div");
            btn.textContent = "✕";
            Object.assign(btn.style, {
                position: "absolute", top: "18px", right: "24px",
                fontSize: "24px", cursor: "pointer",
                color: "rgb(var(--color-text))", opacity: 0.75,
                transition: "0.2s", zIndex: 10001
            });
            btn.onmouseover = () => btn.style.opacity = "1";
            btn.onmouseout = () => btn.style.opacity = "0.75";
            btn.onclick = onClose;
            return btn;
        }

        function restyleBox(box) {
            if (box.dataset.restyled) return;
            box.dataset.restyled = "1";

            box.onmousedown = null;
            box.style.pointerEvents = "auto";
            const pearl = box.querySelector(".hohResizePearl");
            if (pearl) pearl.style.display = "none";

            const title = box.querySelector(".hohDisplayBoxTitle");
            const scroll = box.querySelector(".scrollableContent");
            const p = scroll?.querySelector("p");

            Object.assign(box.style, {
                position: "fixed", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                resize: "none", width: "57.3vw", maxHeight: "80vh",
                overflow: "hidden", background: "rgb(var(--color-background))",
                color: "rgb(var(--color-text))", borderRadius: "14px",
                border: "none", boxShadow: "0 0 30px rgba(0,0,0,0.65)",
                padding: "0", zIndex: 9999,
            });

            if (title) Object.assign(title.style, {
                display: "block", position: "sticky",
                top: "0", zIndex: 1000,
                padding: "16px 16px 16px 24px",
                fontSize: "24px", fontWeight: "600",
                color: "rgb(var(--color-text))",
                background: "#152232",
            });

            if (scroll) Object.assign(scroll.style, {
                padding: "8px 48px 16px 48px",
                overflowY: "auto",
                maxHeight: "calc(80vh - 100px)",
                maxWidth: "57.3vw",
                boxSizing: "border-box",
                scrollbarGutter: "stable",
            });

            if (p) Object.assign(p.style, {
                color: "rgb(var(--color-text))",
                maxWidth: "100%", wordWrap: "break-word",
                boxSizing: "border-box",
                background: "rgb(var(--color-foreground))",
                padding: "16px", borderRadius: "6px",
                margin: "16px 0",
            });

            const closeFn = () => { box.remove(); overlay.remove(); };
            const overlay = createOverlay(closeFn);
            const closeBtn = createCloseButton(closeFn);
            box.appendChild(closeBtn);
        }

        const observer = new MutationObserver(() => {
            const box = document.querySelector(".hohDisplayBox");
            if (box) restyleBox(box);
        });

        observer.observe(document.body, { childList: true, subtree: true });

    });

    ModuleManager.initAll();

})();
