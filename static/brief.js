// static/brief.js
// Public Creative Brief Page



let campaign = null;
let creatives = [];
let formats = {};

// Initialize Supabase client for brief.html
if (!window.app) {
    window.app = {
        supabaseClient: window.supabase.createClient(
            'https://yoatrgbojsfpegorzbma.supabase.co', // Your Supabase URL
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYXRyZ2JvanNmcGVnb3J6Ym1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTMzOTcsImV4cCI6MjA3NjU2OTM5N30.RA0hse-MXlq-q0MXTvwqRXc_naFgm5rtpJ16v4N9r3k' // Your anon key
        )
    };
}

const supabaseClient = window.app.supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showError();
        return;
    }

    await loadBrief(token);
});

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Load brief data
async function loadBrief(token) {
    try {
        // Load campaign
        const { data: campaignData, error: campaignError } = await supabaseClient
            .from('campaigns')
            .select('*')
            .eq('share_token', token)
            .eq('share_enabled', true)
            .single();

        if (campaignError) throw campaignError;
        if (!campaignData) {
            showError();
            return;
        }

        // Check if expired
        if (campaignData.share_expires_at && new Date(campaignData.share_expires_at) < new Date()) {
            showError();
            return;
        }

        // Check password
        if (campaignData.share_password) {
            showPasswordGate(token, campaignData);
            return;
        }

        // Load creatives
        await displayBrief(campaignData);

    } catch (error) {
        console.error('Error loading brief:', error);
        showError();
    }
}

// Show password gate
function showPasswordGate(token, campaignData) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('password-gate').style.display = 'block';

    document.getElementById('password-submit').addEventListener('click', () => {
        const password = document.getElementById('password-input').value;
        if (password === campaignData.share_password) {
            document.getElementById('password-gate').style.display = 'none';
            displayBrief(campaignData);
        } else {
            document.getElementById('password-error').style.display = 'block';
        }
    });

    document.getElementById('password-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('password-submit').click();
        }
    });
}

// Display brief
async function displayBrief(campaignData) {
    campaign = campaignData;

    // Load creatives
    const { data: creativesData, error: creativesError } = await supabaseClient
        .from('campaign_formats')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at');

    if (creativesError) throw creativesError;
    creatives = creativesData || [];

    // Load platform formats
    const { data: formatsData, error: formatsError } = await supabaseClient
        .from('platform_formats')
        .select('*')
        .eq('active', true);

    if (formatsError) throw formatsError;

    // Build formats lookup
    formats = {};
    (formatsData || []).forEach(format => {
        if (!formats[format.platform]) {
            formats[format.platform] = {};
        }
        formats[format.platform][format.format_name] = {
            width: format.width,
            height: format.height,
            aspect_ratio: format.aspect_ratio,
            description: format.description,
            safeZone: format.safe_zone,              // ✅ Add this
            dangerZones: format.danger_zones,        // ✅ Add this
            file_formats: format.file_formats,
            max_file_size: format.max_file_size,
            video_file_formats: format.video_file_formats,
            duration_limit: format.duration_limit,
            frame_rate: format.frame_rate,
            codec: format.codec,
            audio_format: format.audio_format,
            reference_link: format.reference_link
        };
    });

    // Render
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('brief-content').style.display = 'block';

    document.getElementById('campaign-name').textContent = campaign.name;
    if (campaign.client_name) {
        document.getElementById('campaign-client').textContent = `Client: ${campaign.client_name}`;
    }
    if (campaign.description) {
        document.getElementById('campaign-description').textContent = campaign.description;
    }

    renderFormats();

    // Download PDF button
    document.getElementById('download-pdf-btn').addEventListener('click', () => {
        CampaignPDF.generate(campaign, creatives, supabaseClient);
    });
}

