// static/auth.js - DEBUG VERSION

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DOM Elements ---
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const messageBox = document.getElementById('message-box');

    // Debug: Check if elements exist
    if (!loginForm || !signupForm || !loginTab || !signupTab) {
        return;
    } else {
    }

    // --- 2. UI Switching Logic ---
    function switchToLogin() {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    }

    function switchToSignup() {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }

    loginTab.addEventListener('click', switchToLogin);
    signupTab.addEventListener('click', switchToSignup);

    // --- 3. AUTO-SWITCH BASED ON URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const nextParam = urlParams.get('next');

    if (nextParam) {
        switchToSignup();
    }

    // --- 4. Initialize Supabase ---
    const supabaseClient = window.app ? window.app.supabaseClient : null;

    if (!supabaseClient) {
        return; 
    }

    // --- 5. Auth Helper Functions ---
    function showMessage(message, type) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.classList.remove('hidden');
    }

    function handleSuccessRedirect() {
        if (nextParam) {
            window.location.href = nextParam;
        } else {
            window.location.href = 'profile.html';
        }
    }

    // --- 6. Form Submission Handlers ---
    
    // Sign Up Handler
    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const passwordConfirm = document.getElementById('signup-password-confirm').value;

        // Validation
        const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (!emailRegex.test(email)) {
            showMessage('Invalid email format.', 'error');
            return;
        }

        if (password !== passwordConfirm) {
            showMessage('Passwords do not match.', 'error');
            return;
        }

        // Supabase Sign Up
        const { data, error } = await supabaseClient.auth.signUp({ email, password });

        if (error) {
            showMessage(error.message, 'error');
        } else {
            if (data.session) {
                handleSuccessRedirect();
            } else {
                showMessage('Success! Please check your email for a confirmation link.', 'success');
                signupForm.reset();
            }
        }
    });

    // Login Handler
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            showMessage(error.message, 'error');
        } else {
            handleSuccessRedirect();
        }
    });
});