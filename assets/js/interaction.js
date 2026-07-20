document.addEventListener('DOMContentLoaded', () => {
    const pathOnly = window.location.pathname.split('?')[0];
    const filename = pathOnly.split('/').pop();
    // Đọc data.js nếu có (trong index.html không dùng interaction.js nên chắc chắn chạy trong guide page)
    const guide = (typeof guidesData !== 'undefined') ? guidesData.find(g => g.url.includes(filename)) : null;
    const pageId = guide ? guide.id : filename.replace('.html', '');
    if (!pageId) return;

    // UI Elements
    const viewCountEl = document.getElementById('viewCount');
    const likeCountEl = document.getElementById('likeCount');
    const likeBtn = document.getElementById('likeBtn');
    
    const userLikedKey = `userLiked_${pageId}`;
    let userLiked = localStorage.getItem(userLikedKey) === 'true';

    // Local optimistic states (Mặc định tạm thời lấy từ Local nếu API lỗi)
    let localViews = parseInt(localStorage.getItem(`view_${pageId}`)) || 0;
    let localLikes = parseInt(localStorage.getItem(`likeCount_${pageId}`)) || 0;

    // Fetch initial data from API
    async function fetchStats() {
        try {
            const response = await fetch(`https://www.projectnow.app/api/functions/get-page-stats?page_ids=${pageId}`, {
                headers: { 'Authorization': 'Bearer pj_live_89f0039b1111c8e0bfeb07cb87d9da7a' }
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data[pageId]) {
                    const stat = result.data[pageId];
                    localViews = stat.views;
                    localLikes = stat.likes;
                }
            }
        } catch (e) {
            console.warn("API Get Stats failed, using local offline stats.");
        } finally {
            // Sử dụng hàm tính toán chung từ sync-engine.js để đảm bảo Consistency
            let optStats = window.calculateOptimisticStats(pageId, localViews, localLikes);
            localViews = optStats.views;
            localLikes = optStats.likes;
            
            updateUI();
        }
    }

    function updateUI() {
        if (viewCountEl) viewCountEl.innerText = localViews.toLocaleString();
        if (likeCountEl) likeCountEl.innerText = localLikes.toLocaleString();
        if (userLiked && likeBtn) {
            likeBtn.classList.add('liked');
        } else if (likeBtn) {
            likeBtn.classList.remove('liked');
        }
    }

    // Initial View Event
    window.pushToSyncQueue(pageId, 'VIEW', 1);
    fetchStats();

    // Like Button Event
    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            if (likeBtn.classList.contains('liked')) {
                localLikes = Math.max(0, localLikes - 1);
                userLiked = false;
                window.pushToSyncQueue(pageId, 'UNLIKE', 1);
            } else {
                localLikes++;
                userLiked = true;
                window.pushToSyncQueue(pageId, 'LIKE', 1);
            }
            localStorage.setItem(userLikedKey, userLiked);
            updateUI();
        });
    }
    
    // Bắt sự kiện khi Background Worker sync thành công để cập nhật lại UI ngay lập tức
    window.addEventListener('SYNC_UPDATED', (e) => {
        let syncedPageIds = e.detail.pageIds || [];
        if (syncedPageIds.includes(pageId)) {
            // Không truyền apiViews, ép hàm đọc lại từ bộ nhớ đệm Base Cache vừa được Worker cộng dồn
            let optStats = window.calculateOptimisticStats(pageId, null, null);
            localViews = optStats.views;
            localLikes = optStats.likes;
            updateUI();
            console.log(`Live Updated UI for ${pageId} after Background Sync`);
        }
    });

});