// Render format groups
function renderFormats() {
    const container = document.getElementById('formats-container');

    // Group by platform and format
    const grouped = {};
    creatives.forEach(creative => {
        const key = `${creative.platform}|||${creative.format}`;
        if (!grouped[key]) {
            grouped[key] = {
                platform: creative.platform,
                format: creative.format,
                creatives: []
            };
        }
        grouped[key].creatives.push(creative);
    });

    container.innerHTML = Object.values(grouped).map(group => {
        const formatData = formats[group.platform]?.[group.format];
        return renderFormatGroup(group, formatData);
    }).join('');

    // Add toggle listeners
    document.querySelectorAll('.format-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const arrow = header.querySelector('.arrow');
            content.classList.toggle('active');
            arrow.textContent = content.classList.contains('active') ? '▼' : '▶';
        });
    });

    // Status change listeners
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', updateCreativeStatus);
    });
}

// Render format group
function renderFormatGroup(group, formatData) {
    const completedCount = group.creatives.filter(c => c.status === 'approved').length;
    const totalCount = group.creatives.length;

    return `
        <div class="format-group">
            <div class="format-header">
                <div>
                    <h3 style="margin: 0 0 5px 0; font-size: 18px;">
                        <span class="arrow">▶</span> ${group.platform} - ${group.format}
                    </h3>
                    <p style="margin: 0; color: #666; font-size: 14px;">
                        ${formatData ? `${formatData.width}×${formatData.height}px` : 'Custom format'}
                        · ${completedCount}/${totalCount} approved
                    </p>
                </div>
            </div>
            <div class="format-content">
                ${group.creatives.map(c => renderCreative(c, formatData)).join('')}
            </div>
        </div>
    `;
}

// Render creative
function renderCreative(creative, formatData) {
    return `
        <div class="creative-card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 8px 0; font-size: 15px;">${escapeHtml(creative.creative_name)}</h4>
                    
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                        <span class="badge-tag" style="text-transform: capitalize;">${creative.creative_type || 'image'}</span>
                        ${creative.duration ? `<span class="badge-tag">${escapeHtml(creative.duration)}</span>` : ''}
                    </div>
                    
                    ${creative.creative_description ? `
                        <p style="margin: 0; color: #666; font-size: 13px;">${escapeHtml(creative.creative_description)}</p>
                    ` : ''}
                </div>
            </div>
            
            <!-- Action buttons -->
            <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <button onclick="openSafeZoneTest('${creative.id}')" class="btn" style="flex: 1; background: #8b5cf6; color: white; font-size: 13px; padding: 8px 12px;">
                    🎯 Test Safe Zone
                </button>
                <button onclick="openFileSpecs('${creative.id}')" class="btn" style="flex: 1; background: #f59e0b; color: white; font-size: 13px; padding: 8px 12px;">
                    📄 View Specs
                </button>
            </div>
        </div>
    `;
}


// Update creative status
async function updateCreativeStatus(e) {
    const creativeId = e.target.dataset.creativeId;
    const newStatus = e.target.value;

    try {
        const { error } = await supabaseClient
            .from('campaign_formats')
            .update({ status: newStatus })
            .eq('id', creativeId);

        if (error) throw error;


        // Re-render to update counts
        renderFormats();

    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status');
    }
}

// Show error
function showError() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
}

// ===== SAFE ZONE TEST MODAL =====

let currentTestingCreative = null;
let uploadedImage = null;
let uploadedVideoUrl = null;
let maskColor = '#FF0000';
let maskOpacity = 0.4;
let videoAnimFrame = null;

window.openSafeZoneTest = function(creativeId) {
    const creative = creatives.find(c => c.id === creativeId);
    if (!creative) return;
    
    currentTestingCreative = creative;
    const formatData = formats[creative.platform]?.[creative.format];
    
    // Set modal title
    document.getElementById('safezone-modal-title').textContent = 
        `Safe Zone Test: ${creative.creative_name}`;
    
    // Set format info
    const formatInfo = creative.is_custom
        ? `${creative.format} (${creative.custom_width}×${creative.custom_height}px)`
        : formatData 
            ? `${creative.platform} - ${creative.format} (${formatData.width}×${formatData.height}px)`
            : 'Unknown format';
    
    document.getElementById('safezone-format-info').textContent = formatInfo;
    
    // ✅ Set canvas size with null check
    const canvas = document.getElementById('brief-safezone-canvas');
    if (canvas) {  // Add this check
        if (creative.is_custom) {
            canvas.width = creative.custom_width;
            canvas.height = creative.custom_height;
        } else if (formatData) {
            canvas.width = formatData.width;
            canvas.height = formatData.height;
        }
    }
    
    // Clear previous uploads
    clearSafeZoneUpload();
    renderSafeZoneCanvas();
    
    // Show modal
    document.getElementById('safezone-modal').classList.add('active');
};

