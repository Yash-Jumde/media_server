# MediaVault Codebase Report

## 1. Project Overview
**MediaVault** is a self-hosted, full-stack personal media server designed to stream movies, TV shows, audio, and images across a local network. It serves as a lightweight alternative to platforms like Plex or Jellyfin, offering features like metadata scraping, playback progress tracking, and on-the-fly transcoding for non-native web formats.

**Technology Stack:**
- **Backend:** Node.js (Express)
- **Frontend:** Next.js (React) with Tailwind-like CSS Modules
- **Database:** SQLite3
- **Media Processing:** FFmpeg (via `fluent-ffmpeg` and static binaries)
- **Metadata:** TMDB (The Movie Database) API
- **Authentication:** JWT (JSON Web Tokens)

---

## 2. How it Works

### Architecture
The project follows a decoupled client-server architecture:
- **Backend (`server/`):** A RESTful API that handles file system scanning, database management, user authentication, and media streaming logic.
- **Frontend (`frontend/`):** A modern Next.js application that provides a responsive, Netflix-style user interface.
- **Data Persistence:** A single SQLite database (`database/media.db`) stores media metadata, user accounts, playback history, and favorites.

### Key Logic & Data Flow
1.  **Library Synchronization:** Upon startup or manual trigger, `server/utils/fileScanner.js` crawls the `media/` directory. It uses `ffprobe` to extract durations and `syncMediaWithDatabase` to reconcile the file system with the SQLite database.
2.  **Metadata Enrichment:** The `TMDBScraper` service identifies movies and TV shows based on filenames, fetching posters, backdrops, ratings, and plot summaries from TMDB.
3.  **Streaming Strategy:**
    - **Native:** For MP4/WebM, it uses `rangeRequest.js` for seekable byte-range streaming.
    - **Live Transcoding:** For formats like MKV/AVI, it pipes a live FFmpeg transcode (MP4) to the browser.
    - **Cached Remuxing:** Background tasks automatically convert MKV files to MP4 to avoid CPU-heavy live transcoding on subsequent plays.
4.  **Frontend Integration:** The React frontend fetches the entire library via `/api/media` and handles navigation via a centralized `Shell` component. Playback is managed by a custom `Player.js` component that handles seeking logic for both native and transcoded streams.

---

## 3. Features Implemented

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Library Scanning** | ✅ Correct | Correctly categorizes Movies, TV Shows, Audio, and Images. Handles TV show nesting. |
| **TMDB Metadata** | ✅ Correct | Rich metadata (posters, genres, ratings) is correctly fetched and cached. |
| **Streaming (MP4)** | ✅ Correct | Smooth playback with full seek support via Range headers. |
| **Streaming (MKV)** | ⚠️ Partial | Works via live-transcoding on Desktop, but iOS requires waiting for full background transcode to finish. |
| **Continue Watching** | ✅ Correct | Playback progress is saved every few seconds and restored on resume. |
| **TV Show Resume** | ✅ Correct | Suggests the next episode if the current one is finished (>95%). |
| **Recommendations** | ✅ Correct | Genre-based recommendation engine working via `/api/recommendations/:id`. |
| **Search** | ⚠️ Limited | Implemented as client-side filtering. Performance will degrade with large libraries. |
| **Adaptive (HLS)** | ❌ Incomplete | Backend generates HLS files, but the Next.js Player currently only uses progressive MP4. |

---

## 4. Code Quality

### Strengths
- **Modular Design:** API routes are well-separated (`media.js`, `tvshows.js`, `stream.js`).
- **Media Handling:** Smart use of hardware acceleration (`getHWEncoder` in `utils/helpers.js`) and background processing to minimize CPU impact.
- **Security:** Proper implementation of JWT with `helmet` for security headers and `bcrypt` for password hashing.
- **Portability:** Uses relative paths in the database, allowing the media directory to be moved without breaking history.

### Concerns / Bad Practices
- **Scalability:** The `/api/media` endpoint returns the **entire library** in a single JSON object. For libraries with >1000 items, this will cause significant lag and high memory usage on the frontend.
- **Duplicate Frontend:** Resolved. The legacy vanilla JS frontend (`client/`) has been removed in favor of the Next.js implementation.
- **"God Component":** `frontend/components/Player.js` is over 850 lines long. It handles state for controls, transcode polling, keyboard shortcuts, and UI, making it difficult to maintain.
- **Performance:** `server/routes/tvshows.js` (`/tv-shows` route) performs a synchronous file system scan instead of querying the database, which is much slower.

---

## 5. Missing Features
1.  **Pagination/Infinite Scroll:** Essential for handling large media collections.
2.  **Transcode Quality Selection:** Currently, transcoding uses fixed bitrates/resolutions.
3.  **Subtitle/Audio Track Selection:** Users cannot currently switch between embedded subtitle tracks or audio languages.
4.  **Admin Dashboard:** A UI to manage users, monitor transcode tasks, and view server logs directly.
5.  **Multi-user Playlists:** Ability for users to create and share custom media collections.

---

## 6. Recommendations

### Priority 1: Performance & Scalability
- **Implement Pagination:** Modify `/api/media` and the frontend to use paginated results or infinite scrolling.
- **Database-First TV Shows:** Update the `/api/tv-shows` route to use the SQLite database instead of scanning the disk on every request.

### Priority 2: Technical Debt
- **Clean up Legacy Code:** ✅ Done. The `client/` directory and related legacy assets have been deleted.
- **Refactor Player:** ✅ Done. `Player.js` has been broken down into smaller components (`ProgressBar`, `Controls`, `VideoElement`) and custom hooks (`usePlayerShortcuts`).

### Priority 3: Feature Parity
- **Enable HLS Playback:** Connect the backend's HLS generation to the frontend player (using `hls.js`). This would provide a much better experience on iOS and support adaptive bitrate for varying network conditions.
- **Track Selection:** Add UI controls in the Player to allow switching between available subtitle and audio streams found in the media file.

### Priority 4: User Experience
- **Transcode Queue UI:** Show a "Transcoding Queue" in the library so users know which MKV files are being processed in the background.
- **Manual Metadata Fix:** Add an option to manually search/fix TMDB matches when the automatic detection fails.
