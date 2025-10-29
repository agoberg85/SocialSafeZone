// static/auth.js

// This script now relies on `main.js` to be loaded first to create the supabaseClient.

document.addEventListener('DOMContentLoaded', () => {
    // We can now safely access the client from the global app object.
    const supabaseClient = window.app.supabaseClient;

    // --- DOM Elements ---
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const messageBox = document.getElementById('message-box');

    // --- Tab Switching Logic ---
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    // --- Helper to show messages ---
    function showMessage(message, type) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
    }

    // --- Sign Up Handler ---
    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const passwordConfirm = document.getElementById('signup-password-confirm').value;

        // Email validation
        const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (!emailRegex.test(email)) {
            showMessage('Invalid email format.', 'error');
            return;
        }

        // Password confirmation check
        if (password !== passwordConfirm) {
            showMessage('Passwords do not match.', 'error');
            return;
        }

        // Use the client from the global app object
        const { data, error } = await supabaseClient.auth.signUp({ email, password });

        if (error) {
            showMessage(error.message, 'error');
        } else {
            showMessage('Success! Please check your email for a confirmation link to activate your account.', 'success');
            signupForm.reset();
        }
    });

    // --- Login Handler ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        // Use the client from the global app object
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            showMessage(error.message, 'error');
        } else {
            // On successful login, redirect to the tool page
            window.location.href = 'app.html';
        }
    });
});