window.closeSafeZoneModal = function() {
    clearSafeZoneUpload();
    document.getElementById('safezone-modal').classList.remove('active');
    currentTestingCreative = null;
};

function renderSafeZoneCanvas() {
    const canvas = document.getElementById('brief-safezone-canvas');
    if (!canvas) return; // ✅ Add this check
    
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (uploadedImage) {
        ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
    } else if (!uploadedVideoUrl) {
        // Placeholder
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#bbb';
        ctx.textAlign = 'center';
        ctx.font = '20px Arial';
        ctx.fillText('Upload your creative to test', canvas.width / 2, canvas.height / 2);
    }
    
    // Draw mask
    drawSafeZoneMask(ctx);
}

function drawSafeZoneMask(ctx) {
    if (!currentTestingCreative) return;
    
    const creative = currentTestingCreative;
    const formatData = formats[creative.platform]?.[creative.format];
    
    if (!formatData || (!formatData.safeZone && !formatData.dangerZones)) return;
    
    const canvas = document.getElementById('brief-safezone-canvas');
    if (!canvas) return; // ✅ Add this check
    
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
    
    ctx.fillStyle = hexToRgba(maskColor, maskOpacity);
    ctx.fill(path);
}

function animateVideoMask() {
    const ctx = document.getElementById('brief-safezone-canvas').getContext('2d');
    
    function draw() {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        drawSafeZoneMask(ctx);
        videoAnimFrame = requestAnimationFrame(draw);
    }
    
    draw();
}

function clearSafeZoneUpload() {
    if (videoAnimFrame) {
        cancelAnimationFrame(videoAnimFrame);
        videoAnimFrame = null;
    }
    
    uploadedImage = null;
    if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl);
        uploadedVideoUrl = null;
    }
    
    const video = document.getElementById('brief-safezone-video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.style.display = 'none';
    
    document.getElementById('brief-image-upload').value = '';
    document.getElementById('brief-video-upload').value = '';
}

function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Image upload
const imageUpload = document.getElementById('brief-image-upload');
if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            alert('Image too large. Max 10MB.');
            return;
        }
        
        clearSafeZoneUpload();
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                uploadedImage = img;
                renderSafeZoneCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Video upload
const videoUpload = document.getElementById('brief-video-upload');
if (videoUpload) {
    videoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 100 * 1024 * 1024) {
            alert('Video too large. Max 100MB.');
            return;
        }
        
        clearSafeZoneUpload();
        
        uploadedVideoUrl = URL.createObjectURL(file);
        const video = document.getElementById('brief-safezone-video');
        const canvas = document.getElementById('brief-safezone-canvas');
        
        video.style.width = canvas.width + 'px';
        video.style.height = canvas.height + 'px';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.display = 'block';
        
        canvas.style.position = 'relative';
        canvas.style.zIndex = '1';
        
        video.src = uploadedVideoUrl;
        video.play();
        
        animateVideoMask();
    });
}


// Color picker
const colorPicker = document.getElementById('brief-mask-color');
if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
        maskColor = e.target.value;
        renderSafeZoneCanvas();
    });
}

// Opacity slider
const opacitySlider = document.getElementById('brief-mask-opacity');
if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
        maskOpacity = parseFloat(e.target.value);
        const valueDisplay = document.getElementById('brief-opacity-value');
        if (valueDisplay) {
            valueDisplay.textContent = Math.round(maskOpacity * 100) + '%';
        }
        renderSafeZoneCanvas();
    });
}

