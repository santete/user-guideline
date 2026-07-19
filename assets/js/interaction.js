document.addEventListener('DOMContentLoaded', () => {
    const pathOnly = window.location.pathname.split('?')[0];
    const filename = pathOnly.split('/').pop();
    // Đọc data.js nếu có (trong index.html không dùng interaction.js nên chắc chắn chạy trong guide page)
    const guide = (typeof guidesData !== 'undefined') ? guidesData.find(g => g.url.includes(filename)) : null;
    const pageId = guide ? guide.id : filename.replace('.html', '');
    if (!pageId) return;

    // UUID Generator for Device ID
    function getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    }
    const deviceId = getDeviceId();

    // Local Queue Management
    function pushToQueue(eventType, count = 1) {
        let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        let existing = queue.find(q => q.page_id === pageId && q.event_type === eventType);
        
        if (existing) {
            existing.count += count;
        } else {
            queue.push({ page_id: pageId, event_type: eventType, count: count });
        }
        localStorage.setItem('sync_queue', JSON.stringify(queue));
    }

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
            const response = await fetch(`https://api.projectnow.app/functions/v1/get-page-stats?page_ids=${pageId}`, {
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
            // Cộng dồn với số lượng đang chờ trong hàng đợi cục bộ (Optimistic UI)
            let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
            let pendingViews = queue.filter(q => q.page_id === pageId && q.event_type === 'VIEW').reduce((sum, q) => sum + q.count, 0);
            let pendingLikes = queue.filter(q => q.page_id === pageId && q.event_type === 'LIKE').reduce((sum, q) => sum + q.count, 0);
            let pendingUnlikes = queue.filter(q => q.page_id === pageId && q.event_type === 'UNLIKE').reduce((sum, q) => sum + q.count, 0);
            
            localViews += pendingViews;
            localLikes = Math.max(0, localLikes + pendingLikes - pendingUnlikes);
            
            // Cập nhật lại bộ nhớ đệm phòng khi đứt mạng lần sau
            localStorage.setItem(`view_${pageId}`, localViews);
            localStorage.setItem(`likeCount_${pageId}`, localLikes);
            
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
    pushToQueue('VIEW', 1);
    fetchStats();

    // Like Button Event
    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            if (likeBtn.classList.contains('liked')) {
                localLikes = Math.max(0, localLikes - 1);
                userLiked = false;
                pushToQueue('UNLIKE', 1);
            } else {
                localLikes++;
                userLiked = true;
                pushToQueue('LIKE', 1);
            }
            localStorage.setItem(userLikedKey, userLiked);
            updateUI();
        });
    }

    // Khởi tạo Web Worker để đồng bộ ngầm
    try {
        const worker = new Worker('../../assets/js/worker.js');
        
        worker.addEventListener('message', (e) => {
            if (e.data.type === 'SYNC_SUCCESS') {
                console.log('Background Sync Successful');
                localStorage.removeItem('sync_queue'); // Xóa hàng đợi khi đồng bộ thành công
            } else if (e.data.type === 'SYNC_ERROR') {
                console.error('Background Sync Error:', e.data);
            }
        });

        // Background Sync Loop (Mỗi 10 giây)
        setInterval(() => {
            let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
            if (queue.length > 0) {
                worker.postMessage({
                    type: 'SYNC',
                    payload: {
                        device_id: deviceId,
                        sync_data: queue
                    }
                });
            }
        }, 10000);
    } catch (err) {
        console.warn('Web Worker not supported or failed to load. Running without background sync.', err);
    }
});
