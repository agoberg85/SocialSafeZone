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
            const baseStripeUrl = goProLink.href.split('?')[0]; // Keep the base URL
            
            if (session) {
                // User IS logged in:
                // 1. Attach their ID so Stripe knows who they are
                goProLink.href = `${baseStripeUrl}?client_reference_id=${session.user.id}`;
                // 2. Set text to 'Get Pro'
                goProLink.textContent = 'Get Pro';
            } else {
                // User is NOT logged in:
                // 1. Send them to login, but tell login to send them back here (?next=pricing.html)
                goProLink.href = 'login.html?next=pricing.html'; 
                // 2. Update text to call to action
                goProLink.textContent = 'Start 7 day Free Trial'; 
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

    // --- Password Reset Logic ---
    function showMessage(elementId, message, type) {
        const messageBox = document.getElementById(elementId);
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = `message-box ${type}`;
            messageBox.style.display = 'block';
        }
    }

    // Forgot Password Form Handler
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const messageBoxId = 'forgot-password-message';

            const { error } = await window.app.supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://social-safe-zone.vercel.app/reset-password.html',
            });

            if (error) {
                showMessage(messageBoxId, error.message, 'error');
            } else {
                showMessage(messageBoxId, 'Password reset email sent. Check your inbox!', 'success');
                forgotPasswordForm.reset();
            }
        });
    }

    // Reset Password Form Handler
    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const messageBoxId = 'reset-password-message';

            if (newPassword !== confirmPassword) {
                showMessage(messageBoxId, 'Passwords do not match.', 'error');
                return;
            }

            if (newPassword.length < 6) { // Basic password strength check
                showMessage(messageBoxId, 'Password must be at least 6 characters long.', 'error');
                return;
            }

            // Supabase automatically picks up the token from the URL
            const { error } = await window.app.supabaseClient.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                showMessage(messageBoxId, error.message, 'error');
            } else {
                showMessage(messageBoxId, 'Your password has been reset successfully!', 'success');
                resetPasswordForm.reset();
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        });
    }
});