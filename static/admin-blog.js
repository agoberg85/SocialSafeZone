// static/admin-blog.js
const supabaseClient = window.app.supabaseClient;
let currentEditingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Auth & Admin Status
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '../login.html';
        return;
    }

    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

    if (error || !profile || !profile.is_admin) {
        alert('Access denied. Admin privileges required.');
        window.location.href = '../index.html';
        return;
    }

    // 2. Load Data
    loadPosts();
    setupEventListeners();
});

async function loadPosts() {
    try {
        const { data, error } = await supabaseClient
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderPosts(data);
    } catch (error) {
        console.error('Error loading posts:', error);
        alert('Failed to load posts.');
    }
}

function renderPosts(posts) {
    const tbody = document.getElementById('posts-tbody');
    tbody.innerHTML = posts.map(post => `
        <tr>
            <td>
                <strong>${escapeHtml(post.title)}</strong><br>
                <small style="color:#666">/${escapeHtml(post.slug)}</small>
            </td>
            <td>${new Date(post.created_at).toLocaleDateString()}</td>
            <td>
                <span class="badge ${post.is_published ? 'badge-active' : 'badge-inactive'}">
                    ${post.is_published ? 'Published' : 'Draft'}
                </span>
            </td>
            <td>
                <button onclick="editPost(${post.id})" class="btn btn-small" style="background: #667eea; color: white;">Edit</button>
                <button onclick="deletePost(${post.id})" class="btn btn-small" style="background: #ef4444; color: white;">Delete</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('posts-table').style.display = 'block';
}

function setupEventListeners() {
    document.getElementById('new-post-btn').addEventListener('click', openNewPostModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('post-form').addEventListener('submit', savePost);
    
    // Auto-generate slug from title
    document.getElementById('title').addEventListener('input', (e) => {
        if (!currentEditingId) { // Only auto-generate for new posts
            const slug = e.target.value.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
            document.getElementById('slug').value = slug;
        }
    });
}

function openNewPostModal() {
    currentEditingId = null;
    document.getElementById('modal-title').textContent = 'New Blog Post';
    document.getElementById('post-form').reset();
    document.getElementById('modal').classList.add('active');
}

window.editPost = async function(id) {
    try {
        const { data, error } = await supabaseClient
            .from('blog_posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        currentEditingId = id;
        document.getElementById('modal-title').textContent = 'Edit Post';
        
        document.getElementById('title').value = data.title;
        document.getElementById('slug').value = data.slug;
        document.getElementById('image-url').value = data.image_url || '';
        document.getElementById('excerpt').value = data.excerpt || '';
        document.getElementById('content').value = data.content || '';
        document.getElementById('is-published').checked = data.is_published;

        document.getElementById('modal').classList.add('active');
    } catch (error) {
        console.error(error);
        alert('Error loading post details');
    }
};

async function savePost(e) {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const postData = {
        title: document.getElementById('title').value.trim(),
        slug: document.getElementById('slug').value.trim(),
        image_url: document.getElementById('image-url').value.trim() || null,
        excerpt: document.getElementById('excerpt').value.trim(),
        content: document.getElementById('content').value.trim(),
        is_published: document.getElementById('is-published').checked
    };

    try {
        let error;
        if (currentEditingId) {
            ({ error } = await supabaseClient.from('blog_posts').update(postData).eq('id', currentEditingId));
        } else {
            ({ error } = await supabaseClient.from('blog_posts').insert(postData));
        }

        if (error) throw error;

        alert('Post saved! Site rebuild triggered (takes ~1-2 mins).');
        closeModal();
        loadPosts();
    } catch (error) {
        console.error(error);
        alert('Error saving post: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Post';
    }
}

window.deletePost = async function(id) {
    if(!confirm('Are you sure? This cannot be undone.')) return;
    
    try {
        const { error } = await supabaseClient.from('blog_posts').delete().eq('id', id);
        if (error) throw error;
        loadPosts();
    } catch (error) {
        alert('Error deleting post');
    }
};

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}