// scripts/generate-blog.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables (Vercel provides these automatically)
const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateBlog() {
    console.log('🚀 Starting Blog Generation...');

    // 1. Fetch all published posts
    const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('is_published', true);

    if (error) {
        console.error('Error fetching posts:', error);
        process.exit(1);
    }

    console.log(`Found ${posts.length} posts.`);

    // 2. Read the template
    const templatePath = path.join(__dirname, '../_article_template.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // 3. Ensure public/blog directory exists
    const outputDir = path.join(__dirname, '../public/blog');
    if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 4. Generate a file for each post
    posts.forEach(post => {
        let html = template;
        
        // Default image if none provided
        const socialImage = post.image_url || 'https://social-safe-zone.vercel.app/og-image.jpg';
        
        // Replace placeholders
        html = html.replace(/{{TITLE}}/g, post.title);
        html = html.replace(/{{SLUG}}/g, post.slug);
        html = html.replace(/{{EXCERPT}}/g, post.excerpt || '');
        html = html.replace(/{{CONTENT}}/g, post.content);
        html = html.replace(/{{DATE}}/g, new Date(post.created_at).toLocaleDateString());
        html = html.replace(/{{IMAGE_URL}}/g, socialImage);

        // Write file
        const filePath = path.join(outputDir, `${post.slug}.html`);
        fs.writeFileSync(filePath, html);
        console.log(`✅ Generated: blog/${post.slug}.html`);
    });

    console.log('✨ Blog generation complete.');
}

generateBlog();