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
            
            const cardHtml = `
                <a href="${guide.url}" class="guide-card">
                    <div class="guide-category">${guide.category}</div>
                    <h3 class="guide-title">${guide.title}</h3>
                    <p class="guide-desc">${guide.description}</p>
                    <div class="guide-tags">
                        ${tagsHtml}
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
