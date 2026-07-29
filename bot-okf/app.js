document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let messageHistory = [];
    let isStreaming = false;
    let currentBundleId = 'ga-okf';
    let currentRawContent = '';
    let isRawMode = false;

    // Custom In-Memory & LocalStorage Bundles Store
    let localBundles = JSON.parse(localStorage.getItem('okf_custom_bundles') || '{}');

    // DOM Elements
    const apiKeyStatusEl = document.getElementById('apiKeyStatus');
    const modelSelectEl = document.getElementById('modelSelect');
    const btnSettingsEl = document.getElementById('btnSettings');
    const settingsModalEl = document.getElementById('settingsModal');
    const btnCloseSettingsEl = document.getElementById('btnCloseSettings');
    const apiKeyInputEl = document.getElementById('apiKeyInput');
    const partnerKeyInputEl = document.getElementById('partnerKeyInput');
    const gatewayUrlInputEl = document.getElementById('gatewayUrlInput');
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

    // Default Gateway Keys
    const DEFAULT_PARTNER_KEY = 'pj_live_89f0039b1111c8e0bfeb07cb87d9da7a';
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

    // 1. HEALTH CHECK & STATUS
    function checkHealth() {
        const partnerKey = localStorage.getItem('projectnow_partner_key') || DEFAULT_PARTNER_KEY;
        const openrouterKey = localStorage.getItem('openrouter_api_key') || DEFAULT_OPENROUTER_KEY;
        
        if (partnerKey && openrouterKey) {
            apiKeyStatusEl.querySelector('.dot').className = 'dot green';
            apiKeyStatusEl.querySelector('.status-label').textContent = 'ProjectNow Gateway Live';
        } else {
            apiKeyStatusEl.querySelector('.dot').className = 'dot yellow';
            apiKeyStatusEl.querySelector('.status-label').textContent = 'Chưa nhập OpenRouter Key';
        }
    }

    // 2. LOAD BUNDLES LIST
    function loadBundlesList() {
        bundleSelectEl.innerHTML = '';
        
        // 1. Default static bundle
        const defaultOpt = document.createElement('option');
        defaultOpt.value = 'ga-okf';
        defaultOpt.textContent = 'Google OKF Default Bundle (ga-okf)';
        if (currentBundleId === 'ga-okf') defaultOpt.selected = true;
        bundleSelectEl.appendChild(defaultOpt);

        // 2. Custom Imported Bundles from LocalStorage
        Object.keys(localBundles).forEach(bId => {
            const opt = document.createElement('option');
            opt.value = bId;
            opt.textContent = `${localBundles[bId].name} (${Object.keys(localBundles[bId].files).length} docs)`;
            if (bId === currentBundleId) opt.selected = true;
            bundleSelectEl.appendChild(opt);
        });

        loadOKFTree(currentBundleId);
    }

    // 3. LOAD OKF TREE EXPLORER
    async function loadOKFTree(bundleId) {
        const bId = bundleId || bundleSelectEl.value || currentBundleId;
        currentBundleId = bId;

        treeContainerEl.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Đang nạp cây thư mục OKF...</span>
            </div>`;

        if (bId === 'ga-okf') {
            okfBundleNameEl.textContent = 'ga-okf';
            docCountTextEl.textContent = '81 tài liệu OKF';

            treeContainerEl.innerHTML = `
                <div class="tree-nodes-list">
                    <div class="tree-item" data-file="./ga-okf/index.md"><i class="fa-solid fa-file-lines"></i><span>index.md</span></div>
                    <div class="tree-item" data-file="./ga-okf/log.md"><i class="fa-solid fa-file-lines"></i><span>log.md</span></div>
                    <div class="tree-item"><i class="fa-solid fa-folder"></i><span>repos/gitlab-analytics</span></div>
                    <div class="tree-node">
                        <div class="tree-item" data-file="./ga-okf/repos/gitlab-analytics/index.md"><i class="fa-solid fa-file-lines"></i><span>index.md</span></div>
                        <div class="tree-item"><i class="fa-solid fa-folder"></i><span>architecture</span></div>
                        <div class="tree-node">
                            <div class="tree-item" data-file="./ga-okf/repos/gitlab-analytics/architecture/api_surface.md"><i class="fa-solid fa-file-lines"></i><span>api_surface.md</span></div>
                            <div class="tree-item" data-file="./ga-okf/repos/gitlab-analytics/architecture/dependencies.md"><i class="fa-solid fa-file-lines"></i><span>dependencies.md</span></div>
                        </div>
                        <div class="tree-item"><i class="fa-solid fa-folder"></i><span>governance</span></div>
                        <div class="tree-node">
                            <div class="tree-item" data-file="./ga-okf/repos/gitlab-analytics/governance/index.md"><i class="fa-solid fa-file-lines"></i><span>governance/index.md</span></div>
                        </div>
                    </div>
                </div>`;

            treeContainerEl.querySelectorAll('.tree-item[data-file]').forEach(item => {
                item.addEventListener('click', () => {
                    const filePath = item.getAttribute('data-file');
                    openFileModalStatic(filePath, item.textContent);
                });
            });
        } else if (localBundles[bId]) {
            const bundle = localBundles[bId];
            okfBundleNameEl.textContent = bundle.name;
            const fileKeys = Object.keys(bundle.files);
            docCountTextEl.textContent = `${fileKeys.length} tài liệu OKF`;

            const container = document.createElement('div');
            container.className = 'tree-nodes-list';

            fileKeys.forEach(fPath => {
                const itemEl = document.createElement('div');
                itemEl.className = 'tree-item';
                itemEl.innerHTML = `<i class="fa-solid fa-file-lines"></i><span>${fPath}</span>`;
                itemEl.addEventListener('click', () => {
                    openFileModalContent(fPath, bundle.files[fPath]);
                });
                container.appendChild(itemEl);
            });

            treeContainerEl.innerHTML = '';
            treeContainerEl.appendChild(container);
        }
    }

    // 4. OPEN FILE MODALS & PREVIEWS
    async function openFileModalStatic(filePath, fileName) {
        modalFileNameEl.textContent = fileName;
        modalFileContentEl.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Đang đọc tài liệu: ${fileName}...</span>
            </div>`;

        if (btnOpenNewTabEl) btnOpenNewTabEl.href = filePath;
        fileModalEl.classList.remove('hidden');
        isRawMode = false;
        if (btnToggleRawEl) btnToggleRawEl.innerHTML = '<i class="fa-solid fa-code"></i> Raw Code';

        try {
            const res = await fetch(filePath);
            if (!res.ok) throw new Error('Không thể tải file');
            currentRawContent = await res.text();
            renderModalBody();
        } catch (err) {
            modalFileContentEl.innerHTML = `<div style="color: var(--accent-rose);">Lỗi đọc file: ${err.message}</div>`;
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

    // 5. DIRECT CALL TO PROJECTNOW AI GATEWAY
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
        bubbleEl.innerHTML = '<span class="typing-cursor"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang kết nối ProjectNow AI Gateway...</span>';

        isStreaming = true;
        btnSendEl.disabled = true;

        messageHistory.push({ role: 'user', content: query });

        const partnerKey = localStorage.getItem('projectnow_partner_key') || DEFAULT_PARTNER_KEY;
        const openrouterKey = localStorage.getItem('openrouter_api_key') || DEFAULT_OPENROUTER_KEY;
        const gatewayUrl = localStorage.getItem('projectnow_gateway_url') || DEFAULT_GATEWAY_URL;
        const selectedModel = modelSelectEl.value;

        const payloadMessages = [
            {
                role: 'system',
                content: 'Bạn là trợ lý AI chuyên gia giải đáp dữ liệu dựa trên Giao thức Tri thức OKF (Open Knowledge Format) của Google.'
            },
            ...messageHistory
        ];

        try {
            const response = await fetch(gatewayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${partnerKey}`,
                    'x-openrouter-api-key': openrouterKey
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: payloadMessages,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || errData.message || errData.detail || `Lỗi HTTP ${response.status}`);
            }

            const data = await response.json();
            const fullResponseText = data.content || data.choices?.[0]?.message?.content || JSON.stringify(data);

            renderMarkdown(bubbleEl, fullResponseText);
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

            localStorage.setItem('okf_custom_bundles', JSON.stringify(localBundles));
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

    btnSubmitPath?.addEventListener('click', async () => {
        const name = document.getElementById('bundlePathName').value.trim();
        const folderInput = document.getElementById('bundleFolderInput');
        
        if (!name || !folderInput || !folderInput.files || folderInput.files.length === 0) {
            showImportStatus('Vui lòng nhập tên bundle và chọn thư mục local.', 'rose');
            return;
        }

        showImportStatus('<i class="fa-solid fa-circle-notch fa-spin"></i> Đang quét và chỉ mục thư mục local...', 'blue');

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

            localStorage.setItem('okf_custom_bundles', JSON.stringify(localBundles));
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

        if (partnerKey) localStorage.setItem('projectnow_partner_key', partnerKey);
        else localStorage.removeItem('projectnow_partner_key');

        if (openrouterKey) localStorage.setItem('openrouter_api_key', openrouterKey);
        else localStorage.removeItem('openrouter_api_key');

        if (gatewayUrl) localStorage.setItem('projectnow_gateway_url', gatewayUrl);
        else localStorage.removeItem('projectnow_gateway_url');

        settingsModalEl.classList.add('hidden');
        checkHealth();
    });

    // Startup Initializations
    checkHealth();
    loadBundlesList();
});
