class MediaPlayer {
    constructor() {
        this.player = document.getElementById('video-player');
        this.modal = document.getElementById('player-modal');
        this.mediaContainer = document.querySelector('#content');
        this.categories = {};
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
            // If we're not in fullscreen mode, enter fullscreen
            if (this.player.requestFullscreen) {
                this.player.requestFullscreen();
            } else if (this.player.webkitRequestFullscreen) {
                this.player.webkitRequestFullscreen();
            } else if (this.player.msRequestFullscreen) {
                this.player.msRequestFullscreen();
            }
        } else {
            // If we are in fullscreen mode, exit fullscreen
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
        // Ensure volume stays between 0 and 1
        let newVolume = Math.max(0, Math.min(1, this.player.volume + delta));
        this.player.volume = newVolume;
    }

    loadSubtitles(mediaFile) {
        const token = localStorage.getItem('token');
        const videoElement = this.player;
       
        // Remove any existing subtitle tracks
        while (videoElement.firstChild) {
            videoElement.removeChild(videoElement.firstChild);
        }
       
        // Base filename without extension
        const baseFilename = mediaFile.name.substring(0, mediaFile.name.lastIndexOf('.'));
        const subtitleUrl = `/subtitles/${encodeURIComponent(baseFilename)}?token=${token}`;
       
        // Check if subtitle file exists using HEAD request
        fetch(subtitleUrl, {
            method: 'HEAD',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Subtitle file exists, add it to the video
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = 'English';  // Default label
                track.srclang = 'en';     // Default language
                track.src = subtitleUrl;
                track.default = true;     // Make this track default
               
                // Add the track to the video element
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
       
        // Remove all existing media elements
        const oldContainers = document.querySelectorAll('.video-container, .image-container, .audio-container');
        oldContainers.forEach(container => container.remove());
       
        // Create appropriate container based on media type
        if (mediaFile.type === 'video') {
            // Create container for our video player
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            playerContainer.appendChild(videoContainer);
           
            // Create video element
            const video = document.createElement('video');
            video.id = 'video-player';
            video.controls = true;
            video.crossOrigin = 'anonymous';
           
            // Add the video to the container
            videoContainer.appendChild(video);
            this.player = video;
           
            // Set source and play
            video.src = `/stream/${encodeURIComponent(mediaFile.name)}?token=${token}`;
            this.loadSubtitles(mediaFile);
            video.play().catch(err => console.error('Direct play error:', err));
           
        } else if (mediaFile.type === 'image') {
            // Create container for our image viewer
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            playerContainer.appendChild(imageContainer);
           
            // Create image element
            const img = document.createElement('img');
            img.id = 'image-viewer';
            img.src = `/images/${encodeURIComponent(mediaFile.name)}?token=${token}`;
            img.alt = mediaFile.name;
           
            // Add the image to the container
            imageContainer.appendChild(img);
           
        } else if (mediaFile.type === 'audio') {
            // Create container for our audio player
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-container';
            playerContainer.appendChild(audioContainer);
           
            // Create audio element
            const audio = document.createElement('audio');
            audio.id = 'audio-player';
            audio.controls = true;
           
            // Add the audio to the container
            audioContainer.appendChild(audio);
            this.player = audio;
           
            // Create album art placeholder
            const albumArt = document.createElement('div');
            albumArt.className = 'album-art';
            albumArt.innerHTML = `<span class="music-icon">🎵</span>`;
            audioContainer.appendChild(albumArt);
           
            // Set source and play
            audio.src = `/stream/${encodeURIComponent(mediaFile.name)}?token=${token}`;
            audio.play().catch(err => console.error('Direct play error:', err));
        }
       
        // Show the modal
        this.modal.classList.remove('hidden');
    }

    // Update close method to handle all media types
    close() {
        if (this.player) {
            if (this.player.pause) {
                this.player.pause();
            }
           
            // Clean up HLS instance if it exists
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
                // Token invalid or expired
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
       
        // Create sections for each category
        Object.entries(this.categories).forEach(([categoryKey, category]) => {
            if (category.files.length === 0) return; // Skip empty categories
           
            // Create category section
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section';
            categorySection.setAttribute('data-category', categoryKey);
           
            // Create category header
            const categoryHeader = document.createElement('h2');
            categoryHeader.classList.add('category-title', 'clickable-category');
            categoryHeader.addEventListener('click', () => {
                this.filterByCategory(categoryKey);
            });
            categoryHeader.textContent = category.name;
            categorySection.appendChild(categoryHeader);
           
            // Create horizontal scrolling container
            const mediaRow = document.createElement('div');
            mediaRow.className = 'media-row';
           
            // Add media items to the row
            category.files.forEach(file => {
                const mediaItem = this.createMediaItem(file);
                mediaRow.appendChild(mediaItem);
            });
           
            categorySection.appendChild(mediaRow);
            this.mediaContainer.appendChild(categorySection);
        });
    }

    renderCategoryAsGrid(categoryKey) {
        // Clear the container
        this.mediaContainer.innerHTML = '';

        const category = this.categories[categoryKey];
        if (!category) return;

        // Category header
        const categoryHeader = document.createElement('h2');
        categoryHeader.className = 'category-title';
        categoryHeader.textContent = category.name;
        this.mediaContainer.appendChild(categoryHeader);

        // Vertical grid container
        const grid = document.createElement('div');
        grid.className = 'media-grid';

        category.files.forEach(file => {
            const mediaItem = this.createMediaItem(file);
            grid.appendChild(mediaItem);
        });

        this.mediaContainer.appendChild(grid);

        // Show All button
        this.showAllButton(categoryKey);
    }

    filterByCategory(categoryKey) {
        this.renderCategoryAsGrid(categoryKey);
    }

    showAllButton(currentCategoryKey) {
        // Remove existing button if present
        let btn = document.getElementById('show-all-btn');
        if (btn) btn.remove();

        btn = document.createElement('button');
        btn.id = 'show-all-btn';
        btn.textContent = 'Show All Categories';
        btn.className = 'info-button';
        btn.style.margin = '20px';

        btn.onclick = () => {
            // Show all categories
            const categories = this.mediaContainer.querySelectorAll('.category-section');
            this.renderCategorizedMedia();
        };

        // Insert at the top of the content area
        this.mediaContainer.prepend(btn);
    }

    createMediaItem(file) {
        const mediaItem = document.createElement('div');
        mediaItem.className = `media-item ${file.type}`;
        mediaItem.setAttribute('data-filename', file.name.toLowerCase());

        // Creating thumbnails
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
        const categories = this.mediaContainer.querySelectorAll('.category-section');
        searchTerm = searchTerm.toLowerCase();

        categories.forEach(categorySection => {
            const items = categorySection.querySelectorAll('.media-item');
            let visibleItems = 0;

            items.forEach(item => {
                const filename = item.getAttribute('data-filename');
                if(filename.includes(searchTerm)) {
                    item.style.display = 'block';
                    visibleItems++;
                } else {
                    item.style.display = 'none';
                }
            });

            // Hide category section if no items are visible
            if (visibleItems === 0) {
                categorySection.style.display = 'none';
            } else {
                categorySection.style.display = 'block';
            }
        });
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