// Clear button
const clearBtn = document.getElementById('brief-clear-upload');
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        clearSafeZoneUpload();
        renderSafeZoneCanvas();
    });
}

// Modal background clicks
const safeZoneModal = document.getElementById('safezone-modal');
if (safeZoneModal) {
    safeZoneModal.addEventListener('click', (e) => {
        if (e.target.id === 'safezone-modal') closeSafeZoneModal();
    });
}

const specsModal = document.getElementById('specs-modal');
if (specsModal) {
    specsModal.addEventListener('click', (e) => {
        if (e.target.id === 'specs-modal') closeSpecsModal();
    });
}

// ===== FILE SPECS MODAL =====

window.openFileSpecs = function(creativeId) {
    const creative = creatives.find(c => c.id === creativeId);
    if (!creative) return;
    
    const formatData = formats[creative.platform]?.[creative.format];
    
    // Set modal title
    document.getElementById('specs-modal-title').textContent = 
        `File Specifications: ${creative.creative_name}`;
    
    // Build specs HTML
    let specsHtml = '';
    
    if (creative.is_custom) {
        specsHtml = `
            <div style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;">
                    <strong>Custom Format</strong><br>
                    Dimensions: ${creative.custom_width}×${creative.custom_height}px
                </p>
            </div>
        `;
    } else if (formatData) {
        // Format info
        specsHtml += `
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0;">Format</h4>
                <p style="margin: 0; color: #666;">${creative.platform} - ${creative.format}</p>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                    ${formatData.width}×${formatData.height}px
                    ${formatData.aspect_ratio ? `(${formatData.aspect_ratio})` : ''}
                </p>
            </div>
        `;
        
        // Image specs
        if (formatData.file_formats || formatData.max_file_size) {
            specsHtml += `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0;">Image Specifications</h4>
                    ${formatData.file_formats ? `<p style="margin: 5px 0;"><strong>File Formats:</strong> ${formatData.file_formats.join(', ')}</p>` : ''}
                    ${formatData.max_file_size ? `<p style="margin: 5px 0;"><strong>Max File Size:</strong> ${formatData.max_file_size}</p>` : ''}
                </div>
            `;
        }
        
        // Video specs
        if (formatData.video_file_formats || formatData.duration_limit || formatData.frame_rate || formatData.codec) {
            specsHtml += `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0;">Video Specifications</h4>
                    ${formatData.video_file_formats ? `<p style="margin: 5px 0;"><strong>File Formats:</strong> ${formatData.video_file_formats.join(', ')}</p>` : ''}
                    ${formatData.duration_limit ? `<p style="margin: 5px 0;"><strong>Duration:</strong> ${formatData.duration_limit}</p>` : ''}
                    ${formatData.frame_rate ? `<p style="margin: 5px 0;"><strong>Frame Rate:</strong> ${formatData.frame_rate}</p>` : ''}
                    ${formatData.codec ? `<p style="margin: 5px 0;"><strong>Video Codec:</strong> ${formatData.codec}</p>` : ''}
                    ${formatData.audio_format ? `<p style="margin: 5px 0;"><strong>Audio:</strong> ${formatData.audio_format}</p>` : ''}
                </div>
            `;
        }
        
        // Reference link
        if (formatData.reference_link) {
            specsHtml += `
                <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0;">
                        <a href="${formatData.reference_link}" target="_blank" style="color: #2563eb; text-decoration: none;">
                            📖 View official platform documentation →
                        </a>
                    </p>
                </div>
            `;
        }
    } else {
        specsHtml = '<p style="color: #999;">No specifications available for this format.</p>';
    }
    
    document.getElementById('specs-modal-body').innerHTML = specsHtml;
    document.getElementById('specs-modal').classList.add('active');
};

window.closeSpecsModal = function() {
    document.getElementById('specs-modal').classList.remove('active');
};

// Close modals on background click
document.getElementById('safezone-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'safezone-modal') closeSafeZoneModal();
});

document.getElementById('specs-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'specs-modal') closeSpecsModal();
});
