// ==========================================
// GLOBAL SCOPE - Outside DOMContentLoaded
// ==========================================

// --- Download Limit Configuration ---
const FREE_DOWNLOAD_LIMIT = 3;
const FREE_UPLOAD_LIMIT = 3;

// --- Download Limit Functions ---
function getDownloadData() {
    const data = localStorage.getItem('downloadTracker');
    if (!data) {
        return { count: 0, date: new Date().toDateString() };
    }
    
    const parsed = JSON.parse(data);
    const today = new Date().toDateString();
    
    if (parsed.date !== today) {
        return { count: 0, date: today };
    }
    
    return parsed;
}

function getUploadData() {
    const data = localStorage.getItem('uploadTracker');
    if (!data) {
        return { count: 0, date: new Date().toDateString() };
    }
    
    const parsed = JSON.parse(data);
    const today = new Date().toDateString();
    
    // Reset counter if it's a new day
    if (parsed.date !== today) {
        return { count: 0, date: today };
    }
    
    return parsed;
}

function incrementDownloadCount() {
    const data = getDownloadData();
    data.count += 1;
    localStorage.setItem('downloadTracker', JSON.stringify(data));
    return data.count;
}

function incrementUploadCount() {
    const data = getUploadData();
    data.count += 1;
    localStorage.setItem('uploadTracker', JSON.stringify(data));
    return data.count;
}

function getRemainingDownloads(isPro) {
    if (isPro) {
        return Infinity;
    }
    
    const data = getDownloadData();
    const remaining = FREE_DOWNLOAD_LIMIT - data.count;
    return Math.max(0, remaining);
}

function getRemainingUploads(isPro) {
    // Pro users have unlimited uploads
    if (isPro) {
        return Infinity;
    }
    
    const data = getUploadData();
    const remaining = FREE_UPLOAD_LIMIT - data.count;
    return Math.max(0, remaining);
}

function hasReachedDownloadLimit(isPro) {
    if (isPro) {
        return false;
    }
    
    const data = getDownloadData();
    return data.count >= FREE_DOWNLOAD_LIMIT;
}

