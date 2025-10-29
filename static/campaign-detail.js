// static/campaign-detail.js
document.addEventListener('DOMContentLoaded', async () => {
    const supabaseClient = window.app.supabaseClient;

    // Check if user is logged in
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // Get campaign ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const campaignId = urlParams.get('id');

    if (!campaignId) {
        alert('No campaign ID provided');
        window.location.href = 'campaigns.html';
        return;
    }

    // DOM Elements
    const loadingState = document.getElementById('loading-state');
    const campaignHeader = document.getElementById('campaign-header');
    const campaignContent = document.getElementById('campaign-content');
    const campaignName = document.getElementById('campaign-name');
    const campaignClient = document.getElementById('campaign-client');
    const campaignDescription = document.getElementById('campaign-description');
    const platformSelect = document.getElementById('platform-select');
    const formatSelect = document.getElementById('format-select');
    const creativeNameInput = document.getElementById('creative-name-input');
    const creativeDescInput = document.getElementById('creative-description-input');        
    const creativeTypeSelect = document.getElementById('creative-type-select');
    const addFormatBtn = document.getElementById('add-format-btn');
    const formatsEmpty = document.getElementById('formats-empty');
    const formatsGrid = document.getElementById('formats-grid');
    const formatCount = document.getElementById('format-count');
    const customFormatContainer = document.getElementById('custom-format-container');
    const formatSelectContainer = document.getElementById('format-select-container');
    const customFormatName = document.getElementById('custom-format-name');
    const customWidth = document.getElementById('custom-width');
    const customHeight = document.getElementById('custom-height');
    const durationField = document.getElementById('duration-field');
    const durationInput = document.getElementById('creative-duration'); 
    

    // State
    let campaign = null;
    let safeZones = {};
    let selectedFormats = [];
    let lastCustomFormat = null;

    // Load everything
    await Promise.all([
        loadCampaign(),
        loadSafeZones(),
        loadCampaignFormats()
    ]);

    // Load campaign details
    async function loadCampaign() {
        try {
            const { data: campaignData, error: campaignError } = await supabaseClient
                .from('campaigns')
                .select('*') // This gets all fields including share_token, share_enabled, etc.
                .eq('id', campaignId)
                .single();
    
            if (campaignError) throw campaignError;  // ✅ Use campaignError
            
            if (!campaignData) {
                alert('Campaign not found');
                window.location.href = 'campaigns.html';
                return;
            }
    
            campaign = campaignData;  // ✅ Use campaignData
    
            // Display campaign details
            campaignName.textContent = campaign.name;
            campaignClient.textContent = campaign.client_name ? `Client: ${campaign.client_name}` : '';
            campaignDescription.textContent = campaign.description || 'No description';
    
            // Show content
            loadingState.style.display = 'none';
            campaignHeader.classList.remove('hidden');
            campaignContent.classList.remove('hidden');
    
        } catch (err) {  // ✅ Use 'err' instead of 'error'
            console.error('Error loading campaign:', err);
            alert('Failed to load campaign');
            window.location.href = 'campaigns.html';
        }
    }

    // Load safe zones data from Supabase
    async function loadSafeZones() {
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
                    // ✅ ADD THESE MISSING FIELDS:
                    safeZone: format.safe_zone,           // This was missing!
                    dangerZones: format.danger_zones,     // This was missing!
                    aspectRatio: format.aspect_ratio,
                    description: format.description,
                    fileFormats: format.file_formats,
                    maxFileSize: format.max_file_size,
                    videoFileFormats: format.video_file_formats,
                    durationLimit: format.duration_limit,
                    frameRate: format.frame_rate,
                    codec: format.codec,
                    audioFormat: format.audio_format,
                    referenceLink: format.reference_link
                };
            });

            console.log('Loaded', data.length, 'formats from Supabase');

            // Populate platform dropdown
            Object.keys(safeZones).forEach(platform => {
                const option = document.createElement('option');
                option.value = platform;
                option.textContent = platform;
                platformSelect.appendChild(option);
            });

            // Render formats if they're already loaded
            if (selectedFormats.length > 0) {
                renderFormats();
            }
        } catch (err) {
            console.error('Error loading safe zones:', err);
        }
    }

    function hasSafeZoneData(creative) {
        // Custom formats never have safe zones
        if (creative.is_custom) return false;
        
        // Check if format has safe zone data
        const formatData = safeZones[creative.platform]?.[creative.format];
        return formatData && (formatData.safeZone || formatData.dangerZones);
    }

    if (creativeTypeSelect && durationField) {
        creativeTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'video') {
                durationField.style.display = 'block';
            } else {
                durationField.style.display = 'none';
                durationInput.value = '';
            }
        });
    }

    // Load existing campaign formats
    async function loadCampaignFormats() {
        try {
            const { data, error } = await supabaseClient
                .from('campaign_formats')
                .select('*')
                .eq('campaign_id', campaignId)
                .order('created_at');
    
            if (error) throw error;
    
            selectedFormats = data || [];
            
            // ✅ Only render if safeZones is already loaded
            if (Object.keys(safeZones).length > 0) {
                renderFormats();
            }
        } catch (err) {
            console.error('Error loading formats:', err);
        }
    }

    // ✅ Input validation for ALL inputs (both custom and standard)
    creativeNameInput.addEventListener('input', validateAndEnableButton);
    customFormatName.addEventListener('input', validateAndEnableButton);
    customWidth.addEventListener('input', validateAndEnableButton);
    customHeight.addEventListener('input', validateAndEnableButton);

    // Combined validation function
    function validateAndEnableButton() {
        const platform = platformSelect.value;
        
        // ✅ Check if any custom-type platform is selected
        const isCustomType = ['__CUSTOM__', '__OOH__', '__DISPLAY__', '__PRINT__'].includes(platform);
        
        if (isCustomType) {
            // Custom format validation
            const hasFormatName = customFormatName.value.trim().length > 0;
            const hasWidth = customWidth.value && parseInt(customWidth.value) > 0;
            const hasHeight = customHeight.value && parseInt(customHeight.value) > 0;
            const hasCreativeName = creativeNameInput.value.trim().length > 0;
            
            // Enable creative inputs if format details are filled
            if (hasFormatName && hasWidth && hasHeight) {
                creativeNameInput.disabled = false;
                creativeDescInput.disabled = false;
                creativeTypeSelect.disabled = false;
            }
            
            // Enable button only if everything is filled
            const isValid = hasFormatName && hasWidth && hasHeight && hasCreativeName;
            addFormatBtn.disabled = !isValid;
            
        } else {
            // Standard format validation (existing logic)
            checkAddButtonState();
        }
    }
    
    if (creativeTypeSelect && durationField) {
        creativeTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'video') {
                durationField.style.display = 'block';
                durationInput.required = true;
            } else {
                durationField.style.display = 'none';
                durationInput.required = false;
                durationInput.value = '';
            }
        });
    }

    // Platform selection changed
    platformSelect.addEventListener('change', (e) => {
        const platform = e.target.value;
        
        // Reset everything
        formatSelect.innerHTML = '<option value="">Select format...</option>';
        formatSelect.disabled = true;
        creativeNameInput.disabled = true;
        creativeDescInput.disabled = true;
        creativeTypeSelect.disabled = true;
        addFormatBtn.disabled = true;
    
        // Check if custom-type platform selected (treat like custom format)
        if (platform === '__CUSTOM__' || platform === '__OOH__' || platform === '__DISPLAY__' || platform === '__PRINT__') {
            // Show custom inputs, hide format dropdown
            customFormatContainer.style.display = 'block';
            formatSelectContainer.style.display = 'none';
            
            // Clear custom inputs
            customFormatName.value = '';
            customWidth.value = '';
            customHeight.value = '';
            
            // Set default format name based on type
            if (platform === '__OOH__') {
                customFormatName.placeholder = 'e.g., Billboard - Highway 405, Transit Shelter';
            } else if (platform === '__DISPLAY__') {
                customFormatName.placeholder = 'e.g., Leaderboard, Medium Rectangle, Skyscraper';
            } else if (platform === '__PRINT__') {
                customFormatName.placeholder = 'e.g., Magazine Full Page, Newspaper Half Page';
            } else {
                customFormatName.placeholder = 'e.g., Custom Format Name';
            }
            
            return;
        }
    
        // Hide custom inputs, show format dropdown
        customFormatContainer.style.display = 'none';
        formatSelectContainer.style.display = 'block';
    
        if (platform && safeZones[platform]) {
            // Populate formats for selected platform
            Object.keys(safeZones[platform]).forEach(format => {
                const option = document.createElement('option');
                option.value = format;
                option.textContent = format;
                formatSelect.appendChild(option);
            });
            formatSelect.disabled = false;
        }
    });
    
    

    // Format selection changed
    formatSelect.addEventListener('change', (e) => {
        const platform = platformSelect.value;
        const format = e.target.value;
    
        if (platform && format) {
            const formatData = safeZones[platform][format];
            
            // ✅ Enable creative name/description inputs
            creativeNameInput.disabled = false;
            creativeDescInput.disabled = false;
            creativeTypeSelect.disabled = false;
            
            // Check if creative name is filled to enable add button
            checkAddButtonState();
        } else {
            creativeNameInput.disabled = true;
            creativeDescInput.disabled = true;
            addFormatBtn.disabled = true;
            creativeTypeSelect.disabled = true;
            creativeTypeSelect.value = 'image';            
            
        }
    });

    // ✅ Creative name input validation
    creativeNameInput.addEventListener('input', () => {
        checkAddButtonState();
    });

    // ✅ Helper function to check if Add button should be enabled
    function checkAddButtonState() {
        const platform = platformSelect.value;
        
        // ✅ Skip validation for all custom-type platforms
        const isCustomType = ['__CUSTOM__', '__OOH__', '__DISPLAY__', '__PRINT__'].includes(platform);
        if (isCustomType) {
            return;
        }
        
        const format = formatSelect.value;
        const creativeName = creativeNameInput.value.trim();
        
        // Enable button only if platform, format, and creative name are filled
        addFormatBtn.disabled = !(platform && format && creativeName);
    }

    // Add format to campaign
    addFormatBtn.addEventListener('click', async () => {
        try {
            const platform = platformSelect.value;
            const creativeName = creativeNameInput.value.trim();
            const creativeDesc = creativeDescInput.value.trim();
            const creativeType = creativeTypeSelect.value;
    
            if (!platform || !creativeName) {
                alert('⚠️ Please fill in all required fields');
                return;
            }
    
            let format, isCustom, customWidthVal, customHeightVal;
    
            // Check if custom-type platform
            const isCustomType = ['__CUSTOM__', '__OOH__', '__DISPLAY__', '__PRINT__'].includes(platform);
    
            if (isCustomType) {
                isCustom = true;
                format = customFormatName.value.trim();
                customWidthVal = parseInt(customWidth.value);
                customHeightVal = parseInt(customHeight.value);
    
                if (!format || !customWidthVal || !customHeightVal) {
                    alert('⚠️ Please fill in all custom format fields');
                    return;
                }
            } else {
                isCustom = false;
                format = formatSelect.value;
                
                if (!format) {
                    alert('⚠️ Please select a format');
                    return;
                }
            }
    
            // Map platform names
            let finalPlatform = platform;
            if (isCustom) {
                const platformNames = {
                    '__CUSTOM__': 'Custom',
                    '__OOH__': 'Out-of-Home',
                    '__DISPLAY__': 'Display',
                    '__PRINT__': 'Print'
                };
                finalPlatform = platformNames[platform];
            }
    
            // Check if this exact creative already exists
            const exists = selectedFormats.some(f => 
                f.platform === finalPlatform && 
                f.format === format && 
                f.creative_name === creativeName
            );
    
            if (exists) {
                alert('⚠️ A creative with this name already exists for this format.');
                return;
            }
    
            const insertData = {
                campaign_id: campaignId,
                platform: finalPlatform,
                format: format,
                creative_name: creativeName,
                creative_description: creativeDesc || null,
                creative_type: creativeType,
                is_custom: isCustom,
                duration: creativeType === 'video' ? document.getElementById('creative-duration').value.trim() || null : null
            };
    
            if (isCustom) {
                insertData.custom_width = customWidthVal;
                insertData.custom_height = customHeightVal;
            }
    
            const { data, error } = await supabaseClient
                .from('campaign_formats')
                .insert(insertData)
                .select()
                .single();
    
            if (error) throw error;
    
            // Add to local state
            selectedFormats.push(data);
            renderFormats();
    
            // Reset form
            platformSelect.value = '';
            formatSelect.innerHTML = '<option value="">Select format...</option>';
            formatSelect.disabled = true;
            customFormatContainer.style.display = 'none';
            formatSelectContainer.style.display = 'block';
            customFormatName.value = '';
            customWidth.value = '';
            customHeight.value = '';
            creativeNameInput.value = '';
            creativeNameInput.disabled = true;
            creativeDescInput.value = '';
            creativeDescInput.disabled = true;
            creativeTypeSelect.value = 'image';
            creativeTypeSelect.disabled = true;
            addFormatBtn.disabled = true;
    
            alert('✅ Creative added to campaign!');
    
        } catch (error) {
            console.error('Error adding format:', error);
            alert('❌ Failed to add creative: ' + error.message);
        }
    });
    
    
    // Render formats grid
    function renderFormats() {
        formatCount.textContent = selectedFormats.length;
    
        if (selectedFormats.length === 0) {
            formatsEmpty.style.display = 'block';
            formatsGrid.style.display = 'none';
            formatsGrid.innerHTML = '';
            return;
        }
    
        formatsEmpty.style.display = 'none';
        formatsGrid.style.display = 'grid';
    
        // ✅ Group formats by platform + format + dimensions (for custom formats)
        const grouped = {};
        selectedFormats.forEach(format => {
            // For custom formats, include dimensions in the grouping key
            const dimensionKey = format.is_custom 
                ? `|||${format.custom_width}x${format.custom_height}`
                : '';
            
            const key = `${format.platform}|||${format.format}${dimensionKey}`;
            
            if (!grouped[key]) {
                grouped[key] = {
                    platform: format.platform,
                    format: format.format,
                    creatives: []
                };
            }
            grouped[key].creatives.push(format);
        });
    
        // Render grouped format cards
        formatsGrid.innerHTML = Object.values(grouped).map(group => {
            // ✅ More robust formatData lookup with debugging
            let formatData = null;
            
            // Only try to get formatData for non-custom formats
            if (!group.creatives[0].is_custom) {
                // Check if safeZones has this platform
                if (safeZones[group.platform]) {
                    formatData = safeZones[group.platform][group.format];
                    
                    // Debug: log if not found
                    if (!formatData) {
                        console.warn(`Format data not found for: ${group.platform} - ${group.format}`);
                        console.log('Available formats for this platform:', Object.keys(safeZones[group.platform]));
                    }
                } else {
                    console.warn(`Platform not found in safeZones: ${group.platform}`);
                    console.log('Available platforms:', Object.keys(safeZones));
                }
            }
    
            // ✅ Handle dimensions
            let dimensions;
            if (group.creatives[0].is_custom) {
                dimensions = `${group.creatives[0].custom_width} × ${group.creatives[0].custom_height}px`;
            } else if (formatData) {
                dimensions = `${formatData.width} × ${formatData.height}px`;
            } else {
                // Fallback: check if any creative has stored width/height
                const firstCreative = group.creatives[0];
                if (firstCreative.custom_width && firstCreative.custom_height) {
                    dimensions = `${firstCreative.custom_width} × ${firstCreative.custom_height}px`;
                } else {
                    dimensions = 'Dimensions not available';
                }
            }
    
            return `
                <div class="formats-card">
                    <!-- Format Header -->
                    <div style="margin-bottom: 15px;">
                        ${group.platform === 'Custom' 
                            ? `<h4 style="margin: 0 0 5px 0; color: #333; font-size: 14px; font-weight: 600;">${escapeHtml(group.format)} <span style="font-size:0.7em">Custom</span></h4>`
                            : `<h4 style="margin: 0 0 5px 0; color: #333; font-size: 14px; font-weight: 600;">${escapeHtml(group.platform)} ${escapeHtml(group.format)}</h4>`
                        }
                        <p style="margin: 0; font-size: 12px; color: #999;">${dimensions}</p>
                    </div>
    
                    <!-- Creatives List -->
                    <div class="creative-grid">
                        ${group.creatives.map(creative => {
                            const typeEmojis = { 
                                image: 'Image', 
                                video: 'Video', 
                                other: 'Other'
                            };
                            const typeEmoji = typeEmojis[creative.creative_type || 'image'];
                            
                            return `
                            <div class="creative-card">
                                <div style="flex: 1;">
                                    <div>
                                        ${escapeHtml(creative.creative_name)}
                                        <span class="badge-tag">${typeEmoji}</span>
                                        ${creative.duration ? `<span class="badge-tag">${escapeHtml(creative.duration)}</span>` : ''}
                                    </div>
                                    ${creative.creative_description ? `
                                        <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">
                                            ${escapeHtml(creative.creative_description)}
                                        </p>
                                    ` : ''}
                                    
                                    <!-- Show if media planning data exists -->
                                    ${(creative.placement || creative.budget || creative.start_date) ? `
                                        <p style="margin: 5px 0 0 0; font-size: 11px; color: #999; font-style: italic;">
                                            <span class="material-icons" style="vertical-align: middle; font-size: 1rem;">calendar_month</span> Has media planning data
                                        </p>
                                    ` : ''}
                                </div>
                                
                                <!-- Action Buttons -->
                                <div style="display: flex; gap: 6px; padding-top: 8px;">
                                    <button onclick="openCreativeModal('${creative.id}', 'edit')" class="btn btn-square" title="Edit creative details">
                                        <span class="material-icons" style="vertical-align: middle; font-size: 15px;">edit</span>
                                    </button>                                
                                    <button onclick="openCreativeModal('${creative.id}', 'planning')" class="btn btn-square" title="Edit media planning details">
                                        <span class="material-icons" style="vertical-align: middle; font-size: 15px;">calendar_month</span>
                                    </button>
                                    
                                    <button onclick="openCreativeModal('${creative.id}', 'specs')" class="btn btn-square" title="View file specifications">
                                        <span class="material-icons" style="vertical-align: middle; font-size: 15px;">article</span>
                                    </button>
                                    
                                    ${hasSafeZoneData(creative) ? `
                                        <button onclick="openCreativeModal('${creative.id}', 'safezone')" class="btn btn-square" title="Test in safe zone tool">
                                            <span class="material-icons" style="vertical-align: middle; font-size: 15px;">center_focus_strong</span>
                                        </button>
                                    ` : ''}
                                    
                                    <button onclick="event.stopPropagation(); removeFormat('${creative.id}')" class="btn btn-square btn-danger" title="Remove creative" style="margin-left:auto;">
                                        <span class="material-icons" style="vertical-align: middle; font-size: 15px;">close</span>
                                    </button>
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
    
                    <!-- Add More Button -->
                    <button 
                        onclick="quickAddCreative('${escapeHtml(group.platform)}', '${escapeHtml(group.format)}', ${group.creatives[0].is_custom}, ${group.creatives[0].custom_width || 0}, ${group.creatives[0].custom_height || 0})"
                        class="btn" 
                        style="width: 100%; margin-top: 10px; font-size: 12px; padding: 8px; background: #f5f5f5; color: #666;"
                    >
                        + Add Another Creative
                    </button>
                </div>
            `;
        }).join('');
        updateCampaignSummary();
    }
    

    function updateCampaignSummary() {
        const summaryContainer = document.getElementById('campaign-summary');
        
        // ✅ ADD THIS CHECK
        if (!summaryContainer) {
            console.warn('Campaign summary container not found');
            return;
        }
        
        if (selectedFormats.length === 0) {
            summaryContainer.style.display = 'none';
            return;
        }
        
        // Calculate totals
        let totalBudget = 0;
        let totalImpressions = 0;
        let totalReach = 0;
        let earliestDate = null;
        let latestDate = null;
        let hasAnyData = false;
        
        selectedFormats.forEach(format => {
            if (format.budget) {
                totalBudget += parseFloat(format.budget);
                hasAnyData = true;
            }
            if (format.impressions) {
                totalImpressions += parseInt(format.impressions);
                hasAnyData = true;
            }
            if (format.reach) {
                totalReach += parseInt(format.reach);
                hasAnyData = true;
            }
            
            // Track earliest and latest dates
            if (format.start_date) {
                const startDate = new Date(format.start_date);
                if (!earliestDate || startDate < earliestDate) {
                    earliestDate = startDate;
                }
            }
            if (format.end_date) {
                const endDate = new Date(format.end_date);
                if (!latestDate || endDate > latestDate) {
                    latestDate = endDate;
                }
            }
        });
        
        // Show/hide summary based on whether we have data
        if (hasAnyData || earliestDate || latestDate) {
            summaryContainer.style.display = 'block';
            
            // Update budget
            document.getElementById('summary-budget').textContent = 
                totalBudget > 0 ? `kr ${totalBudget.toLocaleString()}` : '-';
            
            // Update period
            let periodText = '-';
            if (earliestDate && latestDate) {
                const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                periodText = `${formatDate(earliestDate)} - ${formatDate(latestDate)}`;
            } else if (earliestDate) {
                periodText = `From ${earliestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            } else if (latestDate) {
                periodText = `Until ${latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
            document.getElementById('summary-period').textContent = periodText;
            
            // Update impressions
            document.getElementById('summary-impressions').textContent = 
                totalImpressions > 0 ? totalImpressions.toLocaleString() : '-';
            
            // Update reach
            document.getElementById('summary-reach').textContent = 
                totalReach > 0 ? totalReach.toLocaleString() : '-';
        } else {
            summaryContainer.style.display = 'none';
        }
    }
    


// Quick add creative - pre-fills form with same platform/format
window.quickAddCreative = function(platform, format, isCustom, widthValue, heightValue) {  // ✅ Renamed parameters
    // Scroll to form
    
    // Pre-fill platform
    if (isCustom) {
        // Map back to the __ values
        const platformMap = {
            'Custom': '__CUSTOM__',
            'Out-of-Home': '__OOH__',
            'Display': '__DISPLAY__',
            'Print': '__PRINT__'
        };
        platformSelect.value = platformMap[platform] || '__CUSTOM__';
        
        // Trigger change to show custom fields
        platformSelect.dispatchEvent(new Event('change'));
        
        // Pre-fill custom format details
        setTimeout(() => {
            customFormatName.value = format;
            customWidth.value = widthValue;      // ✅ Now uses the parameter value
            customHeight.value = heightValue;    // ✅ Now uses the parameter value
            
            // Enable fields
            customFormatName.disabled = false;
            customWidth.disabled = false;
            customHeight.disabled = false;
            creativeNameInput.disabled = false;
            creativeDescInput.disabled = false;
            creativeTypeSelect.disabled = false;
            addFormatBtn.disabled = false;
            
            // Focus creative name
            creativeNameInput.focus();
        }, 100);
        
    } else {
        // Standard platform
        platformSelect.value = platform;
        
        // Trigger change to populate formats
        platformSelect.dispatchEvent(new Event('change'));
        
        // Pre-select format after formats load
        setTimeout(() => {
            formatSelect.value = format;
            
            // Trigger change to enable creative fields
            formatSelect.dispatchEvent(new Event('change'));
            
            // Focus creative name
            setTimeout(() => {
                creativeNameInput.focus();
            }, 100);
        }, 100);
    }
};

    
    
    


    // Remove format (global function for onclick)
    window.removeFormat = async function(formatId) {
        if (!confirm('Remove this format from the campaign?')) {
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('campaign_formats')
                .delete()
                .eq('id', formatId);

            if (error) throw error;

            // Remove from local state
            selectedFormats = selectedFormats.filter(f => f.id !== formatId);
            renderFormats();

        } catch (error) {
            console.error('Error removing format:', error);
            alert('Failed to remove format. Please try again.');
        }
    };

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

    // Generate Spec Sheet button
    const generateSpecBtn = document.getElementById('generate-spec-btn');
    
    generateSpecBtn.addEventListener('click', async () => {
        if (selectedFormats.length === 0) {
            alert('⚠️ Add at least one format to generate a spec sheet');
            return;
        }

        try {
            generateSpecBtn.disabled = true;
            generateSpecBtn.textContent = '⏳ Generating...';
            
            await generateSpecSheet();
            
            generateSpecBtn.disabled = false;
            generateSpecBtn.textContent = '📄 Generate Spec Sheet';
        } catch (error) {
            console.error('Error generating spec sheet:', error);
            alert('Failed to generate spec sheet. Please try again.');
            generateSpecBtn.disabled = false;
            generateSpecBtn.textContent = '📄 Generate Spec Sheet';
        }
    });

    // Generate PDF Spec Sheet
    async function fetchFormatSpecs(platform, formatName) {
        try {
            const { data, error } = await supabaseClient
                .from('platform_formats')
                .select('*')
                .eq('platform', platform)
                .eq('format_name', formatName)
                .maybeSingle();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching format specs:', error);
            return null;
        }
    }    
    // Generate PDF Spec Sheet - Streamlined Version
    async function generateSpecSheet() {
        await CampaignPDF.generate(campaign, selectedFormats, supabaseClient);
    }


    

// ========== CREATIVE MODAL FUNCTIONS ==========

let currentEditingCreativeId = null;
let currentModalTab = 'planning';
let currentCreativeFormatData = null;

// Open creative modal
window.openCreativeModal = async function(creativeId, tab = 'edit') {
    const creative = selectedFormats.find(f => f.id === creativeId);
    if (!creative) return;

    currentEditingCreativeId = creativeId;
    currentModalTab = tab;

    // Update modal title
    document.getElementById('modal-creative-title').textContent = creative.creative_name;

    // Populate EDIT tab
    const formatDisplay = creative.is_custom 
        ? `${creative.format} (Custom - ${creative.custom_width}×${creative.custom_height}px)`
        : `${creative.platform} - ${creative.format}`;
    
    document.getElementById('edit-format-display').textContent = formatDisplay;
    document.getElementById('edit-creative-name').value = creative.creative_name || '';
    document.getElementById('edit-creative-description').value = creative.creative_description || '';
    document.getElementById('edit-creative-type').value = creative.creative_type || 'image';
    document.getElementById('edit-creative-duration').value = creative.duration || '';

    // Populate PLANNING tab (media planning data only)
    document.getElementById('modal-placement').value = creative.placement || '';
    document.getElementById('modal-start-date').value = creative.start_date || '';
    document.getElementById('modal-end-date').value = creative.end_date || '';
    document.getElementById('modal-budget').value = creative.budget || '';
    document.getElementById('modal-impressions').value = creative.impressions || '';
    document.getElementById('modal-reach').value = creative.reach || '';
    document.getElementById('modal-cpm').value = creative.cpm || '';
    document.getElementById('modal-frequency').value = creative.frequency || '';
    document.getElementById('modal-notes').value = creative.notes || '';

    // ✅ Show/hide Safe Zone tab based on whether format has safe zone data
    const safeZoneTab = document.querySelector('[onclick*="switchTab(\'safezone\')"]');
    if (safeZoneTab) {
        if (hasSafeZoneData(creative)) {
            safeZoneTab.style.display = 'inline-block';
        } else {
            safeZoneTab.style.display = 'none';
            // If user somehow tried to open safezone tab, switch to edit
            if (tab === 'safezone') {
                tab = 'edit';
            }
        }
    }

    // Load file specifications
    await loadFileSpecifications(creative);

    // Switch to requested tab
    switchTab(tab);

    // Show modal
    document.getElementById('edit-creative-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Initialize Safe Zone Test tab if needed
    if (tab === 'safezone') {
        SafeZoneTest.init(creative, safeZones);
    }

    const editTypeSelect = document.getElementById('edit-creative-type');
    const editDurationField = document.getElementById('edit-duration-field');
    
    if (editTypeSelect && editDurationField) {
        editTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'video') {
                editDurationField.style.display = 'block';
            } else {
                editDurationField.style.display = 'none';
                document.getElementById('edit-creative-duration').value = '';
            }
        });
    }
};

// NEW: Save basic edits (name, description, type only)
document.getElementById('edit-creative-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const creative = selectedFormats.find(f => f.id === currentEditingCreativeId);
    if (!creative) return;

    // Only update media planning fields
    const updates = {
        placement: document.getElementById('modal-placement').value.trim() || null,
        start_date: document.getElementById('modal-start-date').value || null,
        end_date: document.getElementById('modal-end-date').value || null,
        budget: document.getElementById('modal-budget').value ? parseFloat(document.getElementById('modal-budget').value) : null,
        impressions: document.getElementById('modal-impressions').value ? parseInt(document.getElementById('modal-impressions').value) : null,
        reach: document.getElementById('modal-reach').value ? parseInt(document.getElementById('modal-reach').value) : null,
        cpm: document.getElementById('modal-cpm').value ? parseFloat(document.getElementById('modal-cpm').value) : null,
        frequency: document.getElementById('modal-frequency').value ? parseFloat(document.getElementById('modal-frequency').value) : null,
        notes: document.getElementById('modal-notes').value.trim() || null
    };

    try {
        const { error } = await supabaseClient
            .from('campaign_formats')
            .update(updates)
            .eq('id', currentEditingCreativeId);

        if (error) throw error;

        Object.assign(creative, updates);

        alert('Planning data updated successfully!');
        closeCreativeModal();
        renderFormats();
    } catch (error) {
        console.error('Error updating planning data:', error);
        alert('Failed to update planning data: ' + error.message);
    }
});

// Tab switching function
window.switchTab = function(tabName) {
    currentModalTab = tabName;

    // Update tab buttons
    const tabs = ['edit', 'planning', 'specs', 'safezone'];
    tabs.forEach(t => {
        const tabBtn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`content-${t}`);
        
        if (t === tabName) {
            tabBtn.classList.add('active');
            content.style.display = 'block';
        } else {
            tabBtn.classList.remove('active');
            content.style.display = 'none';
        }
    });
};

// Load file specifications from database
async function loadFileSpecifications(creative) {
    const container = document.getElementById('file-specs-container');
    
    try {
        // Get format data from Supabase
        const { data, error } = await supabaseClient
            .from('platform_formats')
            .select('*')
            .eq('platform', creative.platform)
            .eq('format_name', creative.format)
            .maybeSingle();

        if (error) throw error;

        // Handle case where no format specs exist
        if (!data) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                    <h4 style="color: #333; margin: 0 0 10px 0;">No File Specifications</h4>
                    <p style="color: #666; margin: 0 0 10px 0;">
                        This format doesn't have detailed file specifications configured yet.
                    </p>
                    <p style="color: #999; font-size: 12px;">
                        Platform: <strong>${escapeHtml(creative.platform)}</strong><br>
                        Format: <strong>${escapeHtml(creative.format)}</strong>
                    </p>
                    ${creative.is_custom ? `
                        <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-radius: 8px;">
                            <p style="margin: 0; color: #92400e; font-size: 13px;">
                                📝 This is a custom format (${creative.custom_width}×${creative.custom_height}px)
                            </p>
                        </div>
                    ` : ''}
                </div>
            `;
            return;
        }

        currentCreativeFormatData = data;
        const creativeType = creative.creative_type || 'image';

        // Render file specifications based on creative type
        container.innerHTML = `
            <!-- Base Format Info (always shown) -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">
                    ${escapeHtml(creative.platform)} - ${escapeHtml(creative.format)}
                </h4>
                <div style="display: grid; gap: 12px;">
                    ${renderSpecRow('Dimensions', `${data.width}×${data.height}px`)}
                    ${data.aspect_ratio ? renderSpecRow('Aspect Ratio', data.aspect_ratio) : ''}
                </div>
            </div>

            <!-- Image Specifications (only for image type) -->
            ${creativeType === 'image' && (data.file_formats || data.max_file_size) ? `
                <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">📷 Image Specifications</h4>
                    <div style="display: grid; gap: 12px;">
                        ${data.file_formats ? renderSpecRow('File Types', data.file_formats.join(', ')) : ''}
                        ${data.max_file_size ? renderSpecRow('Max File Size', data.max_file_size) : ''}
                    </div>
                </div>
            ` : ''}

            <!-- Video Specifications (only for video type) -->
            ${creativeType === 'video' && (data.video_file_formats || data.duration_limit || data.frame_rate || data.codec || data.audio_format) ? `
                <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">🎥 Video Specifications</h4>
                    <div style="display: grid; gap: 12px;">
                        ${data.video_file_formats ? renderSpecRow('File Types', data.video_file_formats.join(', ')) : ''}
                        ${data.duration_limit ? renderSpecRow('Duration', data.duration_limit) : ''}
                        ${data.frame_rate ? renderSpecRow('Frame Rate', data.frame_rate) : ''}
                        ${data.codec ? renderSpecRow('Video Codec', data.codec) : ''}
                        ${data.audio_format ? renderSpecRow('Audio Format', data.audio_format) : ''}
                    </div>
                </div>
            ` : ''}

            <!-- Special Requirements -->
            ${data.special_requirements ? `
                <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">⚠️ Special Requirements</h4>
                    <p style="margin: 0; color: #666; line-height: 1.6;">${escapeHtml(data.special_requirements)}</p>
                </div>
            ` : ''}

            <!-- Reference Link -->
            ${data.reference_link ? `
                <div style="margin-top: 20px; text-align: center;">
                    <a href="${data.reference_link}" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 500;">
                        📖 View Official Platform Documentation →
                    </a>
                </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('Error loading file specs:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
                <p>⚠️ Error loading file specifications</p>
                <p style="font-size: 12px; margin-top: 10px; color: #999;">${error.message}</p>
            </div>
        `;
    }
}

// Save basic creative edits (name, description, type)
window.saveBasicEdits = async function() {
    const creative = selectedFormats.find(f => f.id === currentEditingCreativeId);
    if (!creative) return;

    const updates = {
        creative_name: document.getElementById('edit-creative-name').value.trim(),
        creative_description: document.getElementById('edit-creative-description').value.trim(),
        creative_type: document.getElementById('edit-creative-type').value,
        duration: document.getElementById('edit-creative-type').value === 'video' 
            ? document.getElementById('edit-creative-duration').value.trim() || null 
            : null
    };

    if (!updates.creative_name) {
        alert('Creative name is required');
        return;
    }

    try {
        // Update in database
        const { error } = await supabaseClient
            .from('campaign_formats')
            .update(updates)
            .eq('id', currentEditingCreativeId);

        if (error) throw error;

        // Update local state
        Object.assign(creative, updates);

        alert('Creative updated successfully!');
        closeCreativeModal();
        renderFormats();
        updateCampaignSummary();
    } catch (error) {
        console.error('Error updating creative:', error);
        alert('Failed to update creative: ' + error.message);
    }
};

// Helper function to render spec rows
function renderSpecRow(label, value) {
    return `
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            <span style="font-weight: 500; color: #666; font-size: 14px;">${label}</span>
            <span style="color: #333; font-size: 14px;">${value}</span>
        </div>
    `;
}

// Close creative modal
window.closeCreativeModal = function() {
    SafeZoneTest.cleanup();
    
    // Clean up video element properly
    const video = document.getElementById('safezone-test-video');
    if (video) {
        video.pause();
        video.removeAttribute('src'); // ✅ Use removeAttribute instead of video.src = ''
        video.load(); // Reset the video element
    }
    
    document.getElementById('edit-creative-modal').style.display = 'none';
    document.body.style.overflow = '';
};

// ========== SHARE CAMPAIGN FUNCTIONALITY ==========

// Open share modal
document.getElementById('share-campaign-btn')?.addEventListener('click', async () => {
    // If sharing is not enabled yet, enable it automatically
    if (!campaign.share_enabled) {
        try {
            // Enable sharing and generate token
            const { data, error } = await supabaseClient
                .from('campaigns')
                .update({ share_enabled: true })
                .eq('id', campaignId)
                .select()
                .single();
            
            if (error) throw error;
            
            // Update local campaign object
            campaign = data;
        } catch (err) {
            console.error('Error enabling share:', err);
            alert('Failed to enable sharing: ' + err.message);
            return;
        }
    }
    
    // Show modal
    document.getElementById('share-modal').style.display = 'flex';
    
    // Load share settings (will now show the link)
    await loadShareSettings();
});

// Close share modal
window.closeShareModal = function() {
    document.getElementById('share-modal').style.display = 'none';
};

// Load current share settings
async function loadShareSettings() {
    const shareEnabled = campaign.share_enabled || false;
    const shareToken = campaign.share_token;
    
    // Always check the checkbox if enabled
    document.getElementById('share-enabled-checkbox').checked = shareEnabled;
    
    // If enabled and has token, show the link
    if (shareEnabled && shareToken) {
        const shareUrl = `${window.location.origin}/brief.html?token=${shareToken}`;
        document.getElementById('share-link-url').value = shareUrl;
        document.getElementById('share-link-container').style.display = 'block';
        document.getElementById('share-options').style.display = 'block';
    } else {
        // This should rarely happen now since we auto-enable
        document.getElementById('share-link-container').style.display = 'none';
        document.getElementById('share-options').style.display = 'none';
    }
    
    // Load password and expiry
    document.getElementById('share-password').value = campaign.share_password || '';
    
    // Calculate expiry
    if (campaign.share_expires_at) {
        const expiresAt = new Date(campaign.share_expires_at);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 7) {
            document.getElementById('share-expiry').value = '7';
        } else if (daysUntilExpiry <= 30) {
            document.getElementById('share-expiry').value = '30';
        } else if (daysUntilExpiry <= 90) {
            document.getElementById('share-expiry').value = '90';
        } else {
            document.getElementById('share-expiry').value = '';
        }
    } else {
        document.getElementById('share-expiry').value = '';
    }
}

// Toggle share options visibility
document.getElementById('share-enabled-checkbox')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        // If they check it manually, we need to save first to get a token
        if (!campaign.share_token) {
            alert('Click "Save Settings" to generate a shareable link');
        }
        document.getElementById('share-link-container').style.display = 'block';
        document.getElementById('share-options').style.display = 'block';
    } else {
        document.getElementById('share-link-container').style.display = 'none';
        document.getElementById('share-options').style.display = 'none';
    }
});

// Copy share link
document.getElementById('copy-share-link')?.addEventListener('click', () => {
    const linkInput = document.getElementById('share-link-url');
    linkInput.select();
    document.execCommand('copy');
    
    const btn = document.getElementById('copy-share-link');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.background = '#10b981';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 2000);
});

// Save share settings
document.getElementById('save-share-settings')?.addEventListener('click', async () => {
    const shareEnabled = document.getElementById('share-enabled-checkbox').checked;
    const password = document.getElementById('share-password').value.trim();
    const expiryDays = document.getElementById('share-expiry').value;
    
    let expiresAt = null;
    if (expiryDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiryDays));
    }
    
    try {
        const updates = {
            share_enabled: shareEnabled,
            share_password: password || null,
            share_expires_at: expiresAt
        };
        
        // If enabling for the first time and no token exists, Postgres will generate one
        const { data, error } = await supabaseClient
            .from('campaigns')
            .update(updates)
            .eq('id', campaignId)
            .select()
            .single();
        
        if (error) throw error;
        
        // Update local campaign object
        campaign = data;
        
        alert('Share settings saved successfully!');
        
        // Reload share settings to show the new link
        await loadShareSettings();
        
    } catch (error) {
        console.error('Error saving share settings:', error);
        alert('Failed to save share settings: ' + error.message);
    }
});

// ========== CAMPAIGN MODAL FUNCTIONS ==========

// Open campaign modal
window.openCampaignModal = function() {
    // Populate form with current campaign data
    document.getElementById('modal-campaign-name').value = campaign.name || '';
    document.getElementById('modal-client-name').value = campaign.client_name || '';
    document.getElementById('modal-campaign-description').value = campaign.description || '';
    document.getElementById('modal-campaign-status').value = campaign.status || 'active';
    document.getElementById('modal-campaign-notes').value = campaign.notes || '';

    // Show modal
    document.getElementById('edit-campaign-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
};

// Close campaign modal
window.closeCampaignModal = function() {
    document.getElementById('edit-campaign-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

// Save campaign changes
document.getElementById('edit-campaign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveBtn = document.getElementById('save-campaign-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';

    try {
        const updatedData = {
            name: document.getElementById('modal-campaign-name').value.trim(),
            client_name: document.getElementById('modal-client-name').value.trim() || null,
            description: document.getElementById('modal-campaign-description').value.trim() || null,
            status: document.getElementById('modal-campaign-status').value,
            notes: document.getElementById('modal-campaign-notes').value.trim() || null
        };

        const { error } = await supabaseClient
            .from('campaigns')
            .update(updatedData)
            .eq('id', campaignId);

        if (error) throw error;

        // Update local campaign object
        campaign = { ...campaign, ...updatedData };

        // Update UI
        campaignName.textContent = campaign.name;
        campaignClient.textContent = campaign.client_name ? `Client: ${campaign.client_name}` : '';
        campaignDescription.textContent = campaign.description || 'No description';

        closeCampaignModal();
        alert('✅ Campaign updated successfully!');

    } catch (error) {
        console.error('Error updating campaign:', error);
        alert('❌ Failed to update campaign. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
});

// Close modal when clicking outside
document.getElementById('edit-campaign-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-campaign-modal') {
        closeCampaignModal();
    }
});


// Save creative changes
document.getElementById('edit-creative-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentEditingCreativeId) return;

    const saveBtn = document.getElementById('save-creative-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';

    try {
        const updatedData = {
            creative_name: document.getElementById('modal-creative-name').value.trim(),
            creative_description: document.getElementById('modal-creative-description').value.trim() || null,
            creative_type: document.getElementById('modal-creative-type').value,
            placement: document.getElementById('modal-placement').value.trim() || null,
            start_date: document.getElementById('modal-start-date').value || null,
            end_date: document.getElementById('modal-end-date').value || null,
            budget: document.getElementById('modal-budget').value ? parseFloat(document.getElementById('modal-budget').value) : null,
            impressions: document.getElementById('modal-impressions').value ? parseInt(document.getElementById('modal-impressions').value) : null,
            reach: document.getElementById('modal-reach').value ? parseInt(document.getElementById('modal-reach').value) : null,
            cpm: document.getElementById('modal-cpm').value ? parseFloat(document.getElementById('modal-cpm').value) : null,
            frequency: document.getElementById('modal-frequency').value ? parseFloat(document.getElementById('modal-frequency').value) : null,
            notes: document.getElementById('modal-notes').value.trim() || null
        };

        const { error } = await supabaseClient
            .from('campaign_formats')
            .update(updatedData)
            .eq('id', currentEditingCreativeId);

        if (error) throw error;

        // Update local state
        const index = selectedFormats.findIndex(f => f.id === currentEditingCreativeId);
        if (index !== -1) {
            selectedFormats[index] = { ...selectedFormats[index], ...updatedData };
        }

        // Re-render
        renderFormats();

        // Close modal
        closeCreativeModal();

        alert('✅ Creative updated successfully!');

    } catch (error) {
        console.error('Error updating creative:', error);
        alert('❌ Failed to update creative. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
});

// Close modal when clicking outside
document.getElementById('edit-creative-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-creative-modal') {
        closeCreativeModal();
    }
});



});
