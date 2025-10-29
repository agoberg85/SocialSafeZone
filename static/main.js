// static/main.js

window.app = {};

// These will be populated by Vercel's build step or a local config file
window.app.supabaseClient = supabase.createClient(window.supabaseUrl, window.supabaseKey);

document.addEventListener('DOMContentLoaded', () => {

    const loginButtonNav = document.getElementById('login-button-nav');
    const userMenu = document.getElementById('user-menu');
    const logoutButton = document.getElementById('logout-button');
    const welcomeLink = document.getElementById('welcome-link');
    const goProLink = document.getElementById('go-pro-link');
    const goStudioLink = document.getElementById('go-studio-link');

    const handleAuthStateChange = async (session) => {
        // Only run auth UI logic if the main nav elements exist
        if (loginButtonNav && userMenu) {
            if (session) {
                loginButtonNav.classList.add('hidden');
                userMenu.classList.remove('hidden');
                if (welcomeLink) {
                    welcomeLink.textContent = `Welcome, ${session.user.email.split('@')[0]}!`;
                }

                const { data } = await window.app.supabaseClient
                    .from('profiles')
                    .select('subscription_status, stripe_customer_id')
                    .eq('id', session.user.id)
                    .single();
                
                window.app.userProfile = data;

            } else {
                userMenu.classList.add('hidden');
                loginButtonNav.classList.remove('hidden');
                window.app.userProfile = null;
            }
        }

        // This event should fire regardless of UI, so other scripts can react
        document.dispatchEvent(new Event('profileLoaded'));

        // Handle 'Go Pro' link separately as it might be on pages without the main nav
        if (goProLink) {
            const baseStripeUrl = goProLink.href.split('?')[0];
            if (session) {
                goProLink.href = `${baseStripeUrl}?client_reference_id=${session.user.id}`;
            } else {
                goProLink.textContent = 'Login to Get Pro';
                goProLink.href = 'login.html';
            }
        }

        // Handle 'Go Studio' link
        if (goStudioLink) {
            const baseStripeUrl = goStudioLink.href.split('?')[0];
            if (session) {
                goStudioLink.href = `${baseStripeUrl}?client_reference_id=${session.user.id}`;
            } else {
                goStudioLink.textContent = 'Login to Get Studio';
                goStudioLink.href = 'login.html';
            }
        }        
    };

    // Initialize auth state handling
    window.app.supabaseClient.auth.onAuthStateChange((_event, session) => {
        handleAuthStateChange(session);
    });

    // Add logout functionality if the button exists
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await window.app.supabaseClient.auth.signOut();
            window.location.href = '/index.html';
        });
    }

    // Add hamburger menu functionality if it exists
    const hamburger = document.querySelector('.hamburger');
    if (hamburger) {
        const navPanel = document.querySelector('.nav-panel');
        const menuIcon = hamburger.querySelector('.burger-menu');

        hamburger.addEventListener('click', () => {
            if (navPanel && menuIcon) {
                const isActive = navPanel.classList.toggle('active');
                menuIcon.textContent = isActive ? 'close' : 'menu';
            }
        });
    }

    // Initialize the Coloris color picker if the function is available
    if (typeof Coloris === 'function') {
        Coloris({
            theme: 'pill',
            themeMode: 'dark',
            alpha: false,
            swatches: [
              'DarkSlateGray',
              '#2a9d8f',
              '#e9c46a',
              'coral',
              'rgb(231, 111, 81)',
              'Crimson',
              '#023e8a',
              '#0077b6',
              'hsl(194, 100%, 39%)',
              '#00b4d8',
              '#48cae4'
            ],
            onChange: (color, inputEl) => {
              console.log(`The new color is ${color}`);
            }
        });
    }
});