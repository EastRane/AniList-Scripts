// ==UserScript==
// @name         Automail Fixes
// @description  Small fixes to hoh's Automail script
// @author       EastRane
// @version      1.0.2
// @match        https://anilist.co/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {

    const ModuleManager = {
        modules: {},

        register(name, fn, enabledByDefault = true) {
            this.modules[name] = {
                fn,
                enabledByDefault
            };
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
                    } catch (e) {
                        console.error(`Module ${name} error:`, e);
                    }
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
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
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
                position: "absolute",
                top: "18px",
                right: "24px",
                fontSize: "24px",
                cursor: "pointer",
                color: "rgb(var(--color-text))",
                opacity: 0.75,
                transition: "0.2s",
                zIndex: 10001
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
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                resize: "none",
                width: "57.3vw",
                maxHeight: "80vh",
                overflow: "hidden",
                background: "rgb(var(--color-background))",
                color: "rgb(var(--color-text))",
                borderRadius: "4px",
                border: "none",
                boxShadow: "0 0 30px rgba(0,0,0,0.65)",
                padding: "0",
                zIndex: 9999,
            });

            if (title) Object.assign(title.style, {
                display: "block",
                position: "sticky",
                top: "0",
                zIndex: 1000,
                padding: "16px 16px 16px 24px",
                fontSize: "24px",
                fontWeight: "600",
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
                maxWidth: "100%",
                wordWrap: "break-word",
                boxSizing: "border-box",
                background: "rgb(var(--color-foreground))",
                padding: "16px",
                borderRadius: "4px",
                margin: "16px 0",
            });

            const closeFn = () => {
                box.remove();
                overlay.remove();
            };
            const overlay = createOverlay(closeFn);
            const closeBtn = createCloseButton(closeFn);
            box.appendChild(closeBtn);
        }

        // Function to apply styles to elements inside the dialog window
        function applyNoteStyles() {
            const box = document.querySelector(".hohDisplayBox");
            if (!box) return;

            const scrollContent = box.querySelector(".scrollableContent");
            if (!scrollContent) return;

            // Style <hr>
            const hrElements = scrollContent.querySelectorAll("hr");
            hrElements.forEach(hr => {
                if (hr.dataset.styledByAutomailFixes) return;
                hr.dataset.styledByAutomailFixes = "true";
                Object.assign(hr.style, {
                    border: "none",
                    borderTop: "1px solid rgb(var(--color-border))",
                    margin: "16px 0",
                    opacity: "0.3"
                });
            });

            // Style .hohTimelineEntry (only main entries, not .replies)
            const timelineEntries = scrollContent.querySelectorAll(".hohTimelineEntry:not(.replies)");
            timelineEntries.forEach(entry => {
                if (entry.dataset.styledByAutomailFixes) return;
                entry.dataset.styledByAutomailFixes = "true";

                Object.assign(entry.style, {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "rgb(var(--color-foreground))",
                    borderRadius: "4px",
                    marginBottom: "8px",
                    border: "1px solid rgb(var(--color-border))",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease"
                });

                entry.addEventListener('mouseenter', () => {
                    if (!entry.dataset.collapsed) {
                        entry.style.backgroundColor = "rgba(var(--color-foreground), 0.7)";
                    }
                });
                entry.addEventListener('mouseleave', () => {
                    if (!entry.dataset.collapsed) {
                        entry.style.backgroundColor = "rgb(var(--color-foreground))";
                    }
                });

                entry.addEventListener('click', () => {
                    const nextElement = entry.nextElementSibling;
                    if (nextElement && nextElement.classList.contains('hohTimelineEntry') && nextElement.classList.contains('replies')) {
                        if (nextElement.style.display === 'none') {
                            nextElement.style.display = 'flex';
                            entry.dataset.collapsed = 'false';
                            entry.style.backgroundColor = "rgb(var(--color-foreground))";
                        } else {
                            nextElement.style.display = 'none';
                            entry.dataset.collapsed = 'true';
                            entry.style.backgroundColor = "rgba(var(--color-foreground), 0.5)";
                        }
                    }
                });

                // Style link inside .hohTimelineEntry
                const link = entry.querySelector("a.newTab");
                if (link && !link.dataset.styledByAutomailFixes) {
                    link.dataset.styledByAutomailFixes = "true";
                    Object.assign(link.style, {
                        color: "rgb(var(--color-primary))",
                        textDecoration: "none",
                        fontWeight: "600",
                        fontSize: "16px"
                    });
                    link.addEventListener('mouseenter', () => link.style.textDecoration = "underline");
                    link.addEventListener('mouseleave', () => link.style.textDecoration = "none");
                }

                // Style date inside .hohTimelineEntry
                const dateSpan = entry.querySelector("span[title]");
                if (dateSpan && !dateSpan.dataset.styledByAutomailFixes) {
                    dateSpan.dataset.styledByAutomailFixes = "true";
                    dateSpan.style.position = "";
                    dateSpan.style.right = "";
                    dateSpan.style.marginLeft = "auto";
                    dateSpan.style.color = "rgb(var(--color-text-secondary))";
                    dateSpan.style.fontSize = "14px";
                    dateSpan.style.fontWeight = "400";
                }
            });

            // Style .hohTimelineEntry.replies
            const replyEntries = scrollContent.querySelectorAll(".hohTimelineEntry.replies");
            replyEntries.forEach(replyEntry => {
                if (replyEntry.dataset.styledRepliesByAutomailFixes) {
                    return;
                }
                replyEntry.dataset.styledRepliesByAutomailFixes = "true";
                Object.assign(replyEntry.style, {
                    marginLeft: "30px",
                    marginTop: "8px",
                    borderRadius: "4px",
                    display: "flex",
                    flexDirection: "column"
                });

                // Find and style existing reply elements in this container
                const existingReplies = replyEntry.querySelectorAll(".reply");
                existingReplies.forEach(styleReplyContent);
            });
        }

        // Helper function to style the content of .reply
        function styleReplyContent(reply) {
            if (reply.dataset.styledByAutomailFixes) {
                return;
            }
            reply.dataset.styledByAutomailFixes = "true";

            // Style the .reply container
            Object.assign(reply.style, {
                padding: "12px 16px",
                background: "rgb(var(--color-background), .7)",
                borderRadius: "4px",
                marginBottom: "8px",
                border: "1px solid rgb(var(--color-border))",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                color: "rgb(var(--color-text))",
                lineHeight: "1.5"
            });

            // Style the username
            const nameSpan = reply.querySelector(".name");
            if (nameSpan && !nameSpan.dataset.styledByAutomailFixes) {
                nameSpan.dataset.styledByAutomailFixes = "true";
                Object.assign(nameSpan.style, {
                    color: "rgb(var(--color-primary))",
                    fontWeight: "600",
                    fontSize: "16px",
                    display: "block",
                    marginBottom: "4px",
                });
            }
        }

        const observer = new MutationObserver((mutationsList) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    const box = document.querySelector(".hohDisplayBox");
                    if (box) {
                        restyleBox(box);
                        // Apply styles to content after restyling the box
                        applyNoteStyles();
                        // Set up observer for content changes
                        let contentObserver = null;
                        if (contentObserver) {
                            contentObserver.disconnect();
                        }
                        contentObserver = new MutationObserver(applyNoteStyles);
                        contentObserver.observe(box, {
                            childList: true,
                            subtree: true
                        });
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

    });

    ModuleManager.initAll();

})();