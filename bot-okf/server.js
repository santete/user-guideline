const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const ROOT_DIR = __dirname;
const OKF_DIR = path.join(ROOT_DIR, 'ga-okf');
const BUNDLES_DIR = path.join(ROOT_DIR, 'bundles');

// Default API Credentials
const DEFAULT_PARTNER_KEY = 'pj_live_98244722e4273d34e015b82d279e5867';
const DEFAULT_OPENROUTER_KEY = '';
const PROJECTNOW_GATEWAY_URL = 'https://mygkmiofmbhnxzrvrqml.supabase.co/functions/v1/ai-gateway';

// Dynamic Bundle Registry
const bundles = {};
let activeBundleId = '';

function scanBundles() {
    // Thêm ga-okf nếu tồn tại
    if (fs.existsSync(OKF_DIR)) {
        bundles['ga-okf'] = { id: 'ga-okf', name: 'Google OKF Default Bundle (ga-okf)', path: OKF_DIR };
        if (!activeBundleId) activeBundleId = 'ga-okf';
    } else {
        delete bundles['ga-okf'];
    }

    if (fs.existsSync(BUNDLES_DIR)) {
        const entries = fs.readdirSync(BUNDLES_DIR);
        entries.forEach(entry => {
            const fullPath = path.join(BUNDLES_DIR, entry);
            if (fs.statSync(fullPath).isDirectory()) {
                const bId = entry.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                bundles[bId] = {
                    id: bId,
                    name: entry.replace(/_/g, ' ').toUpperCase(),
                    path: fullPath
                };
                if (!activeBundleId) activeBundleId = bId;
            }
        });
    }
}
scanBundles();

