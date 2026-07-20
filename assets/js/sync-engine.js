(function() {
    // UUID Generator for Device ID (Shared across pages)
    function getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    }
    const deviceId = getDeviceId();

    // Determine correct path to worker.js based on current page location
    let workerPath = 'assets/js/worker.js';
    if (window.location.pathname.includes('/guides/')) {
        workerPath = '../../assets/js/worker.js';
    }

    try {
        const worker = new Worker(workerPath);
        let syncingSnapshot = null;

        worker.addEventListener('message', (e) => {
            if (e.data.type === 'SYNC_SUCCESS') {
                console.log('Background Sync Successful');
                if (syncingSnapshot) {
                    // Xử lý Race Condition: Thay vì xóa trắng (removeItem), chỉ trừ đi số lượng đã sync thành công
                    let currentQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
                    
                    syncingSnapshot.forEach(syncedItem => {
                        let idx = currentQueue.findIndex(q => q.page_id === syncedItem.page_id && q.event_type === syncedItem.event_type);
                        if (idx !== -1) {
                            currentQueue[idx].count -= syncedItem.count;
                            // Nếu đã trừ hết, xóa khỏi mảng
                            if (currentQueue[idx].count <= 0) {
                                currentQueue.splice(idx, 1);
                            }
                        }
                    });
                    
                    // Lưu lại queue mới đã được tỉa bớt
                    localStorage.setItem('sync_queue', JSON.stringify(currentQueue));
                }
                syncingSnapshot = null; // Giải phóng Lock
            } else if (e.data.type === 'SYNC_ERROR') {
                console.error('Background Sync Error:', e.data);
                syncingSnapshot = null; // Giải phóng Lock để lần sau thử lại
            }
        });

        // Background Sync Loop (Mỗi 10 giây)
        setInterval(() => {
            // Nếu đang trong quá trình Sync, bỏ qua vòng lặp này để tránh gửi đúp
            if (syncingSnapshot) return;

            let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
            if (queue.length > 0) {
                // Khóa (Lock) hàng đợi hiện tại lại thành Snapshot
                // Deep copy để đảm bảo giá trị count không bị thay đổi bởi luồng chính
                syncingSnapshot = JSON.parse(JSON.stringify(queue));
                
                worker.postMessage({
                    type: 'SYNC',
                    payload: {
                        device_id: deviceId,
                        sync_data: syncingSnapshot
                    }
                });
            }
        }, 10000);
    } catch (err) {
        console.warn('Web Worker not supported or failed to load. Running without background sync.', err);
    }

    // Global Queue Management helper function (Exposed for interaction.js)
    window.pushToSyncQueue = function(pageId, eventType, count = 1) {
        let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        let existing = queue.find(q => q.page_id === pageId && q.event_type === eventType);
        
        if (existing) {
            existing.count += count;
        } else {
            queue.push({ page_id: pageId, event_type: eventType, count: count });
        }
        localStorage.setItem('sync_queue', JSON.stringify(queue));
    };


    // Centralized Optimistic UI logic
    window.calculateOptimisticStats = function(pageId, apiViews, apiLikes) {
        let queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        let pendingViews = queue.filter(q => q.page_id === pageId && q.event_type === 'VIEW').reduce((sum, q) => sum + q.count, 0);
        let pendingLikes = queue.filter(q => q.page_id === pageId && q.event_type === 'LIKE').reduce((sum, q) => sum + q.count, 0);
        let pendingUnlikes = queue.filter(q => q.page_id === pageId && q.event_type === 'UNLIKE').reduce((sum, q) => sum + q.count, 0);
        
        let baseViews = (apiViews !== undefined && apiViews !== null) ? apiViews : (parseInt(localStorage.getItem('view_' + pageId)) || 0);
        let baseLikes = (apiLikes !== undefined && apiLikes !== null) ? apiLikes : (parseInt(localStorage.getItem('likeCount_' + pageId)) || 0);
        
        let views = baseViews + pendingViews;
        let likes = Math.max(0, baseLikes + pendingLikes - pendingUnlikes);
        
        // Cache for offline use
        localStorage.setItem('view_' + pageId, views);
        localStorage.setItem('likeCount_' + pageId, likes);
        
        return { views, likes };
    };

})();
