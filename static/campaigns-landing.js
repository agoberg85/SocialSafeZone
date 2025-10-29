// campaigns-landing.js - Landing page logic for campaigns.html

document.addEventListener('DOMContentLoaded', async () => {
    const heroCta = document.getElementById('hero-cta');
    const upgradeSection = document.getElementById('upgrade-section');
    const accessSection = document.getElementById('access-section');

    // Check user session and tier
    const { data: { session } } = await window.app.supabaseClient.auth.getSession();

    if (!session) {
        // Not logged in - show signup CTA
        heroCta.innerHTML = `
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <a href="login.html" class="btn" style="background: white; color: #667eea; padding: 15px 35px; font-size: 1.1rem; border-radius: 8px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                    Sign Up Free
                </a>
                <a href="pricing.html" class="btn" style="background: rgba(255,255,255,0.2); color: white; border: 2px solid white; padding: 15px 35px; font-size: 1.1rem; border-radius: 8px; font-weight: 600; text-decoration: none;">
                    View Pricing
                </a>
            </div>
        `;
        upgradeSection.classList.remove('hidden');
        return;
    }

    // User is logged in - check tier
    const { data: profile, error } = await window.app.supabaseClient
        .from('profiles')
        .select('subscription_tier')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) {
        console.error('Error loading profile:', error);
        return;
    }

    const tier = profile.subscription_tier || 'free';

    if (tier === 'studio') {
        // Studio user - show access
        heroCta.innerHTML = `
            <a href="campaign-dashboard.html" class="btn" style="background: white; color: #667eea; padding: 15px 35px; font-size: 1.1rem; border-radius: 8px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                Go to My Campaigns →
            </a>
        `;
        accessSection.classList.remove('hidden');
    } else {
        // Free or Pro user - show upgrade CTA
        heroCta.innerHTML = `
            <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="font-size: 1rem; margin-bottom: 15px;">
                    ${tier === 'free' ? '🆓 Free users' : '⭐ Pro users'} can view this page, but need <strong>Studio</strong> to build campaigns.
                </p>
                <a href="pricing.html" class="btn" style="background: white; color: #667eea; padding: 12px 30px; font-size: 1rem; border-radius: 8px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                    Upgrade to Studio →
                </a>
            </div>
        `;
        upgradeSection.classList.remove('hidden');
    }
});