function hasReachedUploadLimit(isPro) {
    if (isPro) {
        return false; // Pro users never hit limit
    }
    
    const data = getUploadData();
    return data.count >= FREE_UPLOAD_LIMIT;
}

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

    // ==========================================
    // ✅ FIX #1: Move verifyProStatus here (inside DOMContentLoaded)
    // ==========================================
    
    async function verifyProStatus() {
        try {
            const session = await supabaseClient.auth.getSession();
            if (!session.data.session) {
                return { isPro: false, verified: false };
            }
    
            // ✅ Query database directly instead of using edge function
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('subscription_status')
                .eq('id', session.data.session.user.id)
                .single();
    
            if (error) {
                console.error('Error verifying subscription status:', error);
                return { isPro: false, verified: false };
            }
    
            // ✅ Consider both PRO and STUDIO as "pro" users
            const status = data?.subscription_status || 'FREE';
            const isPro = (status === 'PRO' || status === 'STUDIO');
    
            return { isPro, verified: true };
        } catch (error) {
            console.error('Error in verifyProStatus:', error);
            return { isPro: false, verified: false };
        }
    }
    

    // ==========================================
    // ✅ FIX #2: Add closing brace to updateDownloadCounter
    // ==========================================
    
    async function updateDownloadCounter() {
        const counterText = document.getElementById('download-counter-text');
        if (!counterText) return;

        const { isPro } = await verifyProStatus();

        if (isPro) {
            return;
        }

        const remaining = getRemainingDownloads(isPro);
        const used = FREE_DOWNLOAD_LIMIT - remaining;

        if (remaining === 0) {
            counterText.innerHTML = `🚫 Daily limit reached (${used}/${FREE_DOWNLOAD_LIMIT}) - <a href="pricing.html" style="color: #2196F3; text-decoration: underline;">Upgrade to Pro</a>`;
            counterText.style.color = '#f44336';
        } else if (remaining === 1) {
            counterText.innerHTML = `⚠️ Last free download today (${used}/${FREE_DOWNLOAD_LIMIT}) - <a href="pricing.html" style="color: #2196F3;">Upgrade for unlimited</a>`;
            counterText.style.color = '#ff9800';
        } else {
            counterText.innerHTML = `📥 ${remaining} free downloads remaining today`;
            counterText.style.color = '#666';
        }
    } 

    async function updateUploadCounter() {
        const counterText = document.getElementById('upload-counter-text');
        if (!counterText) return; // Element doesn't exist
        
        const { isPro } = await verifyProStatus();
        
        if (isPro) {
            return;
        }
        
        const remaining = getRemainingUploads(isPro);
        const used = FREE_UPLOAD_LIMIT - remaining;
        
        if (remaining === 0) {
            counterText.innerHTML = `🚫 Daily upload limit reached (${used}/${FREE_UPLOAD_LIMIT}) - <a href="pricing.html" style="color: #2196F3; text-decoration: underline;">Upgrade to Pro</a>`;
            counterText.style.color = '#f44336'; // Red
        } else if (remaining === 1) {
            counterText.innerHTML = `⚠️ Last free upload today (${used}/${FREE_UPLOAD_LIMIT}) - <a href="pricing.html" style="color: #2196F3;">Upgrade for unlimited</a>`;
            counterText.style.color = '#ff9800'; // Orange
        } else {
            counterText.innerHTML = `📤 ${remaining} free uploads remaining today`;
            counterText.style.color = '#666'; // Gray
        }
    }

    // --- Validation Functions ---
    function validateFile(file, allowedTypes, maxSize) {
        if (!file) {
            return { valid: false, error: 'No file selected' };
        }

        if (!allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
            };
        }

        if (file.size > maxSize) {
            const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
            return {
                valid: false,
                error: `File too large. Maximum size: ${maxSizeMB}MB`
            };
        }

        const dangerousChars = /[<>:"\/\\|?*\x00-\x1f]/g;
        if (dangerousChars.test(file.name)) {
            return {
                valid: false,
                error: 'Filename contains invalid characters'
            };
        }

        if (file.name.includes('..') || file.name.startsWith('.')) {
            return {
                valid: false,
                error: 'Invalid filename format'
            };
        }

        return { valid: true };
    }

    // --- Helper Function ---
    function hexToRgba(hex, opacity) {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // ==========================================
    // ✅ FIX #3: Prevent right-click on canvas
    // ==========================================
    
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        alert('⚠️ Please use the Download button to save masks.\n\nThis ensures download limits are tracked correctly.');
        return false;
    });
    
    // ✅ Also prevent drag-and-drop saving
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
            ctx.fillText('Your Creative Here', canvas.width / 2, canvas.height / 2);
        } else if (uploadedImage) {
            ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
        } else if (uploadedVideoUrl) {
            // ✅ Get the canvas's ACTUAL rendered size on screen
            const canvasRect = canvas.getBoundingClientRect();
            
            // ✅ Set video to match the canvas's rendered size exactly
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

    async function verifyImageFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arr = new Uint8Array(e.target.result).subarray(0, 4);
                let header = '';
                for (let i = 0; i < arr.length; i++) {
                    header += arr[i].toString(16).padStart(2, '0');
                }

                const validHeaders = {
                    'ffd8ffe0': 'image/jpeg',
                    'ffd8ffe1': 'image/jpeg',
                    'ffd8ffe2': 'image/jpeg',
                    '89504e47': 'image/png',
                    '52494646': 'image/webp'
                };
                
                const matchedType = validHeaders[header.substring(0, 8)];
                resolve(matchedType ? { valid: true } : { valid: false, error: 'File content does not match file type' });
            };
            reader.onerror = () => resolve({ valid: false, error: 'Could not read file' });
            reader.readAsArrayBuffer(file.slice(0, 4));
        });
    }

    const gateProFeatures = async () => {
        const { isPro } = await verifyProStatus();
        
        if (isPro) {
            videoUploadInput.disabled = false;
            videoUploadLabel.classList.remove('disabled');
        } else {
            videoUploadInput.disabled = true;
            videoUploadLabel.classList.add('disabled');
        }
    };

    const initializeTool = async () => {
        try {
            // Load formats from Supabase instead of JSON file
            const { data, error } = await supabaseClient
                .from('platform_formats')
                .select('*')
                .eq('active', true)
                .order('sort_order');
    
            if (error) throw error;
    
            // Transform to the same structure as safezones.json
            safeZones = {};
            data.forEach(format => {
                if (!safeZones[format.platform]) {
                    safeZones[format.platform] = {};
                }
                safeZones[format.platform][format.format_name] = {
                    width: format.width,
                    height: format.height,
                    description: format.description,
                    safeZone: format.safe_zone,           // From JSONB
                    dangerZones: format.danger_zones,     // From JSONB
                    link: format.reference_link
                };
            });
    
            console.log('✅ Loaded', data.length, 'formats from Supabase');
            
        } catch (error) {
            console.error('Could not load safe zones data', error);
            alert('⚠️ Failed to load platform formats. Please refresh the page.');
            return;
        }
        
        populatePlatforms();
        populateFormats();
        updateCanvas();
        await gateProFeatures();  // ✅ Add await here
        
        document.addEventListener('profileLoaded', async () => {
            await gateProFeatures();  // ✅ Add await here too
        });
    };

    document.addEventListener('profileLoaded', gateProFeatures);

    // --- Event Listeners ---
    downloadBtn.addEventListener('click', async () => {
        const formatData = safeZones[currentPlatform]?.[currentFormat];
        if (!formatData) {
            console.error('Could not get format data for download.');
            return;
        }

        const { isPro } = await verifyProStatus();

        if (hasReachedDownloadLimit(isPro)) {
            const upgradeMessage = confirm(
                '🚫 Daily Download Limit Reached!\n\n' +
                `You've downloaded ${FREE_DOWNLOAD_LIMIT} masks today (your free daily limit).\n\n` +
                '✨ Upgrade to Pro for:\n' +
                '• Unlimited full-resolution exports\n' +
                '• Video preview support\n\n' +
                'Click OK to upgrade now, or Cancel to try again tomorrow.'
            );

            if (upgradeMessage) {
                window.location.href = 'pricing.html';
            }
            return;
        }

        if (!isPro) {
            const remaining = getRemainingDownloads(isPro) - 1;
            
            const proceed = confirm(
                '⚠️ Free users receive low-resolution previews.\n\n' +
                '✨ Upgrade to Pro for full-resolution downloads.\n\n' +
                `Downloads remaining today: ${remaining} of ${FREE_DOWNLOAD_LIMIT}\n\n` +
                'Click OK to download low-res, or Cancel to upgrade first.'
            );

            if (!proceed) {
                window.location.href = 'pricing.html';
                return;
            }
        }

        const currentCount = incrementDownloadCount();

        const scale = isPro ? 1.0 : 0.5;
        const scaledWidth = formatData.width * scale;
        const scaledHeight = formatData.height * scale;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = scaledWidth;
        tempCanvas.height = scaledHeight;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.scale(scale, scale);
        const maskPath = getMaskPath(formatData);
        tempCtx.fillStyle = hexToRgba(maskColor, 0.5);
        tempCtx.fill(maskPath);

        const link = document.createElement('a');
        link.download = `${currentPlatform}_${currentFormat.replace(/\s/g, '-')}_mask.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();

        // Update counter display after download
        updateDownloadCounter();

        if (!isPro && currentCount >= FREE_DOWNLOAD_LIMIT) {
            setTimeout(() => {
                alert(
                    '🎉 Download complete!\n\n' +
                    `You've used all ${FREE_DOWNLOAD_LIMIT} free downloads today.\n\n` +
                    '💡 Want unlimited downloads? Upgrade to Pro for just $5/month!'
                );
            }, 500);
        } else if (!isPro) {
            const remaining = FREE_DOWNLOAD_LIMIT - currentCount;
            setTimeout(() => {
                alert(
                    '✅ Download complete!\n\n' +
                    `${remaining} free download${remaining === 1 ? '' : 's'} remaining today.`
                );
            }, 500);
        }
    });

    videoUploadLabel.addEventListener('click', (event) => {
        if (videoUploadLabel.classList.contains('disabled')) {
            event.preventDefault();
            alert('Video uploads are a Pro feature! Please upgrade to a Pro account to use this feature.');
            window.location.href = 'pricing.html';
        }
    });

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

    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        // ✅ CHECK PRO STATUS FIRST
        const { isPro } = await verifyProStatus();
    
        // ✅ CHECK UPLOAD LIMIT BEFORE ALLOWING UPLOAD
        if (hasReachedUploadLimit(isPro)) {
            alert(
                '🚫 Daily Upload Limit Reached!\n\n' +
                `You've uploaded ${FREE_UPLOAD_LIMIT} images today (your free daily limit).\n\n` +
                '✨ Upgrade to Pro for:\n' +
                '• Unlimited uploads\n' +
                '• Unlimited downloads\n' +
                '• Full-resolution exports\n' +
                '• Video preview support\n\n' +
                'Upgrade now to continue using SafeZoneGuide!'
            );
            e.target.value = ''; // Clear the file input
            
            // Optional: Redirect to pricing
            const goToPricing = confirm('Go to pricing page now?');
            if (goToPricing) {
                window.location.href = 'pricing.html';
            }
            return; // Stop the upload
        }
    
        // ✅ VALIDATE THE FILE
        const validation = validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE);
    
        if (!validation.valid) {
            alert(`Upload failed: ${validation.error}`);
            e.target.value = '';
            return;
        }
    
        // Clear any existing video
        if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
        uploadedVideoUrl = null;
        videoPreview.removeAttribute('src');
        videoPreview.style.display = 'none';
    
        // ✅ VERIFY FILE CONTENT (security check)
        const contentCheck = await verifyImageFile(file);
        if (!contentCheck.valid) {
            alert(`Upload failed: ${contentCheck.error}`);
            e.target.value = '';
            return;
        }
    
        // ✅ INCREMENT UPLOAD COUNT (before processing)
        const currentCount = incrementUploadCount();
    
        // Process the validated file
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                uploadedImage = img;
                updateCanvas();
                
                // ✅ UPDATE COUNTER DISPLAY AFTER SUCCESSFUL UPLOAD
                updateUploadCounter();
                
                // ✅ SHOW FRIENDLY MESSAGE AFTER UPLOAD
                if (!isPro) {
                    const remaining = FREE_UPLOAD_LIMIT - currentCount;
                    
                    if (remaining === 0) {
                        setTimeout(() => {
                            alert(
                                '✅ Image uploaded!\n\n' +
                                `You've used all ${FREE_UPLOAD_LIMIT} free uploads today.\n\n` +
                                '💡 Upgrade to Pro for unlimited uploads and downloads!'
                            );
                        }, 300);
                    } else {
                        setTimeout(() => {
                            alert(
                                `✅ Image uploaded!\n\n` +
                                `${remaining} free upload${remaining === 1 ? '' : 's'} remaining today.`
                            );
                        }, 300);
                    }
                }
            };
            img.onerror = () => {
                alert('Failed to load image. File may be corrupted.');
                e.target.value = '';
                // Don't increment counter if upload failed
            };
            img.src = event.target.result;
        };
        reader.onerror = () => {
            alert('Failed to read file.');
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    });
    

    videoUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const { isPro, verified } = await verifyProStatus();

        if (!isPro) {
            alert('Video upload is a PRO feature. Please upgrade to access this feature.');
            e.target.value = '';
            return;
        }

        if (!verified) {
            alert('Could not verify your subscription status. Please try again.');
            e.target.value = '';
            return;
        }

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
        const formatData = safeZones[currentPlatform]?.[currentFormat];
        if (formatData) {
            videoPreview.width = formatData.width;
            videoPreview.height = formatData.height;
            videoPreview.style.width = `${formatData.width}px`;
            videoPreview.style.height = `${formatData.height}px`;
        }        
        videoPreview.onloadedmetadata = () => {
            const canvasRect = canvas.getBoundingClientRect();
            videoPreview.style.width = `${canvasRect.width}px`;
            videoPreview.style.height = `${canvasRect.height}px`;
            videoPreview.style.objectFit = 'fill';
        };
        
        videoPreview.onerror = () => {
            alert('Failed to load video. File may be corrupted or unsupported.');
            URL.revokeObjectURL(uploadedVideoUrl);
            uploadedVideoUrl = null;
            videoPreview.removeAttribute('src');
            videoPreview.style.display = 'none';
            e.target.value = '';
        };
        
        videoPreview.play();
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

    // --- Initial Setup ---
    initializeTool();

    // ✅ Update both counters on page load
    updateDownloadCounter();
    updateUploadCounter();

    // ✅ Update both counters when auth state changes
    supabaseClient.auth.onAuthStateChange(() => {
        updateDownloadCounter();
        updateUploadCounter();
    });

}); // End DOMContentLoaded
