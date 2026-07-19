document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const guidesGrid = document.getElementById('guidesGrid');
    const API_KEY = 'pj_live_89f0039b1111c8e0bfeb07cb87d9da7a';

    // Hàm render card
    function renderGuides(guidesToRender, apiStats = []) {
        guidesGrid.innerHTML = '';
        
        if (guidesToRender.length === 0) {
            guidesGrid.innerHTML = `<div class="no-results">😕 Không tìm thấy hướng dẫn nào phù hợp.</div>`;
            return;
        }

        guidesToRender.forEach(guide => {
            const tagsHtml = guide.tags.map(tag => `<span class="tag">#${tag}</span>`).join('');
            
            let pathOnly = guide.url.split('?')[0];
            const pageId = pathOnly.split('/').pop().replace('.html', '');
            
            // Tìm stat từ API
            let stat = apiStats.find(s => s.page_id === pageId);
            
            // Lấy thêm pending queue từ local nếu có để hiển thị chính xác
            let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
            let pendingViews = queue.filter(q => q.page_id === pageId && q.event_type === 'VIEW').reduce((sum, q) => sum + q.count, 0);
            let pendingLikes = queue.filter(q => q.page_id === pageId && q.event_type === 'LIKE').reduce((sum, q) => sum + q.count, 0);
            let pendingUnlikes = queue.filter(q => q.page_id === pageId && q.event_type === 'UNLIKE').reduce((sum, q) => sum + q.count, 0);
            
            let views = (stat ? stat.views : (parseInt(localStorage.getItem(`view_${pageId}`)) || 0)) + pendingViews;
            let likes = Math.max(0, (stat ? stat.likes : (parseInt(localStorage.getItem(`likeCount_${pageId}`)) || 0)) + pendingLikes - pendingUnlikes);
            
            let userLiked = localStorage.getItem(`userLiked_${pageId}`) === 'true';
            let heartClass = userLiked ? 'liked' : '';
            
            const cardHtml = `
                <a href="${guide.url}" class="guide-card">
                    <div class="guide-category">${guide.category}</div>
                    <h3 class="guide-title">${guide.title}</h3>
                    <p class="guide-desc">${guide.description}</p>
                    <div class="guide-tags">
                        ${tagsHtml}
                    </div>
                    <div class="guide-stats">
                        <div class="guide-stat-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <span>${parseInt(views).toLocaleString()}</span>
                        </div>
                        <div class="guide-stat-item ${heartClass}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            <span>${parseInt(likes).toLocaleString()}</span>
                        </div>
                    </div>
                </a>
            `;
            guidesGrid.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    // Fetch toàn bộ stats từ Server lúc load trang
    let currentApiStats = [];
    async function loadInitialData() {
        // Tạm render số ảo từ Local trước để tránh giật lag lúc đợi API
        renderGuides(guidesData, currentApiStats);

        try {
            // Lấy ID của tất cả bài viết
            const allIds = guidesData.map(g => g.url.split('?')[0].split('/').pop().replace('.html', '')).join(',');
            const response = await fetch(`https://api.projectnow.app/functions/v1/get-page-stats?page_ids=${allIds}`, {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });
            
            if (response.ok) {
                currentApiStats = await response.json();
                // Re-render với số lượng thật
                renderGuides(guidesData, currentApiStats);
            }
        } catch (e) {
            console.warn("Lỗi không gọi được API trang chủ. Dùng local db.");
        }
    }

    loadInitialData();

    // Xử lý tìm kiếm
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        const filteredGuides = guidesData.filter(guide => {
            const matchTitle = guide.title.toLowerCase().includes(searchTerm);
            const matchDesc = guide.description.toLowerCase().includes(searchTerm);
            const matchTags = guide.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            const matchCategory = guide.category.toLowerCase().includes(searchTerm);
            
            return matchTitle || matchDesc || matchTags || matchCategory;
        });

        renderGuides(filteredGuides, currentApiStats);
    });
});
