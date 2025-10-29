// static/campaign-safezone-test.js
// Safe Zone Testing Module for Campaign Creatives

// Variables
let safeZoneUploadedImage = null;
let safeZoneUploadedVideoUrl = null;
let safeZoneMaskColor = '#FF0000';
let safeZoneMaskOpacity = 0.4;
let videoAnimationFrameId = null;

// Initialize Safe Zone Test
window.SafeZoneTest = {
    
    // Initialize when tab is opened
    init: function(creative, safeZones) {
        const canvas = document.getElementById('safezone-test-canvas');
        const video = document.getElementById('safezone-test-video');
        const formatInfo = document.getElementById('safezone-format-info');
        
        // Stop any existing video animation
        if (videoAnimationFrameId) {
            cancelAnimationFrame(videoAnimationFrameId);
            videoAnimationFrameId = null;
        }
        
        // Get format data
        let formatData = null;
        if (!creative.is_custom) {
            formatData = safeZones[creative.platform]?.[creative.format];
        }
        
        // Set canvas and video size
        if (creative.is_custom) {
            canvas.width = creative.custom_width;
            canvas.height = creative.custom_height;
            formatInfo.textContent = `${creative.format} (${creative.custom_width}×${creative.custom_height}px)`;
        } else if (formatData) {
            canvas.width = formatData.width;
            canvas.height = formatData.height;
            formatInfo.textContent = `${creative.platform} - ${creative.format} (${formatData.width}×${formatData.height}px)`;
        }
        
        // Clear previous uploads
        safeZoneUploadedImage = null;
        if (safeZoneUploadedVideoUrl) {
            URL.revokeObjectURL(safeZoneUploadedVideoUrl);
            safeZoneUploadedVideoUrl = null;
        }
        
        // ✅ FIXED: Only hide video, don't touch src
        if (video) {
            video.style.display = 'none';
            // DON'T set src here - leave it empty until user uploads
        }
        
        // Render initial state
        this.renderCanvas(creative, safeZones);
        
        // Setup event listeners
        this.setupEventListeners(creative, safeZones);
    },
    
    // Render canvas
    renderCanvas: function(creative, safeZones) {
        const canvas = document.getElementById('safezone-test-canvas');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw uploaded image or placeholder
        if (safeZoneUploadedImage) {
            ctx.drawImage(safeZoneUploadedImage, 0, 0, canvas.width, canvas.height);
        } else if (!safeZoneUploadedVideoUrl) {
            // Placeholder (only show if no video)
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#bbb';
            ctx.textAlign = 'center';
            ctx.font = '50px Arial';
            ctx.fillText('Upload your creative to test', canvas.width / 2, canvas.height / 2);
        }
        
        // Draw safe zone mask on top
        this.drawMask(creative, safeZones, ctx);
    },
    
    // Draw safe zone mask
    drawMask: function(creative, safeZones, ctx) {
        let formatData = null;
        if (!creative.is_custom) {
            formatData = safeZones[creative.platform]?.[creative.format];
        }
        
        // ✅ Add debugging
        console.log('Drawing mask for:', creative.platform, creative.format);
        console.log('Format data:', formatData);
        
        if (!formatData || (!formatData.safeZone && !formatData.dangerZones)) {
            console.warn('No safe zone data available');
            return;
        }
        
        const canvas = document.getElementById('safezone-test-canvas');
        const path = new Path2D();
        
        if (formatData.dangerZones) {
            formatData.dangerZones.forEach(zone => {
                path.rect(zone.x, zone.y, zone.width, zone.height);
            });
        } else if (formatData.safeZone) {
            const { top, right, bottom, left } = formatData.safeZone;
            const width = canvas.width;
            const height = canvas.height;
            
            path.rect(0, 0, width, top);
            path.rect(width - right, top, right, height - top - bottom);
            path.rect(0, height - bottom, width, bottom);
            path.rect(0, top, left, height - top - bottom);
        }
        
        ctx.fillStyle = this.hexToRgba(safeZoneMaskColor, safeZoneMaskOpacity);
        ctx.fill(path);
    },
    
    // Animate video with mask overlay
    animateVideo: function(creative, safeZones) {
        const canvas = document.getElementById('safezone-test-canvas');
        const ctx = canvas.getContext('2d');
        
        const drawFrame = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.drawMask(creative, safeZones, ctx);
            videoAnimationFrameId = requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
    },
    
    // Setup event listeners
    setupEventListeners: function(creative, safeZones) {
        // Image upload
        const imageInput = document.getElementById('safezone-image-upload');
        const videoInput = document.getElementById('safezone-video-upload');
        const clearBtn = document.getElementById('safezone-clear-btn');
        const colorInput = document.getElementById('safezone-mask-color');
        const opacityInput = document.getElementById('safezone-mask-opacity');
        const opacityValue = document.getElementById('safezone-opacity-value');
        
        // Remove old listeners by cloning elements
        const newImageInput = imageInput.cloneNode(true);
        const newVideoInput = videoInput.cloneNode(true);
        const newClearBtn = clearBtn.cloneNode(true);
        const newColorInput = colorInput.cloneNode(true);
        const newOpacityInput = opacityInput.cloneNode(true);
        
        imageInput.replaceWith(newImageInput);
        videoInput.replaceWith(newVideoInput);
        clearBtn.replaceWith(newClearBtn);
        colorInput.replaceWith(newColorInput);
        opacityInput.replaceWith(newOpacityInput);
        
        // Image upload handler
        document.getElementById('safezone-image-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
                alert('Please upload a valid image file (JPG, PNG, or WebP)');
                e.target.value = '';
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                alert('Image file is too large. Maximum size is 10MB.');
                e.target.value = '';
                return;
            }
            
            // Stop video animation
            if (videoAnimationFrameId) {
                cancelAnimationFrame(videoAnimationFrameId);
                videoAnimationFrameId = null;
            }
            
            // Clear video
            if (safeZoneUploadedVideoUrl) {
                URL.revokeObjectURL(safeZoneUploadedVideoUrl);
            }
            safeZoneUploadedVideoUrl = null;
            
            const video = document.getElementById('safezone-test-video');
            video.removeAttribute('src'); // ✅ Fixed: use removeAttribute instead of video.src = ''
            video.style.display = 'none';
            
            // Load image
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    safeZoneUploadedImage = img;
                    this.renderCanvas(creative, safeZones);
                };
                img.onerror = () => {
                    alert('Failed to load image. File may be corrupted.');
                    e.target.value = '';
                };
                img.src = event.target.result;
            };
            reader.onerror = () => {
                alert('Failed to read file.');
                e.target.value = '';
            };
            reader.readAsDataURL(file);
        });
        
        // Video upload handler
        document.getElementById('safezone-video-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!['video/mp4', 'video/webm'].includes(file.type)) {
                alert('Please upload a valid video file (MP4 or WebM)');
                e.target.value = '';
                return;
            }
            
            if (file.size > 100 * 1024 * 1024) {
                alert('Video file is too large. Maximum size is 100MB.');
                e.target.value = '';
                return;
            }
            
            safeZoneUploadedImage = null;
            if (safeZoneUploadedVideoUrl) {
                URL.revokeObjectURL(safeZoneUploadedVideoUrl);
            }
            
            safeZoneUploadedVideoUrl = URL.createObjectURL(file);
            const video = document.getElementById('safezone-test-video');
            const canvas = document.getElementById('safezone-test-canvas');
            
            // ✅ Get canvas's actual rendered dimensions
            const canvasRect = canvas.getBoundingClientRect();
            
            // ✅ Set video to match canvas exactly
            video.style.width = `${canvasRect.width}px`;
            video.style.height = `${canvasRect.height}px`;
            video.style.objectFit = 'fill'; // Stretch to fill like images do
            video.style.position = 'absolute';
            video.style.top = '50%';
            video.style.left = '50%';
            video.style.transform = 'translate(-50%, -50%)';
            video.style.display = 'block';
            
            canvas.style.position = 'relative';
            canvas.style.zIndex = '1';
            
            video.onloadedmetadata = () => {
                // ✅ Reconfirm dimensions after video loads
                const canvasRect = canvas.getBoundingClientRect();
                video.style.width = `${canvasRect.width}px`;
                video.style.height = `${canvasRect.height}px`;
            };
            
            video.onerror = () => {
                alert('Failed to load video. File may be corrupted or unsupported.');
                URL.revokeObjectURL(safeZoneUploadedVideoUrl);
                safeZoneUploadedVideoUrl = null;
                video.removeAttribute('src');
                video.style.display = 'none';
                e.target.value = '';
            };
            
            video.src = safeZoneUploadedVideoUrl;
            video.play();
            this.animateVideo(creative, safeZones);
        });
        
        // Color input
        document.getElementById('safezone-mask-color').addEventListener('input', (e) => {
            safeZoneMaskColor = e.target.value;
            this.renderCanvas(creative, safeZones);
        });
        
        // Opacity input
        document.getElementById('safezone-mask-opacity').addEventListener('input', (e) => {
            safeZoneMaskOpacity = parseFloat(e.target.value);
            if (opacityValue) {
                opacityValue.textContent = Math.round(safeZoneMaskOpacity * 100) + '%';
            }
            this.renderCanvas(creative, safeZones);
        });
        
        // Clear button
        document.getElementById('safezone-clear-btn').addEventListener('click', () => {
            this.clear();
            this.renderCanvas(creative, safeZones);
        });
    },
    
    // Clear uploads
    clear: function() {
        if (videoAnimationFrameId) {
            cancelAnimationFrame(videoAnimationFrameId);
            videoAnimationFrameId = null;
        }
        
        safeZoneUploadedImage = null;
        if (safeZoneUploadedVideoUrl) {
            URL.revokeObjectURL(safeZoneUploadedVideoUrl);
            safeZoneUploadedVideoUrl = null;
        }
        
        const video = document.getElementById('safezone-test-video');
        if (video && video.src) {  // ✅ Only clear if video has a src
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        video.style.display = 'none';
        
        const imageInput = document.getElementById('safezone-image-upload');
        const videoInput = document.getElementById('safezone-video-upload');
        if (imageInput) imageInput.value = '';
        if (videoInput) videoInput.value = '';
    },
    
    // Cleanup on modal close
    cleanup: function() {
        if (videoAnimationFrameId) {
            cancelAnimationFrame(videoAnimationFrameId);
            videoAnimationFrameId = null;
        }
        this.clear();
    },
    
    // Helper: Hex to RGBA
    hexToRgba: function(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
};
