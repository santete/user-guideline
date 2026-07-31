document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let messageHistory = [];
    let isStreaming = false;
    let currentBundleId = '';
    let currentRawContent = '';
    let isRawMode = false;

    // Custom In-Memory Bundles Store (persisted via IndexedDB)
    let localBundles = {};
    let backendBundles = {}; // For Local Server Mode
    let isLocalMode = false;

    // --- IndexedDB Storage Engine (replaces localStorage to avoid 5MB quota) ---
    const OKF_DB_NAME = 'okf_intelligence_db';
    const OKF_STORE = 'bundles';

    function openOKFDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(OKF_DB_NAME, 1);
            req.onupgradeneeded = (e) => e.target.result.createObjectStore(OKF_STORE);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveBundle(bundleId, bundleData) {
        const db = await openOKFDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OKF_STORE, 'readwrite');
            tx.objectStore(OKF_STORE).put(bundleData, bundleId);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function loadAllBundles() {
        const db = await openOKFDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OKF_STORE, 'readonly');
            const store = tx.objectStore(OKF_STORE);
            const result = {};
            const cursor = store.openCursor();
            cursor.onsuccess = (e) => {
                const c = e.target.result;
                if (c) { result[c.key] = c.value; c.continue(); }
                else resolve(result);
            };
            cursor.onerror = (e) => reject(e.target.error);
        });
    }

    async function deleteBundle(bundleId) {
        const db = await openOKFDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OKF_STORE, 'readwrite');
            tx.objectStore(OKF_STORE).delete(bundleId);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }
    // --- End IndexedDB Engine ---

    // DOM Elements
    const apiKeyStatusEl = document.getElementById('apiKeyStatus');
    const modelSelectEl = document.getElementById('modelSelect');
    const btnSettingsEl = document.getElementById('btnSettings');
    const settingsModalEl = document.getElementById('settingsModal');
    const btnCloseSettingsEl = document.getElementById('btnCloseSettings');
    const apiKeyInputEl = document.getElementById('apiKeyInput');
    const partnerKeyInputEl = document.getElementById('partnerKeyInput');
    const gatewayUrlInputEl = document.getElementById('gatewayUrlInput');
    const useCloudGatewayInputEl = document.getElementById('useCloudGatewayInput');
    const btnSaveSettingsEl = document.getElementById('btnSaveSettings');

    // Bundle Manager Elements
    const bundleSelectEl = document.getElementById('bundleSelect');
    const btnHeaderImportEl = document.getElementById('btnHeaderImport');
    const importBundleModalEl = document.getElementById('importBundleModal');
    const btnCloseImportModalEl = document.getElementById('btnCloseImportModal');
    const tabZipBtn = document.getElementById('tabZipBtn');
    const tabPathBtn = document.getElementById('tabPathBtn');
    const tabZipContent = document.getElementById('tabZipContent');
    const tabPathContent = document.getElementById('tabPathContent');
    const btnSubmitZip = document.getElementById('btnSubmitZip');
    const btnSubmitPath = document.getElementById('btnSubmitPath');
    const btnSubmitLocalPath = document.getElementById('btnSubmitLocalPath');
    const localModeUIEl = document.getElementById('localModeUI');
    const importStatusEl = document.getElementById('importStatus');

    const treeContainerEl = document.getElementById('treeContainer');
    const treeSearchInputEl = document.getElementById('treeSearchInput');
    const btnReloadTreeEl = document.getElementById('btnReloadTree');
    const docCountTextEl = document.getElementById('docCountText');
    const okfBundleNameEl = document.getElementById('okfBundleName');

    const chatMessagesEl = document.getElementById('chatMessages');
    const chatInputEl = document.getElementById('chatInput');
    const btnSendEl = document.getElementById('btnSend');
    const btnClearChatEl = document.getElementById('btnClearChat');

    const fileModalEl = document.getElementById('fileModal');
    const modalFileNameEl = document.getElementById('modalFileName');
    const modalFileContentEl = document.getElementById('modalFileContent');
    const btnCloseModalEl = document.getElementById('btnCloseModal');
    const btnOpenNewTabEl = document.getElementById('btnOpenNewTab');
    const btnCopyMarkdownEl = document.getElementById('btnCopyMarkdown');
    const btnToggleRawEl = document.getElementById('btnToggleRaw');

    // ProjectNow OpenRouter Gateway Credentials (GitHub Pages Direct Integration)
    const DEFAULT_PARTNER_KEY = 'pj_live_98244722e4273d34e015b82d279e5867';
    const DEFAULT_OPENROUTER_KEY = '';
    const DEFAULT_GATEWAY_URL = 'https://mygkmiofmbhnxzrvrqml.supabase.co/functions/v1/ai-gateway';

    // Initialize Marked & Highlight.js
    if (window.marked) {
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true
        });
    }

    if (partnerKeyInputEl) partnerKeyInputEl.value = localStorage.getItem('projectnow_partner_key') || DEFAULT_PARTNER_KEY;
    if (apiKeyInputEl) apiKeyInputEl.value = localStorage.getItem('openrouter_api_key') || DEFAULT_OPENROUTER_KEY;
    if (gatewayUrlInputEl) gatewayUrlInputEl.value = localStorage.getItem('projectnow_gateway_url') || DEFAULT_GATEWAY_URL;
    if (useCloudGatewayInputEl) useCloudGatewayInputEl.checked = localStorage.getItem('use_cloud_gateway') === 'true';

    // 1. HEALTH CHECK & STATUS
    function checkHealth() {
        const partnerKey = localStorage.getItem('projectnow_partner_key') || DEFAULT_PARTNER_KEY;
        const openrouterKey = localStorage.getItem('openrouter_api_key') || DEFAULT_OPENROUTER_KEY;
        
        if (isLocalMode) {
            if (openrouterKey) {
                apiKeyStatusEl.querySelector('.dot').className = 'dot green';
                apiKeyStatusEl.querySelector('.status-label').textContent = 'Local Gateway (OpenRouter)';
            } else {
                apiKeyStatusEl.querySelector('.dot').className = 'dot yellow';
                apiKeyStatusEl.querySelector('.status-label').textContent = 'Chưa nhập OpenRouter Key';
            }
        } else {
            if (partnerKey && openrouterKey) {
                apiKeyStatusEl.querySelector('.dot').className = 'dot green';
                apiKeyStatusEl.querySelector('.status-label').textContent = 'ProjectNow Gateway Live';
            } else {
                apiKeyStatusEl.querySelector('.dot').className = 'dot yellow';
                apiKeyStatusEl.querySelector('.status-label').textContent = 'Thiếu cấu hình API Keys';
            }
        }
    }

    // 1.5. INITIALIZE MODE (DUAL-MODE DETECTION)
    async function initializeMode() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch('/api/bundles', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                isLocalMode = true;
                if (localModeUIEl) localModeUIEl.classList.remove('hidden');
                const spaModeUIEl = document.getElementById('spaModeUI');
                if (spaModeUIEl) spaModeUIEl.classList.add('hidden');
                
                backendBundles = {};
                data.bundles.forEach(b => {
                    backendBundles[b.bundle_id] = b;
                });
                
                if (data.active_bundle_id && backendBundles[data.active_bundle_id]) {
                    currentBundleId = data.active_bundle_id;
                }
            }
        } catch (e) {
            isLocalMode = false;
            if (localModeUIEl) localModeUIEl.classList.add('hidden');
            const spaModeUIEl = document.getElementById('spaModeUI');
            if (spaModeUIEl) spaModeUIEl.classList.remove('hidden');
        }
        // Load persisted bundles from IndexedDB (replaces old localStorage)
        try {
            localBundles = await loadAllBundles();
            // Migrate: clear old localStorage data if it exists
            localStorage.removeItem('okf_custom_bundles');
        } catch (dbErr) {
            console.warn('IndexedDB load failed, using empty bundles:', dbErr);
            localBundles = {};
        }
        checkHealth();
        loadBundlesList();
    }

    // 2. LOAD BUNDLES LIST (MERGE RAM & BACKEND)
    function loadBundlesList() {
        bundleSelectEl.innerHTML = '';
        
        const localIds = Object.keys(localBundles);
        const backendIds = Object.keys(backendBundles);
        
        if (localIds.length === 0 && backendIds.length === 0) {
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '-- Chưa có Gói Tri Thức (Hãy Import) --';
            bundleSelectEl.appendChild(emptyOpt);
            currentBundleId = '';
        } else {
            // Render Backend Bundles
            if (backendIds.length > 0) {
                const optGroup = document.createElement('optgroup');
                optGroup.label = '⚡ Ổ Cứng Local (Siêu Tốc)';
                backendIds.forEach(bId => {
                    const opt = document.createElement('option');
                    opt.value = bId;
                    opt.textContent = `${backendBundles[bId].name}`;
                    if (bId === currentBundleId) opt.selected = true;
                    optGroup.appendChild(opt);
                });
                bundleSelectEl.appendChild(optGroup);
            }

            // Render RAM Bundles
            if (localIds.length > 0) {
                const optGroup = document.createElement('optgroup');
                optGroup.label = '🧠 Bộ Nhớ RAM (Browser SPA)';
                localIds.forEach(bId => {
                    const opt = document.createElement('option');
                    opt.value = bId;
                    opt.textContent = `${localBundles[bId].name} (${Object.keys(localBundles[bId].files).length} docs)`;
                    if (bId === currentBundleId) opt.selected = true;
                    optGroup.appendChild(opt);
                });
                bundleSelectEl.appendChild(optGroup);
            }

            if (!currentBundleId || (!localBundles[currentBundleId] && !backendBundles[currentBundleId])) {
                currentBundleId = backendIds.length > 0 ? backendIds[0] : localIds[0];
                bundleSelectEl.value = currentBundleId;
            }
        }

        loadOKFTree(currentBundleId);
    }

    // 3. LOAD OKF TREE EXPLORER
    async function loadOKFTree(bundleId) {
        const bId = bundleId || bundleSelectEl.value || currentBundleId;
        currentBundleId = bId;

        if (!bId || (!localBundles[bId] && !backendBundles[bId])) {
            okfBundleNameEl.textContent = 'Chưa chọn Bundle';
            docCountTextEl.textContent = '0 tài liệu OKF';
            treeContainerEl.innerHTML = `
                <div class="loading-state" style="flex-direction: column; text-align: center; gap: 12px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 32px; color: var(--accent-blue);"></i>
                    <span>Chưa có gói tri thức OKF nào được chọn.</span>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('importBundleModal').classList.remove('hidden')">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Import OKF Bundle Ngay
                    </button>
                </div>`;
            return;
        }

        const container = document.createElement('div');
        container.className = 'tree-nodes-list';
        treeContainerEl.innerHTML = '';

        // Common Tree Renderer
        let docCount = 0;
        function renderTree(items, parentEl, isBackend, bundleId, bundleObj) {
            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'tree-item';
                if (item.is_dir) {
                    el.classList.add('folder');
                    el.innerHTML = `<i class="fa-solid fa-folder"></i><span>${item.name}</span>`;
                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'tree-children hidden';
                    renderTree(item.children || [], childrenContainer, isBackend, bundleId, bundleObj);
                    
                    el.addEventListener('click', (e) => {
                        if (e.target !== el && e.target.parentElement !== el) return;
                        const isHidden = childrenContainer.classList.contains('hidden');
                        childrenContainer.classList.toggle('hidden');
                        el.querySelector('i').className = isHidden ? 'fa-solid fa-folder-open' : 'fa-solid fa-folder';
                    });
                    parentEl.appendChild(el);
                    parentEl.appendChild(childrenContainer);
                } else {
                    if (item.extension === '.md' || item.extension === '.json') docCount++;
                    el.innerHTML = `<i class="fa-solid fa-file-lines"></i><span>${item.name}</span>`;
                    el.addEventListener('click', () => {
                        if (isBackend) {
                            openFileModalBackend(bundleId, item.rel_path, item.name);
                        } else {
                            openFileModalContent(item.rel_path, bundleObj.files[item.rel_path]);
                        }
                    });
                    parentEl.appendChild(el);
                }
            });
        }

        if (backendBundles[bId]) {
            // BACKEND MODE TREE
            okfBundleNameEl.textContent = backendBundles[bId].name;
            try {
                const res = await fetch(`/api/okf/tree?bundle_id=${bId}`);
                const data = await res.json();
                
                renderTree(data.tree, container, true, bId, null);
                docCountTextEl.textContent = `${docCount} tài liệu OKF`;
                treeContainerEl.appendChild(container);
            } catch (err) {
                treeContainerEl.innerHTML = `<div class="loading-state" style="color: var(--accent-rose);">Lỗi tải cây thư mục từ Server: ${err.message}</div>`;
            }
        } else {
            // RAM MODE TREE
            const bundle = localBundles[bId];
            okfBundleNameEl.textContent = bundle.name;
            const fileKeys = Object.keys(bundle.files);
            
            // Build tree structure from flat paths
            const rootTree = [];
            fileKeys.forEach(path => {
                const parts = path.split('/');
                let currentLevel = rootTree;
                parts.forEach((part, index) => {
                    if (index === parts.length - 1) {
                        currentLevel.push({ name: part, is_dir: false, rel_path: path, extension: part.substring(part.lastIndexOf('.')) });
                    } else {
                        let existing = currentLevel.find(item => item.is_dir && item.name === part);
                        if (!existing) {
                            existing = { name: part, is_dir: true, children: [] };
                            currentLevel.push(existing);
                        }
                        currentLevel = existing.children;
                    }
                });
            });

            // Sort folders first
            function sortTree(nodes) {
                nodes.sort((a, b) => {
                    if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
                    return a.is_dir ? -1 : 1;
                });
                nodes.forEach(n => { if (n.is_dir) sortTree(n.children); });
            }
            sortTree(rootTree);

            renderTree(rootTree, container, false, bId, bundle);
            docCountTextEl.textContent = `${docCount} tài liệu OKF`;
            treeContainerEl.appendChild(container);
        }
    }

    // 4. OPEN FILE MODALS & PREVIEWS
    async function openFileModalBackend(bundleId, relPath, fileName) {
        modalFileNameEl.textContent = fileName || relPath;
        modalFileContentEl.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Đang tải nội dung từ Local Server...</span>
            </div>`;

        if (btnOpenNewTabEl) btnOpenNewTabEl.href = `/api/okf/raw?bundle_id=${bundleId}&path=${encodeURIComponent(relPath)}`;
        fileModalEl.classList.remove('hidden');
        isRawMode = false;
        if (btnToggleRawEl) btnToggleRawEl.innerHTML = '<i class="fa-solid fa-code"></i> Raw Code';

        try {
            const res = await fetch(`/api/okf/file?bundle_id=${bundleId}&path=${encodeURIComponent(relPath)}`);
            if (!res.ok) throw new Error('Không thể tải file');
            const data = await res.json();
            currentRawContent = data.content;
            renderModalBody();
        } catch (err) {
            modalFileContentEl.innerHTML = `<div style="color: var(--accent-rose);">Lỗi đọc file từ Server: ${err.message}</div>`;
        }
    }

    function openFileModalContent(fileName, content) {
        modalFileNameEl.textContent = fileName;
        currentRawContent = content;
        fileModalEl.classList.remove('hidden');
        isRawMode = false;
        if (btnToggleRawEl) btnToggleRawEl.innerHTML = '<i class="fa-solid fa-code"></i> Raw Code';
        renderModalBody();
    }

    function renderModalBody() {
        if (!currentRawContent) return;
        if (isRawMode) {
            modalFileContentEl.innerHTML = `<pre><code class="language-markdown">${escapeHtml(currentRawContent)}</code></pre>`;
            modalFileContentEl.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            let renderedHtml = window.marked ? marked.parse(currentRawContent) : escapeHtml(currentRawContent);
            modalFileContentEl.innerHTML = `<div class="markdown-body">${renderedHtml}</div>`;
            modalFileContentEl.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            if (window.mermaid) {
                try { mermaid.run(); } catch(e) {}
            }
        }
    }

    btnCopyMarkdownEl?.addEventListener('click', () => {
        if (!currentRawContent) return;
        navigator.clipboard.writeText(currentRawContent).then(() => {
            const origText = btnCopyMarkdownEl.innerHTML;
            btnCopyMarkdownEl.innerHTML = '<i class="fa-solid fa-check"></i> Đã Copy!';
            setTimeout(() => { btnCopyMarkdownEl.innerHTML = origText; }, 1500);
        });
    });

    btnToggleRawEl?.addEventListener('click', () => {
        isRawMode = !isRawMode;
        btnToggleRawEl.innerHTML = isRawMode ? '<i class="fa-solid fa-eye"></i> Rendered View' : '<i class="fa-solid fa-code"></i> Raw Code';
        renderModalBody();
    });

    // 5. CLIENT-SIDE OKF CONTEXT SEARCH & RETRIEVAL ENGINE (FROM BROWSER MEMORY)
    function buildOKFContextFromMemory(bundle, query) {
        if (!bundle || !bundle.files) return "Chưa nạp gói tri thức OKF nào.";

        const fileKeys = Object.keys(bundle.files);
        if (fileKeys.length === 0) return "Gói tri thức OKF trống.";

        const queryLower = query.toLowerCase();
        const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

        let selectedDocs = [];
        let totalLength = 0;
        const MAX_CONTEXT_BYTES = 300000; // Tăng lên 300KB (~75k tokens) để nạp trọn vẹn các bundle vừa/nhỏ

        // 1. Always prioritize index.md and root files
        fileKeys.forEach(filePath => {
            const lowerPath = filePath.toLowerCase();
            if (lowerPath.includes('index.md') || lowerPath.endsWith('readme.md')) {
                let content = bundle.files[filePath];
                if (content.length > 20000) content = content.substring(0, 20000) + '\n... [BỊ CẮT BỚT]';
                selectedDocs.push({ path: filePath, content: content, score: 100 });
                totalLength += content.length;
            }
        });

        // 2. Score remaining files based on keyword relevance
        const scoredDocs = [];
        fileKeys.forEach(filePath => {
            if (selectedDocs.some(d => d.path === filePath)) return;

            const content = bundle.files[filePath];
            const lowerContent = content.toLowerCase();
            const lowerPath = filePath.toLowerCase();

            let score = 0;
            keywords.forEach(kw => {
                if (lowerPath.includes(kw)) score += 25;
                const matches = (lowerContent.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                score += matches * 2;
            });

            if (score > 0) {
                let limitedContent = content;
                if (limitedContent.length > 15000) limitedContent = limitedContent.substring(0, 15000) + '\n... [BỊ CẮT BỚT]';
                scoredDocs.push({ path: filePath, content: limitedContent, score: score });
            }
        });

        scoredDocs.sort((a, b) => b.score - a.score);

        for (const doc of scoredDocs) {
            if (totalLength + doc.content.length > MAX_CONTEXT_BYTES) break;
            selectedDocs.push(doc);
            totalLength += doc.content.length;
        }

        // Fill up to limit if total bundle size is small
        if (selectedDocs.length < fileKeys.length && totalLength < MAX_CONTEXT_BYTES) {
            for (const filePath of fileKeys) {
                if (selectedDocs.some(d => d.path === filePath)) continue;
                let content = bundle.files[filePath];
                if (content.length > 10000) content = content.substring(0, 10000) + '\n... [BỊ CẮT BỚT]';
                if (totalLength + content.length > MAX_CONTEXT_BYTES) break;
                selectedDocs.push({ path: filePath, content: content, score: 1 });
                totalLength += content.length;
            }
        }

        return selectedDocs.map(d => `--- FILE: ${d.path} ---\n${d.content}`).join('\n\n');
    }

    // 6. DIRECT PROJECTNOW AI GATEWAY CALL WITH OKF CONTEXT
    async function sendMessage(textQuery) {
        const query = textQuery || chatInputEl.value.trim();
        if (!query || isStreaming) return;

        const welcomeBanner = chatMessagesEl.querySelector('.welcome-banner');
        if (welcomeBanner) welcomeBanner.remove();

        appendMessage('user', query);
        chatInputEl.value = '';
        chatInputEl.style.height = 'auto';

        const assistantMsgEl = appendMessage('assistant', '');
        const bubbleEl = assistantMsgEl.querySelector('.msg-bubble');
        bubbleEl.innerHTML = '<span class="typing-cursor"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang truy vấn dữ liệu OKF...</span>';

        isStreaming = true;
        btnSendEl.disabled = true;

        messageHistory.push({ role: 'user', content: query });

        const partnerKey = localStorage.getItem('projectnow_partner_key') || DEFAULT_PARTNER_KEY;
        const openrouterKey = localStorage.getItem('openrouter_api_key') || DEFAULT_OPENROUTER_KEY;
        const gatewayUrl = localStorage.getItem('projectnow_gateway_url') || DEFAULT_GATEWAY_URL;
        const selectedModel = modelSelectEl.value;

        // DUAL-MODE CONTEXT ROUTING
        let okfContext = '';
        let bundleName = 'Chưa chọn Bundle';

        if (backendBundles[currentBundleId]) {
            // MODE A: LOCAL BACKEND (RAG Top 6 Docs Search)
            bundleName = backendBundles[currentBundleId].name;
            try {
                const searchRes = await fetch('/api/okf/search_context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: query, bundle_id: currentBundleId, max_docs: 6 })
                });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    okfContext = searchData.context;
                } else {
                    throw new Error("Lỗi gọi Local RAG Engine");
                }
            } catch (err) {
                console.error("Local RAG Search failed:", err);
                okfContext = "Lỗi khi tìm kiếm dữ liệu trên Local Server.";
            }
        } else {
            // MODE B: SERVERLESS SPA (RAM 300KB Dump)
            const activeBundle = localBundles[currentBundleId];
            if (activeBundle) {
                bundleName = activeBundle.name;
                okfContext = buildOKFContextFromMemory(activeBundle, query);
            }
        }

        bubbleEl.innerHTML = '<span class="typing-cursor"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang phân tích và tạo câu trả lời qua AI Gateway...</span>';

        const systemPrompt = `Bạn là trợ lý AI chuyên gia phân tích và giải đáp dữ liệu dựa trên Giao thức Tri thức OKF (Open Knowledge Format) của Google.

DƯỚI ĐÂY LÀ NỘI DUNG TÀI LIỆU CỦA GÓI TRI THỨC OKF ĐANG ACTIVE ("${bundleName}") ĐƯỢC CHẮT LỌC VÀ CUNG CẤP:

==================== NỘI DUNG GÓI TRI THỨC OKF BẮT ĐẦU ====================
${okfContext}
==================== NỘI DUNG GÓI TRI THỨC OKF KẾT THÚC ====================

QUY TẮC PHẢN HỒI QUAN TRỌNG:
1. Hãy giải đáp câu hỏi của người dùng CHÍNH XÁC dựa vào thông tin có trong gói tri thức OKF ở trên.
2. Nêu rõ tên file tài liệu OKF tương ứng khi trích dẫn thông tin (ví dụ: "Theo tài liệu \`repos/gitlab-analytics/index.md\`...").
3. Trình bày phản hồi chuyên nghiệp, đẹp mắt bằng Markdown, bảng biểu và khối mã code (nếu có).`;

        const payloadMessages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...messageHistory
        ];

        const reqHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${partnerKey}`
        };
        
        const useCloudGateway = localStorage.getItem('use_cloud_gateway') === 'true';
        if (isLocalMode && useCloudGateway) {
            reqHeaders['x-use-cloud-gateway'] = 'true';
            reqHeaders['x-partner-key'] = partnerKey;
            reqHeaders['x-gateway-url'] = gatewayUrl;
        }

        if (isLocalMode && !useCloudGateway) {
            reqHeaders['Authorization'] = `Bearer ${openrouterKey}`;
        }

        const requestBody = {
            model: selectedModel,
            messages: payloadMessages,
            temperature: 0.3,
            stream: true,
            openrouter_api_key: openrouterKey,
            api_key: openrouterKey
        };

        if (openrouterKey) {
            requestBody.openrouter_api_key = openrouterKey;
            requestBody.api_key = openrouterKey;
        }

        try {
            // DUAL-MODE GATEWAY ROUTING
            const targetEndpoint = (isLocalMode && backendBundles[currentBundleId]) ? '/api/ai-gateway' : gatewayUrl;

            const response = await fetch(targetEndpoint, {
                method: 'POST',
                headers: reqHeaders,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                let errText = `Lỗi HTTP ${response.status}`;
                if (errData.error) {
                    if (typeof errData.error === 'string') errText = errData.error;
                    else if (errData.error.message) errText = errData.error.message;
                } else if (errData.message) {
                    errText = errData.message;
                } else if (errData.detail) {
                    errText = errData.detail;
                }
                throw new Error(errText);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullResponseText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last partial line in the buffer
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.trim() === 'data: [DONE]') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const content = data.choices?.[0]?.delta?.content || '';
                            fullResponseText += content;
                            
                            // Streaming update UI
                            renderMarkdown(bubbleEl, fullResponseText);
                            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
                        } catch (e) {
                            console.warn("Lỗi parse SSE chunk:", e, line);
                        }
                    }
                }
            }

            // Flush remaining buffer if it's a valid JSON block without 'data: ' prefix
            if (buffer.trim().startsWith('{')) {
                try {
                     const data = JSON.parse(buffer);
                     if (data.content || (data.choices && data.choices[0].message.content)) {
                         fullResponseText = data.content || data.choices[0].message.content;
                         renderMarkdown(bubbleEl, fullResponseText);
                     }
                } catch(e) {}
            }

            messageHistory.push({ role: 'assistant', content: fullResponseText });

        } catch (err) {
            bubbleEl.innerHTML = `<span style="color: var(--accent-rose);"><i class="fa-solid fa-circle-exclamation"></i> Lỗi Gateway: ${err.message}</span>`;
        } finally {
            isStreaming = false;
            btnSendEl.disabled = false;
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
    }

    function renderMarkdown(element, text) {
        if (window.marked) {
            element.innerHTML = marked.parse(text);
            element.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            element.textContent = text;
        }
    }

    function appendMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        if (role === 'user') {
            bubble.textContent = text;
        } else {
            renderMarkdown(bubble, text);
        }

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
        chatMessagesEl.appendChild(wrapper);

        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        return wrapper;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // 6. IMPORT BUNDLE (CLIENT-SIDE JSZIP EXTRACTION)
    btnHeaderImportEl?.addEventListener('click', () => importBundleModalEl.classList.remove('hidden'));
    btnCloseImportModalEl?.addEventListener('click', () => importBundleModalEl.classList.add('hidden'));

    tabZipBtn?.addEventListener('click', () => {
        tabZipBtn.classList.add('active');
        tabPathBtn.classList.remove('active');
        tabZipContent.classList.remove('hidden');
        tabPathContent.classList.add('hidden');
    });

    tabPathBtn?.addEventListener('click', () => {
        tabPathBtn.classList.add('active');
        tabZipBtn.classList.remove('active');
        tabPathContent.classList.remove('hidden');
        tabZipContent.classList.add('hidden');
    });

    // Handle Client-Side ZIP File Extraction
    btnSubmitZip?.addEventListener('click', async () => {
        const name = document.getElementById('bundleZipName').value.trim();
        const fileInput = document.getElementById('bundleZipFile');
        if (!name || !fileInput.files[0]) {
            showImportStatus('Vui lòng nhập tên bundle và chọn file ZIP.', 'rose');
            return;
        }

        if (!window.JSZip) {
            showImportStatus('Thư viện JSZip chưa sẵn sàng.', 'rose');
            return;
        }

        showImportStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Đang giải nén file ZIP trong trình duyệt...', 'blue');

        try {
            const zip = await JSZip.loadAsync(fileInput.files[0]);
            const bundleId = 'bundle_' + Date.now();
            const extractedFiles = {};

            const promises = [];
            zip.forEach((relPath, fileObj) => {
                if (!fileObj.dir && (relPath.endsWith('.md') || relPath.endsWith('.json') || relPath.endsWith('.txt'))) {
                    promises.push(
                        fileObj.async('string').then(content => {
                            extractedFiles[relPath] = content;
                        })
                    );
                }
            });

            await Promise.all(promises);

            localBundles[bundleId] = {
                id: bundleId,
                name: name,
                files: extractedFiles
            };

            await saveBundle(bundleId, localBundles[bundleId]);
            currentBundleId = bundleId;

            showImportStatus(`Đã nạp thành công ${Object.keys(extractedFiles).length} tài liệu OKF!`, 'emerald');
            setTimeout(() => {
                importBundleModalEl.classList.add('hidden');
                importStatusEl.classList.add('hidden');
                loadBundlesList();
            }, 1200);

        } catch (err) {
            showImportStatus(`Lỗi giải nén ZIP: ${err.message}`, 'rose');
        }
    });
    btnSubmitLocalPath?.addEventListener('click', async () => {
        const name = document.getElementById('bundlePathName').value.trim();
        const localPath = document.getElementById('bundleLocalPath')?.value.trim();
        
        if (!name || !localPath) {
            showImportStatus('Vui lòng nhập tên bundle và đường dẫn ổ cứng (Local Path).', 'rose');
            return;
        }

        showImportStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Đang đăng ký thư mục local với máy chủ...', 'blue');
        try {
            const res = await fetch('/api/bundles/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, path: localPath })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.error || 'Không thể mở thư mục local');

            showImportStatus(data.message || 'Đã đăng ký trực tiếp thư mục local thành công!', 'emerald');
            setTimeout(() => {
                importBundleModalEl.classList.add('hidden');
                importStatusEl.classList.add('hidden');
                // Refresh backend bundles
                initializeMode(); 
            }, 1200);
        } catch (err) {
            showImportStatus(`Lỗi đăng ký Local Path: ${err.message}`, 'rose');
        }
    });
    btnSubmitPath?.addEventListener('click', async () => {
        const name = document.getElementById('bundlePathName').value.trim();
        const folderInput = document.getElementById('bundleFolderInput');
        
        if (!name) {
            showImportStatus('Vui lòng nhập tên gói tri thức OKF.', 'rose');
            return;
        }

        const localPath = document.getElementById('bundleLocalPath')?.value.trim();
        if (isLocalMode && localPath && (!folderInput.files || folderInput.files.length === 0)) {
            // Fallback for UX: if user fills local path but clicks the wrong big blue button
            btnSubmitLocalPath?.click();
            return;
        }

        // Mode B: Client Browser Directory Picker (Pure SPA)
        if (folderInput && folderInput.files && folderInput.files.length > 0) {
            showImportStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Đang chỉ mục thư mục local...', 'blue');
            try {
                const bundleId = 'bundle_' + Date.now();
                const extractedFiles = {};

                const fileArray = Array.from(folderInput.files);
                const readPromises = fileArray.map(file => {
                    const relPath = file.webkitRelativePath || file.name;
                    if (relPath.endsWith('.md') || relPath.endsWith('.json') || relPath.endsWith('.txt')) {
                        return file.text().then(text => {
                            const cleanPath = relPath.includes('/') ? relPath.substring(relPath.indexOf('/') + 1) : relPath;
                            extractedFiles[cleanPath] = text;
                        });
                    }
                    return Promise.resolve();
                });

                await Promise.all(readPromises);

                localBundles[bundleId] = {
                    id: bundleId,
                    name: name,
                    files: extractedFiles
                };

                await saveBundle(bundleId, localBundles[bundleId]);
                currentBundleId = bundleId;

                showImportStatus(`Đã nạp thành công thư mục local với ${Object.keys(extractedFiles).length} tài liệu OKF!`, 'emerald');
                setTimeout(() => {
                    importBundleModalEl.classList.add('hidden');
                    importStatusEl.classList.add('hidden');
                    loadBundlesList();
                }, 1200);

            } catch (err) {
                showImportStatus(`Lỗi đọc thư mục: ${err.message}`, 'rose');
            }
        } else {
            showImportStatus('Vui lòng chọn thư mục từ máy tính.', 'rose');
        }
    });

    function showImportStatus(msg, color) {
        importStatusEl.innerHTML = msg;
        importStatusEl.style.color = `var(--accent-${color})`;
        importStatusEl.classList.remove('hidden');
    }

    // Event Listeners
    bundleSelectEl?.addEventListener('change', (e) => {
        currentBundleId = e.target.value;
        loadOKFTree(currentBundleId);
    });

    btnSendEl?.addEventListener('click', () => sendMessage());

    chatInputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatInputEl?.addEventListener('input', () => {
        chatInputEl.style.height = 'auto';
        chatInputEl.style.height = Math.min(chatInputEl.scrollHeight, 150) + 'px';
    });

    btnClearChatEl?.addEventListener('click', () => {
        messageHistory = [];
        chatMessagesEl.innerHTML = `
            <div class="welcome-banner">
                <div class="banner-icon"><i class="fa-solid fa-comments"></i></div>
                <h2>Đã xóa lịch sử chat</h2>
                <p>Bắt đầu cuộc trò chuyện mới với AI Gateway.</p>
            </div>`;
    });

    document.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (pill) {
            const query = pill.getAttribute('data-query');
            if (query) sendMessage(query);
        }
    });

    btnSettingsEl?.addEventListener('click', () => settingsModalEl.classList.remove('hidden'));
    btnCloseSettingsEl?.addEventListener('click', () => settingsModalEl.classList.add('hidden'));
    btnCloseModalEl?.addEventListener('click', () => fileModalEl.classList.add('hidden'));
    btnReloadTreeEl?.addEventListener('click', () => loadOKFTree(currentBundleId));

    treeSearchInputEl?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = treeContainerEl.querySelectorAll('.tree-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });

    btnSaveSettingsEl?.addEventListener('click', () => {
        const partnerKey = partnerKeyInputEl ? partnerKeyInputEl.value.trim() : '';
        const openrouterKey = apiKeyInputEl ? apiKeyInputEl.value.trim() : '';
        const gatewayUrl = gatewayUrlInputEl ? gatewayUrlInputEl.value.trim() : '';
        const useCloud = useCloudGatewayInputEl ? useCloudGatewayInputEl.checked : false;

        if (partnerKey) localStorage.setItem('projectnow_partner_key', partnerKey);
        else localStorage.removeItem('projectnow_partner_key');

        if (openrouterKey) localStorage.setItem('openrouter_api_key', openrouterKey);
        else localStorage.removeItem('openrouter_api_key');

        if (gatewayUrl) localStorage.setItem('projectnow_gateway_url', gatewayUrl);
        else localStorage.removeItem('projectnow_gateway_url');
        
        localStorage.setItem('use_cloud_gateway', useCloud ? 'true' : 'false');

        settingsModalEl.classList.add('hidden');
        checkHealth();
    });

    // Startup Initializations
    initializeMode();
});
