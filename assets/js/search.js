document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const guidesGrid = document.getElementById('guidesGrid');

    // Hàm render card
    function renderGuides(guidesToRender) {
        guidesGrid.innerHTML = '';
        
        if (guidesToRender.length === 0) {
            guidesGrid.innerHTML = `<div class="no-results">😕 Không tìm thấy hướng dẫn nào phù hợp.</div>`;
            return;
        }

        guidesToRender.forEach(guide => {
            const tagsHtml = guide.tags.map(tag => `<span class="tag">#${tag}</span>`).join('');
            
            let pathOnly = guide.url.split('?')[0];
            const pageId = pathOnly.split('/').pop().replace('.html', '');
            
            let views = localStorage.getItem(`view_${pageId}`);
            let likes = localStorage.getItem(`likeCount_${pageId}`);
            let userLiked = localStorage.getItem(`userLiked_${pageId}`) === 'true';
            
            if (!views) {
                views = Math.floor(Math.random() * 500) + 50;
                localStorage.setItem(`view_${pageId}`, views);
            }
            if (!likes) {
                likes = Math.floor(Math.random() * 50) + 10;
                localStorage.setItem(`likeCount_${pageId}`, likes);
            }
            
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

    // Render ban đầu
    renderGuides(guidesData);

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

        renderGuides(filteredGuides);
    });
});
