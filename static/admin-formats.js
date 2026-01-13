// Admin CMS for Platform Formats
const supabaseClient = window.app.supabaseClient;
let currentEditingId = null;
let fileFormatTags = [];
let videoFileFormatTags = [];

// Check admin access
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in and is admin
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // Check if user is admin
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

    if (error || !profile || !profile.is_admin) {
        alert('Access denied. Admin privileges required.');
        window.location.href = 'app.html';
        return;
    }

    // Load formats
    await loadFormats();
    setupEventListeners();
});

// Load all formats
async function loadFormats() {
    try {
        const { data, error } = await supabaseClient
            .from('platform_formats')
            .select('*')
            .order('platform')
            .order('sort_order');

        if (error) throw error;

        renderFormats(data);
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('formats-container').style.display = 'block';
    } catch (error) {
        console.error('Error loading formats:', error);
        alert('Failed to load formats. Please refresh the page.');
    }
}

// Render formats table
function renderFormats(formats) {
    const tbody = document.getElementById('formats-tbody');
    tbody.innerHTML = formats.map(format => `
        <tr>
            <td><strong>${escapeHtml(format.platform)}</strong></td>
            <td>${escapeHtml(format.format_name)}</td>
            <td>${format.width}×${format.height}px</td>
            <td>${format.file_formats ? format.file_formats.join(', ') : '-'}</td>
            <td>${format.max_file_size || '-'}</td>
            <td>
                <span class="badge ${format.active ? 'badge-active' : 'badge-inactive'}">
                    ${format.active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button onclick="editFormat('${format.id}')" class="btn btn-small" style="background: #667eea; color: white;">
                    Edit
                </button>
                <button onclick="duplicateFormat('${format.id}')" class="btn btn-small" style="background: #10b981; color: white;">
                    Duplicate
                </button>
                <button onclick="deleteFormat('${format.id}')" class="btn btn-small" style="background: #ef4444; color: white;">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('new-format-btn').addEventListener('click', openNewFormatModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('format-form').addEventListener('submit', saveFormat);
    
    // Tag input for IMAGE file formats
    const fileFormatsInput = document.getElementById('file-formats');
    fileFormatsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = e.target.value.trim().toUpperCase();
            if (value && !fileFormatTags.includes(value)) {
                fileFormatTags.push(value);
                renderFileFormatTags();
                e.target.value = '';
            }
        }
    });

    // Tag input for VIDEO file formats
    const videoFileFormatsInput = document.getElementById('video-file-formats');
    videoFileFormatsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = e.target.value.trim().toUpperCase();
            if (value && !videoFileFormatTags.includes(value)) {
                videoFileFormatTags.push(value);
                renderVideoFileFormatTags();
                e.target.value = '';
            }
        }
    });
}

// Render IMAGE file format tags
function renderFileFormatTags() {
    const container = document.getElementById('file-formats-container');
    const input = document.getElementById('file-formats');
    
    // Clear and rebuild
    container.innerHTML = '';
    
    fileFormatTags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.innerHTML = `
            ${tag}
            <span class="tag-remove" onclick="removeFileFormatTag('${tag}')">×</span>
        `;
        container.appendChild(tagEl);
    });
    
    container.appendChild(input);
}

// Render VIDEO file format tags
function renderVideoFileFormatTags() {
    const container = document.getElementById('video-file-formats-container');
    const input = document.getElementById('video-file-formats');
    
    // Clear and rebuild
    container.innerHTML = '';
    
    videoFileFormatTags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.innerHTML = `
            ${tag}
            <span class="tag-remove" onclick="removeVideoFileFormatTag('${tag}')">×</span>
        `;
        container.appendChild(tagEl);
    });
    
    container.appendChild(input);
}

// Remove IMAGE file format tag
window.removeFileFormatTag = function(tag) {
    fileFormatTags = fileFormatTags.filter(t => t !== tag);
    renderFileFormatTags();
};

// Remove VIDEO file format tag
window.removeVideoFileFormatTag = function(tag) {
    videoFileFormatTags = videoFileFormatTags.filter(t => t !== tag);
    renderVideoFileFormatTags();
};

// Open new format modal
function openNewFormatModal() {
    currentEditingId = null;
    fileFormatTags = [];
    videoFileFormatTags = [];
    document.getElementById('modal-title').textContent = 'New Format';
    document.getElementById('format-form').reset();
    renderFileFormatTags();
    renderVideoFileFormatTags();
    document.getElementById('format-modal').classList.add('active');
}

// Edit format
window.editFormat = async function(id) {
    try {
        const { data, error } = await supabaseClient
            .from('platform_formats')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        currentEditingId = id;
        fileFormatTags = data.file_formats || [];
        videoFileFormatTags = data.video_file_formats || [];
        
        document.getElementById('modal-title').textContent = 'Edit Format';
        document.getElementById('platform').value = data.platform || '';
        document.getElementById('format-name').value = data.format_name || '';
        document.getElementById('width').value = data.width || '';
        document.getElementById('height').value = data.height || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('reference-link').value = data.reference_link || '';
        document.getElementById('sort-order').value = data.sort_order || 0;
        document.getElementById('aspect-ratio').value = data.aspect_ratio || '';
        
        // Image specs
        document.getElementById('max-file-size').value = data.max_file_size || '';
        
        // Video specs
        document.getElementById('frame-rate').value = data.frame_rate || '';
        document.getElementById('duration-limit').value = data.duration_limit || '';
        document.getElementById('codec').value = data.codec || '';
        document.getElementById('audio-format').value = data.audio_format || '';
        
        document.getElementById('special-requirements').value = data.special_requirements || '';
        
        document.getElementById('safe-zone').value = data.safe_zone ? JSON.stringify(data.safe_zone, null, 2) : '';
        document.getElementById('danger-zones').value = data.danger_zones ? JSON.stringify(data.danger_zones, null, 2) : '';
        
        document.getElementById('active').checked = data.active !== false;
        
        renderFileFormatTags();
        renderVideoFileFormatTags();
        document.getElementById('format-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading format:', error);
        alert('Failed to load format details.');
    }
};

// Duplicate format
window.duplicateFormat = async function(id) {
    try {
        const { data, error } = await supabaseClient
            .from('platform_formats')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        currentEditingId = null;
        fileFormatTags = data.file_formats || [];
        videoFileFormatTags = data.video_file_formats || [];
        
        document.getElementById('modal-title').textContent = 'Duplicate Format';
        document.getElementById('platform').value = data.platform || '';
        document.getElementById('format-name').value = (data.format_name || '') + ' (Copy)';
        document.getElementById('width').value = data.width || '';
        document.getElementById('height').value = data.height || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('reference-link').value = data.reference_link || '';
        document.getElementById('sort-order').value = (data.sort_order || 0) + 1;
        document.getElementById('aspect-ratio').value = data.aspect_ratio || '';
        
        // Image specs
        document.getElementById('max-file-size').value = data.max_file_size || '';
        
        // Video specs
        document.getElementById('frame-rate').value = data.frame_rate || '';
        document.getElementById('duration-limit').value = data.duration_limit || '';
        document.getElementById('codec').value = data.codec || '';
        document.getElementById('audio-format').value = data.audio_format || '';
        
        document.getElementById('special-requirements').value = data.special_requirements || '';
        
        document.getElementById('safe-zone').value = data.safe_zone ? JSON.stringify(data.safe_zone, null, 2) : '';
        document.getElementById('danger-zones').value = data.danger_zones ? JSON.stringify(data.danger_zones, null, 2) : '';
        
        document.getElementById('active').checked = data.active !== false;
        
        renderFileFormatTags();
        renderVideoFileFormatTags();
        document.getElementById('format-modal').classList.add('active');
    } catch (error) {
        console.error('Error duplicating format:', error);
        alert('Failed to duplicate format.');
    }
};

// Delete format
window.deleteFormat = async function(id) {
    if (!confirm('Are you sure you want to delete this format? This cannot be undone.')) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('platform_formats')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Format deleted successfully!');
        await loadFormats();
    } catch (error) {
        console.error('Error deleting format:', error);
        alert('Failed to delete format: ' + error.message);
    }
};

// Save format
async function saveFormat(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        // Parse JSON fields
        let safeZone = null;
        let dangerZones = null;

        const safeZoneText = document.getElementById('safe-zone').value.trim();
        if (safeZoneText) {
            safeZone = JSON.parse(safeZoneText);
        }

        const dangerZonesText = document.getElementById('danger-zones').value.trim();
        if (dangerZonesText) {
            dangerZones = JSON.parse(dangerZonesText);
        }

        const formatData = {
            platform: document.getElementById('platform').value.trim(),
            format_name: document.getElementById('format-name').value.trim(),
            width: parseInt(document.getElementById('width').value),
            height: parseInt(document.getElementById('height').value),
            description: document.getElementById('description').value.trim() || null,
            reference_link: document.getElementById('reference-link').value.trim() || null,
            sort_order: parseInt(document.getElementById('sort-order').value) || 0,
            aspect_ratio: document.getElementById('aspect-ratio').value.trim() || null,
            
            // Image specs
            file_formats: fileFormatTags.length > 0 ? fileFormatTags : null,
            max_file_size: document.getElementById('max-file-size').value.trim() || null,
            
            // Video specs
            video_file_formats: videoFileFormatTags.length > 0 ? videoFileFormatTags : null,
            duration_limit: document.getElementById('duration-limit').value.trim() || null,
            frame_rate: document.getElementById('frame-rate').value.trim() || null,
            codec: document.getElementById('codec').value.trim() || null,
            audio_format: document.getElementById('audio-format').value.trim() || null,
            
            special_requirements: document.getElementById('special-requirements').value.trim() || null,
            safe_zone: safeZone,
            danger_zones: dangerZones,
            active: document.getElementById('active').checked
        };

        let error;
        if (currentEditingId) {
            // Update existing
            ({ error } = await supabaseClient
                .from('platform_formats')
                .update(formatData)
                .eq('id', currentEditingId));
        } else {
            // Insert new
            ({ error } = await supabaseClient
                .from('platform_formats')
                .insert(formatData));
        }

        if (error) throw error;

        alert('Format saved successfully!');
        closeModal();
        await loadFormats();
    } catch (error) {
        console.error('Error saving format:', error);
        alert('Failed to save format: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Format';
    }
}

// Close modal
function closeModal() {
    document.getElementById('format-modal').classList.remove('active');
    currentEditingId = null;
    fileFormatTags = [];
    videoFileFormatTags = [];
}

// Helper function
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
