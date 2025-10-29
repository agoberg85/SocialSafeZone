// campaigns.js - Campaigns page with landing view for non-Studio users

// Global variables
const supabaseClient = window.app.supabaseClient;
let currentUserId = null;
let userTier = null;

// ===== TIER CHECK AND VIEW CONTROL =====
document.addEventListener('DOMContentLoaded', async () => {
    const landingView = document.getElementById('landing-view');
    const campaignView = document.getElementById('campaign-view');
    const heroCta = document.getElementById('hero-cta');
    const upgradeSection = document.getElementById('upgrade-section');

    // Check user session and tier
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Not logged in - show landing page with signup CTA
        showLandingView(landingView, campaignView, heroCta, upgradeSection, null);
        return;
    }

    currentUserId = session.user.id;

    // Load user profile
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('subscription_status')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) {
        console.error('Error loading profile:', error);
        alert('Error loading your profile. Please refresh the page.');
        return;
    }

    userTier = (profile.subscription_status || 'FREE').toLowerCase();  // ✅ Convert to lowercase


    // ===== 🔧 TESTING MODE - Uncomment to test Studio features =====
    // userTier = 'studio';  // Force Studio access for testing
    // console.log('⚠️ TESTING MODE: Acting as Studio user');
    // ============================================================

    if (userTier === 'studio') {  // ✅ Compare with lowercase
        // Studio user
        showCampaignView(landingView, campaignView);
        loadCampaigns();
        setupEventListeners();
    } else {
        // Free or Pro user
        showLandingView(landingView, campaignView, heroCta, upgradeSection, userTier);
    }
});

// Show landing view (for non-Studio users)
function showLandingView(landingView, campaignView, heroCta, upgradeSection, tier) {
    // ✅ Hide loading state
    const authLoading = document.getElementById('auth-loading');
    if (authLoading) authLoading.style.display = 'none';
    
    landingView.style.display = 'block';
    campaignView.style.display = 'none';
    
    if (!tier) {
        // Not logged in
        heroCta.innerHTML = `
            <a href="login.html" class="btn btn-primary">Get Started</a>
        `;
        if (upgradeSection) upgradeSection.style.display = 'none';
    } else {
        // Free or Pro user
        heroCta.innerHTML = `
            <a href="pricing.html" class="btn btn-primary">Upgrade to Studio</a>
        `;
        if (upgradeSection) upgradeSection.style.display = 'block';
    }
}

// Show campaign view (for Studio users)
function showCampaignView(landingView, campaignView) {
    // ✅ Hide loading state
    const authLoading = document.getElementById('auth-loading');
    if (authLoading) authLoading.style.display = 'none';
    
    landingView.style.display = 'none';
    campaignView.style.display = 'block';
}

// ===== CAMPAIGN FUNCTIONS (Only run for Studio users) =====

async function loadCampaigns() {
    const { data: campaigns, error } = await supabaseClient
        .from('campaigns')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading campaigns:', error);
        alert('Failed to load campaigns. Please refresh the page.');
        return;
    }

    renderCampaigns(campaigns);
}

function renderCampaigns(campaigns) {
    const campaignsList = document.getElementById('campaigns-list');
    const campaignsEmpty = document.getElementById('campaigns-empty');

    if (!campaigns || campaigns.length === 0) {
        // No campaigns - show empty state
        campaignsList.innerHTML = '';
        campaignsList.style.display = 'none';  // ✅ Add this
        campaignsEmpty.classList.remove('hidden');
        campaignsEmpty.style.display = 'block';  // ✅ Add this
        return;
    }

    // Has campaigns - show list
    campaignsEmpty.classList.add('hidden');
    campaignsEmpty.style.display = 'none';  // ✅ Add this
    campaignsList.style.display = 'grid';  // ✅ Add this
    campaignsList.innerHTML = campaigns.map(campaign => createCampaignCard(campaign)).join('');
}

function createCampaignCard(campaign) {
    const createdDate = new Date(campaign.created_at).toLocaleDateString();
    
    return `
        <div class="campaigns-card" onclick="window.location.href='campaign-detail.html?id=${campaign.id}'">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 1.25rem; color: #1f2937;">${escapeHtml(campaign.name)}</h3>
                <button onclick="event.stopPropagation(); deleteCampaign('${campaign.id}')" class="btn btn-danger"><span class="material-icons" style="vertical-align: middle; font-size: 1.2rem; margin-right: 0.5rem;">delete</span> Delete</button>
            </div>
            ${campaign.client_name ? `<p style="margin: 5px 0; color: #6b7280; font-size: 0.95rem;">Client: ${escapeHtml(campaign.client_name)}</p>` : ''}
            ${campaign.description ? `<p style="margin: 10px 0; color: #6b7280;">${escapeHtml(campaign.description)}</p>` : ''}
            <p style="margin: 10px 0 0 0; font-size: 0.875rem; color: #9ca3af;">Created ${createdDate}</p>
        </div>
    `;
}

function setupEventListeners() {
    const newCampaignBtn = document.getElementById('new-campaign-btn');
    if (newCampaignBtn) {
        newCampaignBtn.addEventListener('click', showNewCampaignModal);
    }
}

function showNewCampaignModal() {
    // Your existing modal code
    const modalHtml = `
        <div id="new-campaign-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: white; border-radius: 12px; padding: 30px; max-width: 500px; width: 90%;">
                <h2 style="margin-top: 0;">Create New Campaign</h2>
                <form id="new-campaign-form">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500;">Campaign Name *</label>
                        <input type="text" id="campaign-name" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500;">Client Name</label>
                        <input type="text" id="client-name" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500;">Description</label>
                        <textarea id="campaign-description" rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;"></textarea>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" onclick="document.getElementById('new-campaign-modal').remove()" class="btn" style="background: #f3f4f6; color: #374151;">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Campaign</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('new-campaign-form').addEventListener('submit', createCampaign);
}

async function createCampaign(e) {
    e.preventDefault();
    
    const name = document.getElementById('campaign-name').value.trim();
    const clientName = document.getElementById('client-name').value.trim();
    const description = document.getElementById('campaign-description').value.trim();
    
    const { data, error } = await supabaseClient
        .from('campaigns')
        .insert([{
            user_id: currentUserId,
            name: name,
            client_name: clientName || null,
            description: description || null
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating campaign:', error);
        alert('Failed to create campaign. Please try again.');
        return;
    }
    
    document.getElementById('new-campaign-modal').remove();
    window.location.href = `campaign-detail.html?id=${data.id}`;
}

async function deleteCampaign(campaignId) {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) {
        return;
    }
    
    const { error } = await supabaseClient
        .from('campaigns')
        .delete()
        .eq('id', campaignId);
    
    if (error) {
        console.error('Error deleting campaign:', error);
        alert('Failed to delete campaign. Please try again.');
        return;
    }
    
    loadCampaigns();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
