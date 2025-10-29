// static/main.js

window.app = {};

const supabaseUrl = 'https://yoatrgbojsfpegorzbma.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvYXRyZ2JvanNmcGVnb3J6Ym1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTMzOTcsImV4cCI6MjA3NjU2OTM5N30.RA0hse-MXlq-q0MXTvwqRXc_naFgm5rtpJ16v4N9r3k';
window.app.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {

    const userSessionCta = document.getElementById('user-session-cta');
    const loginButtonNav = document.getElementById('login-button-nav');
    const userMenu = document.getElementById('user-menu');
    const logoutButton = document.getElementById('logout-button');
    const welcomeLink = document.getElementById('welcome-link');
    const goProLink = document.getElementById('go-pro-link');
    const goStudioLink = document.getElementById('go-studio-link');
    
    

    const handleAuthStateChange = async (session) => {
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

        // --- THE FIX: Fire a custom event to notify other scripts ---
        // This tells any listening script that the profile data has been loaded or updated.
        document.dispatchEvent(new Event('profileLoaded'));

        if (goProLink) {
            const baseStripeUrl = goProLink.href.split('?')[0];
            if (session) {
                goProLink.href = `${baseStripeUrl}?client_reference_id=${session.user.id}`;
            } else {
                goProLink.textContent = 'Login to Go Pro';
                goProLink.href = 'login.html';
            }
        }

        const goStudioLink = document.getElementById('go-studio-link');
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

    window.app.supabaseClient.auth.onAuthStateChange((_event, session) => {
        handleAuthStateChange(session);
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await window.app.supabaseClient.auth.signOut();
            window.location.href = '/index.html';
        });
    }
    const hamburger = document.querySelector('.hamburger');
    const navPanel = document.querySelector('.nav-panel');
    const menuIcon = hamburger.querySelector('.material-symbols-outlined');

    hamburger.addEventListener('click', () => {
        const isActive = navPanel.classList.toggle('active');
        
        // Change icon based on active state
        if (isActive) {
            menuIcon.textContent = 'close';
        } else {
            menuIcon.textContent = 'menu';
        }
    });   

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
});