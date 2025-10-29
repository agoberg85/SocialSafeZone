// static/profile.js

document.addEventListener('DOMContentLoaded', () => {
    const supabaseClient = window.app.supabaseClient;

    const userEmailEl = document.getElementById('user-email');
    const subStatusEl = document.getElementById('subscription-status');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const manageBillingBtn = document.getElementById('manage-billing-btn');
    const messageBox = document.getElementById('message-box');

    function showMessage(message, type) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
    }

    // This function will now be called by our event listener
    const updateProfileData = () => {
        const userProfile = window.app.userProfile;
        if (userProfile) {
            subStatusEl.textContent = userProfile.subscription_status;
            if (userProfile.subscription_status === 'FREE' && !userProfile.stripe_customer_id) {
                manageBillingBtn.disabled = true;
                manageBillingBtn.classList.add('disabled');
                manageBillingBtn.title = "You do not have an active subscription to manage.";
            }
        } else {
            subStatusEl.textContent = 'FREE'; // If no profile, assume FREE
        }
    };

    const loadUserData = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        userEmailEl.textContent = session.user.email;
        updateProfileData(); // Run once on load
    };

    // --- THE FIX: Listen for the signal from main.js ---
    document.addEventListener('profileLoaded', updateProfileData);

    // (All button event listeners are the same as before)
    changePasswordBtn.addEventListener('click', async () => {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(user.email);
            if (error) {
                showMessage(`Error: ${error.message}`, 'error');
            } else {
                showMessage('Password reset link sent to your email!', 'success');
            }
        }
    });
    manageBillingBtn.addEventListener('click', async () => {
        manageBillingBtn.disabled = true;
        manageBillingBtn.textContent = 'Loading...';
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) throw new Error("Not logged in");

            const { data, error } = await supabaseClient.functions.invoke('create-portal-link');
            if (error) throw error;
            window.location.href = data.url;

        } catch (error) {
            showMessage(`Error: ${error.message}`, 'error');
            manageBillingBtn.disabled = false;
            manageBillingBtn.textContent = 'Manage Subscription';
        }
    });
    
    loadUserData();
});