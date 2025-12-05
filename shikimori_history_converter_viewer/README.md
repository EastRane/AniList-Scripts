# AniList-Scripts
A bunch of self-written and modified community scripts for anilist.co

## Shikimori History Converter & Viewer

Lets you view your Shikimori history on the AniList Social tab of an anime or manga page.

**How it works**: it converts all entries on your Shikimori history page into a JSON file. Then the contents of a result file is pasted into another script. It will display all relevant Shikimori entries from the JSON for the current anime or manga page on AniList ("Social" tab).

### Instructions
1. Install "Shikimori History Exporter" script.
2. Go to "shikimori.one/user/history" page and press "Export Shikimori History" button.
3. Download a result file "shikimori_history.json".
4. Install "AniList Shikimori History Viewer" script.
5. Paste the contents of a "shikimori_history.json" file into "const EVENTS_BY_SHIKI_ID = {};" line inside of "AniList Shikimori History Viewer" script.

![Step 5 visualization](/screenshots/step5.png)

6. Enjoy!