function getTree(dirPath, rootDir) {
    const items = [];
    if (!fs.existsSync(dirPath)) return items;

    const entries = fs.readdirSync(dirPath).sort();
    entries.forEach(entry => {
        if (entry.startsWith('.')) return;
        const fullPath = path.join(dirPath, entry);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            items.append?.({ name: entry, rel_path: relPath, is_dir: true, children: getTree(fullPath, rootDir) }) ||
            items.push({ name: entry, rel_path: relPath, is_dir: true, children: getTree(fullPath, rootDir) });
        } else {
            items.push({ name: entry, rel_path: relPath, is_dir: false, size: stat.size, extension: path.extname(entry).toLowerCase() });
        }
    });
    return items;
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Enable CORS for local testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-openrouter-api-key');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. LOCAL AI GATEWAY ENDPOINT (Direct OpenRouter Stream)
    if (pathname === '/api/ai-gateway' && req.method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', async () => {
            try {
                const bodyJson = JSON.parse(bodyStr || '{}');
                const openrouterKey = req.headers['x-openrouter-api-key'] || bodyJson.openrouter_api_key || bodyJson.api_key || DEFAULT_OPENROUTER_KEY;
                
                if (!openrouterKey) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Chưa cấu hình OpenRouter API Key. Vui lòng mở mục "Cài đặt" (Settings) trên giao diện để nhập Key.' }));
                    return;
                }

                const useCloud = req.headers['x-use-cloud-gateway'] === 'true';
                const partnerKey = req.headers['x-partner-key'] || DEFAULT_PARTNER_KEY;
                const gatewayUrl = req.headers['x-gateway-url'] || PROJECTNOW_GATEWAY_URL;

                // Force stream to true
                bodyJson.stream = true;

                let targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
                let headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openrouterKey}`,
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'OKF Local RAG'
                };

                if (useCloud) {
                    targetUrl = gatewayUrl;
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${partnerKey}`
                    };
                    bodyJson.openrouter_api_key = openrouterKey;
                    bodyJson.api_key = openrouterKey;
                    console.log(`[Node Server] Relaying request through Cloud Gateway: ${targetUrl}`);
                } else {
                    console.log(`[Node Server] Streaming AI Request model=${bodyJson.model} directly from OpenRouter...`);
                }

                const upstreamRes = await fetch(targetUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(bodyJson)
                });

                if (!upstreamRes.ok) {
                    const err = await upstreamRes.text();
                    res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json' });
                    res.end(err);
                    return;
                }

                // Forward headers for SSE stream
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });

                if (upstreamRes.body) {
                    const reader = upstreamRes.body.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        res.write(Buffer.from(value));
                    }
                }
                res.end();
            } catch (err) {
                console.error('[Node Server Error]', err);
                const detailMsg = err.cause ? ` (${err.cause.message || err.cause})` : '';
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message + detailMsg }));
            }
        });
        return;
    }

    // 2. BUNDLES APIS
    if (pathname === '/api/bundles' && req.method === 'GET') {
        scanBundles();
        const bundleList = Object.values(bundles).map(b => ({
            bundle_id: b.id,
            name: b.name,
            root_dir: b.path,
            is_active: (b.id === activeBundleId)
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ active_bundle_id: activeBundleId, bundles: bundleList }));
        return;
    }

    if (pathname === '/api/bundles/select' && req.method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', () => {
            try {
                const body = JSON.parse(bodyStr);
                if (bundles[body.bundle_id]) {
                    activeBundleId = body.bundle_id;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Active bundle updated', active_bundle_id: activeBundleId }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bundle not found' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/bundles/register' && req.method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', () => {
            try {
                const body = JSON.parse(bodyStr);
                const localPath = path.resolve(body.path);
                if (!fs.existsSync(localPath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ detail: `Thư mục '${body.path}' không tồn tại` }));
                    return;
                }
                const bId = body.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                bundles[bId] = { id: bId, name: body.name, path: localPath };
                activeBundleId = bId;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: `Đã đăng ký bundle '${body.name}' thành công!`, bundle_id: bId }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ detail: e.message }));
            }
        });
        return;
    }

    // 3. OKF TREE API
    if (pathname === '/api/okf/tree' && req.method === 'GET') {
        const targetId = parsedUrl.query.bundle_id || activeBundleId;
        const targetBundle = bundles[targetId] || bundles['ga-okf'];
        const treeData = getTree(targetBundle.path, targetBundle.path);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            bundle_id: targetBundle.id,
            bundle_name: targetBundle.name,
            tree: treeData
        }));
        return;
    }

    // 4. OKF FILE READ API
    if ((pathname === '/api/okf/file' || pathname === '/api/okf/raw') && req.method === 'GET') {
        const targetId = parsedUrl.query.bundle_id || activeBundleId;
        const relPath = parsedUrl.query.path || '';
        const targetBundle = bundles[targetId] || bundles['ga-okf'];

        const fullPath = path.resolve(path.join(targetBundle.path, relPath));
        if (!fullPath.startsWith(targetBundle.path) || !fs.existsSync(fullPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'File not found' }));
            return;
        }

        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        if (pathname === '/api/okf/raw') {
            res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
            res.end(fileContent);
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ rel_path: relPath, content: fileContent }));
        }
        return;
    }

    // 4.5. OKF SEARCH CONTEXT API (LOCAL RAG ENGINE)
    if (pathname === '/api/okf/search_context' && req.method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', () => {
            try {
                const body = JSON.parse(bodyStr);
                const query = (body.query || '').toLowerCase();
                const targetId = body.bundle_id || activeBundleId;
                const targetBundle = bundles[targetId] || bundles['ga-okf'];
                const maxDocs = body.max_docs || 6;

                if (!targetBundle || !fs.existsSync(targetBundle.path)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bundle not found' }));
                    return;
                }

                // Recursive file scan
                const documents = [];
                function scanFiles(dir) {
                    const entries = fs.readdirSync(dir);
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry);
                        if (fs.statSync(fullPath).isDirectory()) {
                            scanFiles(fullPath);
                        } else if (entry.endsWith('.md')) {
                            const relPath = path.relative(targetBundle.path, fullPath).replace(/\\/g, '/');
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            documents.push({ filename: entry, rel_path: relPath, content: content });
                        }
                    }
                }
                scanFiles(targetBundle.path);

                const keywords = query.split(/\s+/).filter(w => w.length > 2);
                let scoredDocs = [];

                if (keywords.length === 0) {
                    scoredDocs = documents.slice(0, maxDocs);
                } else {
                    documents.forEach(doc => {
                        let score = 0;
                        const contentLower = doc.content.toLowerCase();
                        const relLower = doc.rel_path.toLowerCase();
                        const nameLower = doc.filename.toLowerCase();

                        keywords.forEach(kw => {
                            if (nameLower.includes(kw)) score += 10;
                            if (relLower.includes(kw)) score += 5;
                            const matches = (contentLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                            score += Math.min(matches, 15);
                        });

                        if (nameLower === 'index.md') score += 3;
                        if (score > 0) scoredDocs.push({ score, doc });
                    });

                    scoredDocs.sort((a, b) => b.score - a.score);
                    scoredDocs = scoredDocs.slice(0, maxDocs).map(item => item.doc);
                }

                if (scoredDocs.length === 0) {
                    const indexDoc = documents.find(d => d.filename === 'index.md');
                    if (indexDoc) scoredDocs.push(indexDoc);
                    else scoredDocs = documents.slice(0, maxDocs);
                }

                const MAX_TOTAL_CHARS = 50000;
                const MAX_DOC_CHARS = 15000;

                let contextText = `### BỘ TRI THỨC OKF ĐƯỢC NẠP: \`${targetBundle.name}\`\n\n`;
                const citations = [];
                for (const doc of scoredDocs) {
                    if (contextText.length > MAX_TOTAL_CHARS) break;
                    let content = doc.content;
                    if (content.length > MAX_DOC_CHARS) {
                        content = content.substring(0, MAX_DOC_CHARS) + '\n... [NỘI DUNG ĐÃ BỊ CẮT BỚT DO QUÁ DÀI] ...';
                    }
                    contextText += `--- BẮT ĐẦU TÀI LIỆU: \`${doc.rel_path}\` ---\n${content}\n--- KẾT THÚC TÀI LIỆU: \`${doc.rel_path}\` ---\n\n`;
                    citations.push({ path: doc.rel_path });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ context: contextText, citations: citations }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // 5. STATIC FILES SERVING
    let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(ROOT_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 ProjectNow OKF Node.js Gateway running!`);
    console.log(`🌐 Open in browser: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
