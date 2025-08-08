class MediaPlayer {
    constructor() {
        this.player = document.getElementById('video-player');
        this.modal = document.getElementById('player-modal');
        this.mediaContainer = document.querySelector('#content');
        this.categories = {};
        this.currentView = 'categories'; // 'categories', 'tv-show-episodes'
        this.currentTvShow = null;
        this.setupEventListeners();
        this.addKeyboardShortcutsInfo();
        this.checkAuth();
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }
       
        this.loadMedia();
    }

    setupEventListeners() {
        this.modal.addEventListener('click', (e) => {
            if(e.target === this.modal) {
                this.close();
            }
        });

        document.getElementById('search').addEventListener('input', (e) => {
            this.filterMedia(e.target.value);
        });

        document.getElementById('back-button').addEventListener('click', () => {
            this.close();
        });

        // Enhanced keyboard controls for the player
        document.addEventListener('keydown', (e) => {
            // Only process shortcuts when video player is visible
            if (this.modal.classList.contains('hidden')) return;
           
            switch(e.key.toLowerCase()) {
                case 'escape':
                    this.close();
                    break;
                case 'f':
                    this.toggleFullscreen();
                    break;
                case 'm':
                    this.toggleMute();
                    break;
                case ' ':  // Spacebar
                    this.togglePlayPause();
                    e.preventDefault(); // Prevent page scrolling
                    break;
                case 'arrowright':
                    this.seek(10); // Forward 10 seconds
                    e.preventDefault();
                    break;
                case 'arrowleft':
                    this.seek(-10); // Backward 10 seconds
                    e.preventDefault();
                    break;
                case 'arrowup':
                    this.changeVolume(0.1); // Increase volume by 10%
                    e.preventDefault();
                    break;
                case 'arrowdown':
                    this.changeVolume(-0.1); // Decrease volume by 10%
                    e.preventDefault();
                    break;
            }
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (this.player.requestFullscreen) {
                this.player.requestFullscreen();
            } else if (this.player.webkitRequestFullscreen) {
                this.player.webkitRequestFullscreen();
            } else if (this.player.msRequestFullscreen) {
                this.player.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    toggleMute() {
        this.player.muted = !this.player.muted;
    }

    togglePlayPause() {
        if (this.player.paused || this.player.ended) {
            this.player.play();
        } else {
            this.player.pause();
        }
    }

    seek(seconds) {
        this.player.currentTime += seconds;
    }

    changeVolume(delta) {
        let newVolume = Math.max(0, Math.min(1, this.player.volume + delta));
        this.player.volume = newVolume;
    }

    loadSubtitles(mediaFile) {
        const token = localStorage.getItem('token');
        const videoElement = this.player;
       
        while (videoElement.firstChild) {
            videoElement.removeChild(videoElement.firstChild);
        }
       
        const baseFilename = mediaFile.name.substring(0, mediaFile.name.lastIndexOf('.'));
        const subtitleUrl = `/subtitles/${encodeURIComponent(baseFilename)}?token=${token}`;
       
        fetch(subtitleUrl, {
            method: 'HEAD',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = 'English';
                track.srclang = 'en';
                track.src = subtitleUrl;
                track.default = true;
               
                videoElement.appendChild(track);
                console.log('Subtitles loaded successfully');
            } else {
                console.log('No subtitle file found for this video');
            }
        })
        .catch(error => {
            console.error('Error checking for subtitles:', error);
        });
    }

    play(mediaFile) {
        const token = localStorage.getItem('token');
        const playerContainer = document.querySelector('.modal-content');
       
        const oldContainers = document.querySelectorAll('.video-container, .image-container, .audio-container');
        oldContainers.forEach(container => container.remove());
       
        if (mediaFile.type === 'video') {
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            playerContainer.appendChild(videoContainer);
           
            const video = document.createElement('video');
            video.id = 'video-player';
            video.controls = true;
            video.crossOrigin = 'anonymous';
           
            videoContainer.appendChild(video);
            this.player = video;
           
            video.src = `/stream/${encodeURIComponent(mediaFile.name)}?token=${token}`;
            this.loadSubtitles(mediaFile);
            video.play().catch(err => console.error('Direct play error:', err));
           
        } else if (mediaFile.type === 'image') {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            playerContainer.appendChild(imageContainer);
           
            const img = document.createElement('img');
            img.id = 'image-viewer';
            img.src = `/images/${encodeURIComponent(mediaFile.name)}?token=${token}`;
            img.alt = mediaFile.name;
           
            imageContainer.appendChild(img);
           
        } else if (mediaFile.type === 'audio') {
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-container';
            playerContainer.appendChild(audioContainer);
           
            const audio = document.createElement('audio');
            audio.id = 'audio-player';
            audio.controls = true;
           
            audioContainer.appendChild(audio);
            this.player = audio;
           
            const albumArt = document.createElement('div');
            albumArt.className = 'album-art';
            albumArt.innerHTML = `<span class="music-icon">🎵</span>`;
            audioContainer.appendChild(albumArt);
           
            audio.src = `/stream/${encodeURIComponent(mediaFile.name)}?token=${token}`;
            audio.play().catch(err => console.error('Direct play error:', err));
        }
       
        this.modal.classList.remove('hidden');
    }

    close() {
        if (this.player) {
            if (this.player.pause) {
                this.player.pause();
            }
           
            if (this.hls) {
                this.hls.destroy();
                this.hls = null;
            }
        }
        this.modal.classList.add('hidden');
    }

    async loadMedia() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/media', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
           
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return;
            }
           
            if(!response.ok) throw new Error('Failed to fetch media');

            this.categories = await response.json();
            this.renderCategorizedMedia();

        } catch (error) {
            console.error('Error loading media:', error);
        }
    }

    renderCategorizedMedia() {
        this.mediaContainer.innerHTML = '';
        this.currentView = 'categories';
       
        Object.entries(this.categories).forEach(([categoryKey, category]) => {
            if (category.files.length === 0) return;
           
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section';
            categorySection.setAttribute('data-category', categoryKey);
           
            const categoryHeader = document.createElement('h2');
            categoryHeader.classList.add('category-title', 'clickable-category');
            categoryHeader.addEventListener('click', () => {
                this.filterByCategory(categoryKey);
            });
            categoryHeader.textContent = category.name;
            categorySection.appendChild(categoryHeader);
           
            const mediaRow = document.createElement('div');
            mediaRow.className = 'media-row';
           
            if (categoryKey === 'tv_shows') {
                // Group TV shows by series name
                const tvShows = this.groupTvShowsBySeries(category.files);
                Object.values(tvShows).forEach(series => {
                    const seriesItem = this.createTvSeriesItem(series);
                    mediaRow.appendChild(seriesItem);
                });
            } else {
                // Regular media items for other categories
                category.files.forEach(file => {
                    const mediaItem = this.createMediaItem(file);
                    mediaRow.appendChild(mediaItem);
                });
            }
           
            categorySection.appendChild(mediaRow);
            this.mediaContainer.appendChild(categorySection);
        });
    }

    groupTvShowsBySeries(tvFiles) {
        const series = {};
        
        tvFiles.forEach(file => {
            // Extract series name from filename or folder structure
            // Assuming format like "Series Name S01E01 - Episode Title.mkv"
            const fileName = file.name;
            let seriesName;
            
            // Try to extract series name from common patterns
            const patterns = [
                /^(.+?)\s+S\d+E\d+/i,  // "Series Name S01E01"
                /^(.+?)\s+Season\s+\d+/i,  // "Series Name Season 1"
                /^(.+?)\s+\d+x\d+/i,      // "Series Name 1x01"
                /^(.+?)\s+-\s+\d+/i,      // "Series Name - 01"
            ];
            
            for (const pattern of patterns) {
                const match = fileName.match(pattern);
                if (match) {
                    seriesName = match[1].trim();
                    break;
                }
            }
            
            // Fallback: use first part before common separators
            if (!seriesName) {
                seriesName = fileName.split(/[\s\-\.]+/)[0];
            }
            
            if (!series[seriesName]) {
                series[seriesName] = {
                    name: seriesName,
                    episodes: [],
                    thumbnail: file.thumbnail || null
                };
            }
            
            series[seriesName].episodes.push(file);
        });
        
        // Sort episodes within each series
        Object.values(series).forEach(s => {
            s.episodes.sort((a, b) => a.name.localeCompare(b.name));
        });
        
        return series;
    }

    createTvSeriesItem(series) {
        const seriesItem = document.createElement('div');
        seriesItem.className = 'media-item tv-series';
        seriesItem.setAttribute('data-series-name', series.name.toLowerCase());

        let thumbnailHTML = `
            <div class="media-thumbnail">
                <span class="media-type">TV</span>
                <div class="episode-count">${series.episodes.length} episodes</div>
            </div>
        `;

        if (series.thumbnail) {
            thumbnailHTML = `
                <div class="media-thumbnail" style="background-image: url('${series.thumbnail}'); background-size: cover; background-position: center;">
                    <span class="media-type">TV</span>
                    <div class="episode-count">${series.episodes.length} episodes</div>
                </div>
            `;
        } else if (series.episodes[0] && series.episodes[0].thumbnail) {
            thumbnailHTML = `
                <div class="media-thumbnail" style="background-image: url('${series.episodes[0].thumbnail}'); background-size: cover; background-position: center;">
                    <span class="media-type">TV</span>
                    <div class="episode-count">${series.episodes.length} episodes</div>
                </div>
            `;
        }

        seriesItem.innerHTML = `
            ${thumbnailHTML}
            <div class="media-info">
                <h3>${series.name}</h3>
                <p>${series.episodes.length} episodes</p>
            </div>
        `;

        seriesItem.addEventListener('click', () => {
            this.showTvSeriesEpisodes(series);
        });

        return seriesItem;
    }

    showTvSeriesEpisodes(series) {
        this.currentView = 'tv-show-episodes';
        this.currentTvShow = series;
        this.mediaContainer.innerHTML = '';
        
        // Create back button and header
        const headerSection = document.createElement('div');
        headerSection.className = 'tv-series-header';
        
        const backButton = document.createElement('button');
        backButton.className = 'back-to-categories-btn';
        backButton.innerHTML = '← Back to Library';
        backButton.addEventListener('click', () => {
            this.renderCategorizedMedia();
        });
        
        const seriesTitle = document.createElement('h1');
        seriesTitle.className = 'series-title';
        seriesTitle.textContent = series.name;
        
        headerSection.appendChild(backButton);
        headerSection.appendChild(seriesTitle);
        this.mediaContainer.appendChild(headerSection);
        
        // Create episodes grid
        const episodesGrid = document.createElement('div');
        episodesGrid.className = 'episodes-grid';
        
        series.episodes.forEach((episode, index) => {
            const episodeItem = this.createEpisodeItem(episode, index + 1);
            episodesGrid.appendChild(episodeItem);
        });
        
        this.mediaContainer.appendChild(episodesGrid);
    }

    createEpisodeItem(episode, episodeNumber) {
        const episodeItem = document.createElement('div');
        episodeItem.className = 'episode-item';
        episodeItem.setAttribute('data-filename', episode.name.toLowerCase());

        let thumbnailHTML = `
            <div class="episode-thumbnail">
                <div class="play-button">▶</div>
                <span class="episode-number">${episodeNumber}</span>
            </div>
        `;

        if (episode.thumbnail) {
            thumbnailHTML = `
                <div class="episode-thumbnail" style="background-image: url('${episode.thumbnail}'); background-size: cover; background-position: center;">
                    <div class="play-button">▶</div>
                    <span class="episode-number">${episodeNumber}</span>
                </div>
            `;
        }

        // Extract episode title from filename
        let episodeTitle = episode.name;
        const titleMatch = episode.name.match(/S\d+E\d+\s*-?\s*(.+)\./i);
        if (titleMatch) {
            episodeTitle = titleMatch[1].trim();
        }

        episodeItem.innerHTML = `
            ${thumbnailHTML}
            <div class="episode-info">
                <h3>${episodeTitle}</h3>
                <p>Episode ${episodeNumber} • ${this.formatFileSize(episode.size)}</p>
            </div>
        `;

        episodeItem.addEventListener('click', () => {
            this.play(episode);
        });

        return episodeItem;
    }

    renderCategoryAsGrid(categoryKey) {
        this.mediaContainer.innerHTML = '';

        const category = this.categories[categoryKey];
        if (!category) return;

        const categoryHeader = document.createElement('h2');
        categoryHeader.className = 'category-title';
        categoryHeader.textContent = category.name;
        this.mediaContainer.appendChild(categoryHeader);

        const grid = document.createElement('div');
        grid.className = 'media-grid';

        if (categoryKey === 'tv_shows') {
            const tvShows = this.groupTvShowsBySeries(category.files);
            Object.values(tvShows).forEach(series => {
                const seriesItem = this.createTvSeriesItem(series);
                grid.appendChild(seriesItem);
            });
        } else {
            category.files.forEach(file => {
                const mediaItem = this.createMediaItem(file);
                grid.appendChild(mediaItem);
            });
        }

        this.mediaContainer.appendChild(grid);
        this.showAllButton(categoryKey);
    }

    filterByCategory(categoryKey) {
        this.renderCategoryAsGrid(categoryKey);
    }

    showAllButton(currentCategoryKey) {
        let btn = document.getElementById('show-all-btn');
        if (btn) btn.remove();

        btn = document.createElement('button');
        btn.id = 'show-all-btn';
        btn.textContent = 'Show All Categories';
        btn.className = 'info-button';
        btn.style.margin = '20px';

        btn.onclick = () => {
            this.renderCategorizedMedia();
        };

        this.mediaContainer.prepend(btn);
    }

    createMediaItem(file) {
        const mediaItem = document.createElement('div');
        mediaItem.className = `media-item ${file.type}`;
        mediaItem.setAttribute('data-filename', file.name.toLowerCase());

        let thumbnailHTML = `
            <div class="media-thumbnail">
                <span class="media-type">${file.type}</span>
            </div>
        `;

        if(file.type === 'image'){
            const token = localStorage.getItem('token');
            thumbnailHTML = `
                <div class="media-thumbnail" style="background-image: url('/images/${encodeURIComponent(file.name)}?token=${token}'); background-size: cover; background-position: center;">
                    <span class="media-type">${file.type}</span>
                </div>
            `;
        } else if(file.type === 'video' && file.thumbnail){
            thumbnailHTML = `
                <div class="media-thumbnail" style="background-image: url('${file.thumbnail}'); background-size: cover; background-position: center;">
                    <span class="media-type">${file.type}</span>
                </div>
            `;
        } else if(file.type === 'audio') {
            thumbnailHTML = `
                <div class="media-thumbnail" style="background-color: #344; display: flex; align-items: center; justify-content: center;">
                    <span class="media-type">${file.type}</span>
                </div>
            `;
        }

        mediaItem.innerHTML = `
            ${thumbnailHTML}
            <div class="media-info">
                <h3>${file.name}</h3>
                <p>${this.formatFileSize(file.size)}</p>
            </div>
        `;

        mediaItem.addEventListener('click', () => {
            if (file.type === 'video' || file.type === 'audio' || file.type === 'image'){
                this.play(file);
            }
        });

        return mediaItem;
    }

    filterMedia(searchTerm) {
        searchTerm = searchTerm.toLowerCase();

        if (this.currentView === 'tv-show-episodes') {
            // Filter episodes in current TV show view
            const episodes = this.mediaContainer.querySelectorAll('.episode-item');
            episodes.forEach(episode => {
                const filename = episode.getAttribute('data-filename');
                if(filename.includes(searchTerm)) {
                    episode.style.display = 'block';
                } else {
                    episode.style.display = 'none';
                }
            });
        } else {
            // Filter categories view
            const categories = this.mediaContainer.querySelectorAll('.category-section');
            categories.forEach(categorySection => {
                const items = categorySection.querySelectorAll('.media-item');
                let visibleItems = 0;

                items.forEach(item => {
                    const filename = item.getAttribute('data-filename') || 
                                   item.getAttribute('data-series-name') || '';
                    if(filename.includes(searchTerm)) {
                        item.style.display = 'block';
                        visibleItems++;
                    } else {
                        item.style.display = 'none';
                    }
                });

                if (visibleItems === 0) {
                    categorySection.style.display = 'none';
                } else {
                    categorySection.style.display = 'block';
                }
            });
        }
    }

    addKeyboardShortcutsInfo() {
        const shortcutsInfo = document.createElement('div');
        shortcutsInfo.className = 'keyboard-shortcuts-info';
        shortcutsInfo.innerHTML = `
            <h4>Keyboard Shortcuts</h4>
            <ul>
                <li><kbd>Space</kbd> - Play/Pause</li>
                <li><kbd>M</kbd> - Mute/Unmute</li>
                <li><kbd>F</kbd> - Fullscreen</li>
                <li><kbd>ESC</kbd> - Exit player</li>
                <li><kbd>←</kbd> - Rewind 10s</li>
                <li><kbd>→</kbd> - Forward 10s</li>
                <li><kbd>↑</kbd> - Volume up</li>
                <li><kbd>↓</kbd> - Volume down</li>
            </ul>
        `;
       
        const infoButton = document.createElement('button');
        infoButton.className = 'info-button';
        infoButton.textContent = 'ⓘ Keyboard Shortcuts';
        infoButton.onclick = () => shortcutsInfo.classList.toggle('visible');
       
        document.querySelector('.player-header').appendChild(infoButton);
        document.querySelector('.modal-content').appendChild(shortcutsInfo);
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
        else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + 'MB';
        else return (bytes / 1073741824).toFixed(1) + 'GB';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MediaPlayer();
});