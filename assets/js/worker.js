// Web Worker for Background Sync (Offline-First)
const API_KEY = 'pj_live_89f0039b1111c8e0bfeb07cb87d9da7a';
const API_URL = 'https://api.projectnow.app/functions/v1/sync-offline-events';

self.addEventListener('message', async (e) => {
    const { type, payload } = e.data;
    
    if (type === 'SYNC') {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                self.postMessage({ type: 'SYNC_SUCCESS' });
            } else {
                self.postMessage({ type: 'SYNC_ERROR', status: response.status });
            }
        } catch (error) {
            self.postMessage({ type: 'SYNC_ERROR', message: error.message });
        }
    }
});
