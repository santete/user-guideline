(function() {
    // UUID Generator for Device ID and Row IDs
    function getUUID() {
        return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substr(2, 9) + Date.now();
    }

    function getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = getUUID();
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    }
    const deviceId = getDeviceId();

    // Determine correct path to worker.js
    let workerPath = 'assets/js/worker.js';
    if (window.location.pathname.includes('/guides/')) {
        workerPath = '../../assets/js/worker.js';
    }

    // Local DB Helper (Outbox Pattern)
    const DB_KEY = 'sync_db';
    const DB = {
        getAll: () => JSON.parse(localStorage.getItem(DB_KEY) || '[]'),
        saveAll: (data) => localStorage.setItem(DB_KEY, JSON.stringify(data)),
        insert: (pageId, eventType, count) => {
            let db = DB.getAll();
            db.push({
                id: getUUID(),
                page_id: pageId,
                event_type: eventType,
                count: count,
                status: 'unsync',
                retry_count: 0
            });
            DB.saveAll(db);
        }
    };

    // Migrate old 'sync_queue' format to new 'sync_db' format if present
    let oldQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    if (oldQueue.length > 0) {
        oldQueue.forEach(item => {
            DB.insert(item.page_id, item.event_type, item.count);
        });
        localStorage.removeItem('sync_queue');
    }

    try {
        const worker = new Worker(workerPath);
        let processingIds = [];

        worker.addEventListener('message', (e) => {
            if (e.data.type === 'SYNC_SUCCESS') {
                console.log('Background Sync Successful for rows:', processingIds);
                let db = DB.getAll();
                // Delete rows that were successfully synced
                db = db.filter(row => !processingIds.includes(row.id));
                DB.saveAll(db);
                processingIds = []; // Release lock
            } else if (e.data.type === 'SYNC_ERROR') {
                console.error('Background Sync Error:', e.data);
                let db = DB.getAll();
                // Increment retry_count for failed rows
                db.forEach(row => {
                    if (processingIds.includes(row.id)) {
                        row.retry_count = (row.retry_count || 0) + 1;
                    }
                });
                DB.saveAll(db);
                processingIds = []; // Release lock
            }
        });

        // Background Sync Loop (Mỗi 10 giây)
        setInterval(() => {
            // Nếu đang trong quá trình Sync, bỏ qua vòng lặp này để tránh gửi đúp
            if (processingIds.length > 0) return;

            let db = DB.getAll();
            // Lọc ra các row chưa sync và số lần retry < 5
            let pendingRows = db.filter(row => row.status === 'unsync' && (row.retry_count || 0) < 5);

            if (pendingRows.length > 0) {
                // Khóa danh sách ID đang xử lý
                processingIds = pendingRows.map(row => row.id);
                
                // Gom nhóm (Group by page_id và event_type) để gửi API nhằm tiết kiệm request
                let syncDataMap = {};
                pendingRows.forEach(row => {
                    let key = row.page_id + '_' + row.event_type;
                    if (!syncDataMap[key]) {
                        syncDataMap[key] = { page_id: row.page_id, event_type: row.event_type, count: 0 };
                    }
                    syncDataMap[key].count += row.count;
                });
                
                let syncDataPayload = Object.values(syncDataMap);

                worker.postMessage({
                    type: 'SYNC',
                    payload: {
                        device_id: deviceId,
                        sync_data: syncDataPayload
                    }
                });
            }
        }, 10000);
    } catch (err) {
        console.warn('Web Worker not supported or failed to load. Running without background sync.', err);
    }

    // Ghi dữ liệu vào DB (Dùng cho interaction.js)
    window.pushToSyncQueue = function(pageId, eventType, count = 1) {
        DB.insert(pageId, eventType, count);
    };

    // Centralized Optimistic UI logic
    window.calculateOptimisticStats = function(pageId, apiViews, apiLikes) {
        let db = DB.getAll();
        // Chỉ cộng nhẩm các row chưa sync
        let pendingRows = db.filter(row => row.page_id === pageId && row.status === 'unsync');
        
        let pendingViews = pendingRows.filter(r => r.event_type === 'VIEW').reduce((sum, r) => sum + r.count, 0);
        let pendingLikes = pendingRows.filter(r => r.event_type === 'LIKE').reduce((sum, r) => sum + r.count, 0);
        let pendingUnlikes = pendingRows.filter(r => r.event_type === 'UNLIKE').reduce((sum, r) => sum + r.count, 0);
        
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
