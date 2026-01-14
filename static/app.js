// ==========================================
// GLOBAL SCOPE - Outside DOMContentLoaded
// ==========================================

// ==========================================
// START DOMContentLoaded
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

    const supabaseClient = window.app.supabaseClient;
    let safeZones = {};

    // --- DOM Elements ---
    const platformNav = document.querySelector('.platform-nav');
    const formatSelect = document.getElementById('format-select');
    const canvas = document.getElementById('safezone-canvas');
    const ctx = canvas.getContext('2d');
    const downloadBtn = document.getElementById('download-btn');
    const clearBtn = document.getElementById('clear-btn');
    const descriptionText = document.getElementById('format-description');
    const dimensionsText = document.getElementById('format-dimensions');
    const linkElement = document.getElementById('format-link');
    const videoPreview = document.getElementById('video-preview');
    const imageUploadInput = document.getElementById('image-upload-input');
    const videoUploadInput = document.getElementById('video-upload-input');
    const videoUploadLabel = document.querySelector('label[for="video-upload-input"]');
    const imageUploadLabel = document.querySelector('label[for="image-upload-input"]');
    const maskColorInput = document.getElementById('mask-color-input');
    const maskOpacityInput = document.getElementById('mask-opacity-input');

    // --- State Variables ---
    let currentPlatform = "Instagram";
    let currentFormat = "Story (9:16)";
    let uploadedImage = null;
    let uploadedVideoUrl = null;
    let maskColor = '#FF0000';
    let maskOpacity = 0.4;

    // --- File Validation Configuration ---
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

    // --- Auth & Pro Status Logic ---
    async function verifyProStatus() {
        try {
            const session = await supabaseClient.auth.getSession();
            if (!session.data.session) {
                return { isPro: false, verified: false };
            }
    
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('subscription_status')
                .eq('id', session.data.session.user.id)
                .single();
    
            if (error) {
                console.error('Error verifying subscription status:', error);
                return { isPro: false, verified: false };
            }
    
            // ✅ UPDATED: Include 'TRIAL' as a Pro status
            const status = data?.subscription_status || 'FREE';
            const isPro = ['PRO', 'STUDIO', 'TRIAL'].includes(status);
    
            return { isPro, verified: true };
        } catch (error) {
            console.error('Error in verifyProStatus:', error);
            return { isPro: false, verified: false };
        }
    }

    // --- Helper Function ---
    function hexToRgba(hex, opacity) {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    function validateFile(file, allowedTypes, maxSize) {
        if (!file) return { valid: false, error: 'No file selected' };
        if (!allowedTypes.includes(file.type)) return { valid: false, error: 'Invalid file type.' };
        if (file.size > maxSize) return { valid: false, error: 'File too large.' };
        return { valid: true };
    }

    // Prevent right-click/save on canvas
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        alert('⚠️ To save the mask, please upgrade to Pro and use the Download button.');
        return false;
    });
    
    canvas.addEventListener('dragstart', (e) => {
        e.preventDefault();
        return false;
    });

    // --- Main Functions ---
    function populatePlatforms() {
        platformNav.innerHTML = '';
        Object.keys(safeZones).forEach(platform => {
            const button = document.createElement('button');
            button.textContent = platform;
            if (platform === currentPlatform) { button.classList.add('active'); }
            button.addEventListener('click', () => {
                currentPlatform = platform;
                currentFormat = Object.keys(safeZones[currentPlatform])[0];
                populatePlatforms();
                populateFormats();
                updateCanvas();
            });
            platformNav.appendChild(button);
        });
    }

    function populateFormats() {
        formatSelect.innerHTML = '';
        const formats = safeZones[currentPlatform];
        Object.keys(formats).forEach(format => {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format;
            if (format === currentFormat) { option.selected = true; }
            formatSelect.appendChild(option);
        });
    }

    function updateCanvas() {
        const formatData = safeZones[currentPlatform]?.[currentFormat];
        if (!formatData) return;
        
        canvas.width = formatData.width;
        canvas.height = formatData.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!uploadedImage && !uploadedVideoUrl) {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#bbb';
            ctx.textAlign = 'center';
            ctx.font = '50px Arial';
            ctx.fillText('Pro Feature: Upload Creative', canvas.width / 2, canvas.height / 2);
        } else if (uploadedImage) {
            ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
        } else if (uploadedVideoUrl) {
            const canvasRect = canvas.getBoundingClientRect();
            videoPreview.style.width = `${canvasRect.width}px`;
            videoPreview.style.height = `${canvasRect.height}px`;
            videoPreview.style.objectFit = 'fill';
        }
        
        descriptionText.textContent = formatData.description || "";
        dimensionsText.textContent = `Dimensions: ${formatData.width}px x ${formatData.height}px`;
        
        if (formatData.link) {
            linkElement.href = formatData.link;
            linkElement.style.display = 'inline-block';
        } else {
            linkElement.style.display = 'none';
        }
        
        drawSafeZoneMask();
    }

    function getMaskPath(formatData) {
        const path = new Path2D();
        
        if (formatData.dangerZones) {
            formatData.dangerZones.forEach(zone => {
                path.rect(zone.x, zone.y, zone.width, zone.height);
            });
        } else if (formatData.safeZone) {
            const { top, right, bottom, left } = formatData.safeZone;
            const width = formatData.width;
            const height = formatData.height;
            path.rect(0, 0, width, top);
            path.rect(width - right, top, right, height - top - bottom);
            path.rect(0, height - bottom, width, bottom);
            path.rect(0, top, left, height - top - bottom);
        }
        
        return path;
    }

    function drawSafeZoneMask() {
        const formatData = safeZones[currentPlatform][currentFormat];
        const maskPath = getMaskPath(formatData);
        ctx.fillStyle = hexToRgba(maskColor, maskOpacity);
        ctx.fill(maskPath);
    }

    // --- Gating UI Features ---
    const updateFeatureAccess = async () => {
        const { isPro } = await verifyProStatus();
        
        // Visual indicator that these are locked/unlocked
        if (isPro) {
            videoUploadInput.disabled = false;
            imageUploadInput.disabled = false;
            videoUploadLabel.classList.remove('disabled');
            imageUploadLabel.classList.remove('disabled');
            
            // Remove badges if Pro
            const badges = document.querySelectorAll('.pro-badge');
            badges.forEach(b => b.style.display = 'none');
            
            // Hide counters (since they are irrelevant)
            document.getElementById('download-counter-text').style.display = 'none';
            document.getElementById('upload-counter-text').style.display = 'none';
        } else {
            // Add visual lock style
            videoUploadLabel.classList.add('disabled');
            imageUploadLabel.classList.add('disabled');
            
            // Show "View Only" message
            document.getElementById('download-counter-text').innerHTML = '🔒 Upgrade to Download';
            document.getElementById('upload-counter-text').innerHTML = '🔒 Upgrade to Upload';
        }
    };

    const initializeTool = async () => {
        try {
            const { data, error } = await supabaseClient
                .from('platform_formats')
                .select('*')
                .eq('active', true)
                .order('sort_order');
    
            if (error) throw error;
    
            safeZones = {};
            data.forEach(format => {
                if (!safeZones[format.platform]) {
                    safeZones[format.platform] = {};
                }
                safeZones[format.platform][format.format_name] = {
                    width: format.width,
                    height: format.height,
                    description: format.description,
                    safeZone: format.safe_zone,
                    dangerZones: format.danger_zones,
                    link: format.reference_link
                };
            });
            
        } catch (error) {
            console.error('Could not load safe zones data', error);
            return;
        }
        
        populatePlatforms();
        populateFormats();
        updateCanvas();
        await updateFeatureAccess();
        
        document.addEventListener('profileLoaded', async () => {
            await updateFeatureAccess();
        });
    };

    document.addEventListener('profileLoaded', updateFeatureAccess);

    // --- Event Listeners ---

    // 1. Download Button (PRO Only)
    downloadBtn.addEventListener('click', async () => {
        const { isPro } = await verifyProStatus();

        if (!isPro) {
            // UPDATED TEXT
            alert('🚫 Downloads are a Pro feature.\n\nUpgrade to Pro ($8/mo) to download unlimited masks and speed up your workflow!');
            window.location.href = 'pricing.html';
            return;
        }

        const formatData = safeZones[currentPlatform]?.[currentFormat];
        if (!formatData) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = formatData.width;
        tempCanvas.height = formatData.height;
        const tempCtx = tempCanvas.getContext('2d');

        const maskPath = getMaskPath(formatData);
        tempCtx.fillStyle = hexToRgba(maskColor, 0.5); // Fixed opacity for download
        tempCtx.fill(maskPath);

        const link = document.createElement('a');
        link.download = `${currentPlatform}_${currentFormat.replace(/\s/g, '-')}_mask.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    });

    // 2. Image Upload (PRO Only)
    imageUploadInput.addEventListener('click', async (event) => {
        const { isPro } = await verifyProStatus();
        if (!isPro) {
            event.preventDefault();
            // UPDATED TEXT
            alert('🚫 Image uploads are a Pro feature.\n\nUpgrade to Pro ($8/mo) to preview your own creatives!');
            window.location.href = 'pricing.html';
        }
    });

    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        const { isPro } = await verifyProStatus();
        if (!isPro) return; // Should be caught by click, but double check
    
        const validation = validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
        if (!validation.valid) {
            alert(`Upload failed: ${validation.error}`);
            e.target.value = '';
            return;
        }
    
        if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
        uploadedVideoUrl = null;
        videoPreview.removeAttribute('src');
        videoPreview.style.display = 'none';
    
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                uploadedImage = img;
                updateCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 3. Video Upload (PRO Only)
    videoUploadInput.addEventListener('click', async (event) => {
        const { isPro } = await verifyProStatus();
        if (!isPro) {
            event.preventDefault();
            alert('🚫 Video uploads are a Pro feature.\n\nStart your 7-day free trial to upload your creatives!');
            window.location.href = 'pricing.html';
        }
    });

    videoUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const { isPro } = await verifyProStatus();
        if (!isPro) return;

        const validation = validateFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE);
        if (!validation.valid) {
            alert(`Upload failed: ${validation.error}`);
            e.target.value = '';
            return;
        }

        uploadedImage = null;
        if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);

        uploadedVideoUrl = URL.createObjectURL(file);
        videoPreview.src = uploadedVideoUrl;
        videoPreview.style.display = 'block';
        
        videoPreview.onloadedmetadata = () => {
            const canvasRect = canvas.getBoundingClientRect();
            videoPreview.style.width = `${canvasRect.width}px`;
            videoPreview.style.height = `${canvasRect.height}px`;
            videoPreview.style.objectFit = 'fill';
        };
        
        videoPreview.play();
        updateCanvas();
    });

    // Standard Controls
    formatSelect.addEventListener('change', (e) => {
        currentFormat = e.target.value;
        updateCanvas();
    });

    maskColorInput.addEventListener('input', (e) => {
        maskColor = e.target.value;
        updateCanvas();
    });

    maskOpacityInput.addEventListener('input', (e) => {
        maskOpacity = parseFloat(e.target.value);
        updateCanvas();
    });

    clearBtn.addEventListener('click', () => {
        uploadedImage = null;
        imageUploadInput.value = '';
        if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
        uploadedVideoUrl = null;
        videoPreview.removeAttribute('src');
        videoPreview.style.display = 'none';
        videoUploadInput.value = '';
        updateCanvas();
    });

    initializeTool();
});