document.addEventListener('DOMContentLoaded', () => {
    // Generate unique ID based on pathname
    const pageId = window.location.pathname.split('/').pop().replace('.html', '');
    if (!pageId) return;

    // View Logic
    const viewKey = `view_${pageId}`;
    let views = localStorage.getItem(viewKey);
    if (!views) {
        views = Math.floor(Math.random() * 500) + 50; // Random initial views
    } else {
        views = parseInt(views) + 1;
    }
    localStorage.setItem(viewKey, views);
    
    // Like Logic
    const likeCountKey = `likeCount_${pageId}`;
    const userLikedKey = `userLiked_${pageId}`;
    
    let likes = localStorage.getItem(likeCountKey);
    let userLiked = localStorage.getItem(userLikedKey) === 'true';
    
    if (!likes) {
        likes = Math.floor(Math.random() * 50) + 10;
        localStorage.setItem(likeCountKey, likes);
    } else {
        likes = parseInt(likes);
    }
    
    // UI Elements
    const viewCountEl = document.getElementById('viewCount');
    const likeCountEl = document.getElementById('likeCount');
    const likeBtn = document.getElementById('likeBtn');
    
    if (viewCountEl) viewCountEl.innerText = views.toLocaleString();
    if (likeCountEl) likeCountEl.innerText = likes.toLocaleString();
    
    if (userLiked && likeBtn) {
        likeBtn.classList.add('liked');
    }
    
    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            if (likeBtn.classList.contains('liked')) {
                // Unlike
                likes--;
                likeBtn.classList.remove('liked');
                localStorage.setItem(userLikedKey, 'false');
            } else {
                // Like
                likes++;
                likeBtn.classList.add('liked');
                localStorage.setItem(userLikedKey, 'true');
            }
            likeCountEl.innerText = likes.toLocaleString();
            localStorage.setItem(likeCountKey, likes);
        });
    }
});
