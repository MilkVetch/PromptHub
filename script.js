let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
let currentModalIndex = -1;
let draggedItemIndex = null;
let touchTimer = null;

const elements = {
    listContainer: document.getElementById('list-container'),
    searchBar: document.getElementById('search-bar'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    statusBar: document.getElementById('status-bar')
};

window.onload = () => {
    // 自动填充配置输入框，让用户能看到
    document.getElementById('gh-token').value = config.token || '';
    document.getElementById('gist-id').value = config.gistId || '';
    
    if (config.token && config.gistId) fetchData();
    else document.getElementById('config-section').classList.remove('hidden');
};

function toggleConfig() {
    document.getElementById('config-section').classList.toggle('hidden');
}

// ===========================
// 增强：分类重命名
// ===========================
function renameCategory(oldName) {
    const newName = prompt(`将分类 [${oldName}] 修改为:`, oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        prompts.forEach(p => {
            if ((p.category || "未分类") === oldName) p.category = newName.trim();
        });
        render(); pushData();
    }
}

// ===========================
// 渲染逻辑
// ===========================
function render(filter = "") {
    elements.listContainer.innerHTML = '';
    const filtered = prompts.filter(p => 
        p.title.toLowerCase().includes(filter) || p.content.toLowerCase().includes(filter)
    );

    const cats = [...new Set(prompts.map(p => p.category || "未分类"))];
    document.getElementById('category-suggestions').innerHTML = cats.map(c => `<option value="${c}">`).join('');

    let hasVisible = false;

    cats.forEach(cat => {
        const catItems = filtered.filter(p => (p.category || "未分类") === cat);
        if (catItems.length === 0) return;
        hasVisible = true;

        const section = document.createElement('div');
        section.className = "mb-12 animate-scale-in";
        section.innerHTML = `
            <div class="category-header">
                <span class="text-[#ff9900] font-black tracking-widest text-sm uppercase">${cat}</span>
                <button onclick="renameCategory('${cat}')" class="btn-edit-cat">RENAME</button>
                <span class="text-zinc-800 text-[10px] font-black ml-auto">${catItems.length} ITEMS</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-grid" data-category="${cat}"></div>
        `;

        const grid = section.querySelector('.list-grid');
        catItems.forEach(p => {
            const realIdx = prompts.indexOf(p);
            const card = document.createElement('div');
            card.className = 'title-card bg-[#111] p-7 rounded-[1.5rem] border border-zinc-900 hover:border-[#ff9900]/50 shadow-lg flex flex-col justify-between group';
            card.dataset.index = realIdx;

            if (filter === "") {
                card.draggable = true;
                bindDragEvents(card, realIdx);
                bindTouchEvents(card, realIdx);
            }

            card.innerHTML = `
                <div class="cursor-pointer overflow-hidden mb-4" onclick="openViewModal(${realIdx})">
                    <h3 class="font-black text-zinc-100 group-hover:text-[#ff9900] text-lg leading-tight truncate transition-colors">${p.title}</h3>
                </div>
                <div class="flex justify-between items-center mt-auto">
                    <span class="text-[9px] font-black text-zinc-700 uppercase tracking-widest">Prompt Card</span>
                    <div class="text-zinc-800 group-hover:text-[#ff9900] transition-colors">
                        <svg width="20" height="20" fill="currentColor"><circle cx="6" cy="6" r="1.5"/><circle cx="14" cy="6" r="1.5"/><circle cx="6" cy="14" r="1.5"/><circle cx="14" cy="14" r="1.5"/></svg>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        elements.listContainer.appendChild(section);
    });
    document.getElementById('empty-state').classList.toggle('hidden', hasVisible);
}

// ===========================
// 核心：二维插入检测 (PC端+移动端适配)
// ===========================
function bindDragEvents(el, index) {
    el.ondragstart = (e) => {
        draggedItemIndex = index;
        setTimeout(() => el.classList.add('dragging'), 0);
    };
    el.ondragend = () => {
        el.classList.remove('dragging');
        clearDropIndicators();
    };
    el.ondragover = (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const midY = rect.top + rect.height / 2;
        
        clearDropIndicators();
        
        // 同时判断 X 和 Y 轴
        // 如果是窄屏（单列），Y 轴逻辑占主导；宽屏下，X 轴决定前后
        const isLeft = e.clientX < midX;
        const isAbove = e.clientY < midY;
        
        // 视觉反馈优化：在宽屏下侧重显示左右线条，在窄屏下显示上下线条
        if (window.innerWidth > 640) {
            el.classList.add(isLeft ? 'drop-target-left' : 'drop-target-right');
        } else {
            el.classList.add(isAbove ? 'drop-target-above' : 'drop-target-below');
        }
    };
    el.ondrop = (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        // 只要是在左侧或者上方，都视为“插入其前”
        const isBefore = (e.clientX < rect.left + rect.width / 2) || (e.clientY < rect.top + rect.height / 2);
        handleMove(draggedItemIndex, index, isBefore);
    };
}

function bindTouchEvents(el, index) {
    el.ontouchstart = () => {
        touchTimer = setTimeout(() => {
            draggedItemIndex = index;
            el.classList.add('dragging');
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600);
    };
    el.ontouchend = () => clearTimeout(touchTimer);
}

function clearDropIndicators() {
    document.querySelectorAll('.title-card').forEach(c => {
        c.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-left', 'drop-target-right');
    });
}

async function handleMove(fromIdx, toIdx, isBefore) {
    if (fromIdx === toIdx) return;
    const source = prompts[fromIdx];
    const target = prompts[toIdx];
    const targetCat = target.category || "未分类";

    if ((source.category || "未分类") !== targetCat) {
        if (!confirm(`将移动至 [${targetCat}] 分类，确认吗？`)) return;
        source.category = targetCat;
    }

    prompts.splice(fromIdx, 1);
    const newTargetIdx = prompts.indexOf(target);
    const finalIdx = isBefore ? newTargetIdx : newTargetIdx + 1;
    prompts.splice(finalIdx, 0, source);
    
    render(); await pushData();
}

// ===========================
// CRUD & Cloud Sync
// ===========================
function openViewModal(index) {
    currentModalIndex = index;
    const p = prompts[index];
    document.getElementById('modal-title').innerText = p.title;
    document.getElementById('modal-content-html').innerHTML = marked.parse(p.content);
    document.getElementById('modal-category-badge').innerText = p.category || "未分类";
    showModalMode('view');
    showModal(true);
}

function showModalMode(mode) {
    const isView = (mode === 'view');
    document.getElementById('view-mode-content').classList.toggle('hidden', !isView);
    document.getElementById('view-actions').classList.toggle('hidden', !isView);
    document.getElementById('edit-mode-form').classList.toggle('hidden', isView);
    document.getElementById('edit-actions').classList.toggle('hidden', isView);
}

function showModal(show) {
    elements.modalBackdrop.classList.toggle('hidden', !show);
    document.body.style.overflow = show ? 'hidden' : '';
}

function closeModal() { showModal(false); }

function openCreateModal() {
    currentModalIndex = -1;
    document.getElementById('p-title').value = "";
    document.getElementById('p-content').value = "";
    document.getElementById('p-category').value = "";
    showModalMode('edit');
    showModal(true);
}

function switchToEditMode() {
    const p = prompts[currentModalIndex];
    document.getElementById('p-title').value = p.title;
    document.getElementById('p-content').value = p.content;
    document.getElementById('p-category').value = p.category || "";
    showModalMode('edit');
}

async function handleSave() {
    const title = document.getElementById('p-title').value.trim();
    const content = document.getElementById('p-content').value.trim();
    const category = document.getElementById('p-category').value.trim() || "未分类";
    if (!title || !content) return;

    const data = { title, content, category };
    if (currentModalIndex === -1) prompts.push(data);
    else prompts[currentModalIndex] = data;
    
    render(); closeModal(); await pushData();
}

function deleteFromModal() {
    if (confirm('永久删除该 Prompt？')) {
        prompts.splice(currentModalIndex, 1);
        render(); closeModal(); pushData();
    }
}

function copyFromModal(btn) {
    navigator.clipboard.writeText(prompts[currentModalIndex].content);
    const old = btn.innerText; btn.innerText = "SUCCESS!";
    setTimeout(() => btn.innerText = old, 1500);
}

function handleSearch() { render(elements.searchBar.value.toLowerCase()); }

async function saveConfig() {
    const token = document.getElementById('gh-token').value.trim();
    const gistId = document.getElementById('gist-id').value.trim();
    config = { token, gistId };
    localStorage.setItem('gist_config', JSON.stringify(config));
    await fetchData();
    document.getElementById('config-section').classList.add('hidden');
}

async function fetchData() {
    if (!config.token || !config.gistId) return;
    updateStatus('正在云端数据同步...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { 
            headers: { 'Authorization': `token ${config.token}` } 
        });
        const data = await res.json();
        prompts = JSON.parse(data.files['prompts.json'].content);
        render(); updateStatus('同步完成');
    } catch (e) { updateStatus('配置有误，请检查 Token 和 ID'); }
}

async function pushData() {
    if (!config.token) return;
    updateStatus('上传中...', true);
    try {
        const res = await fetch(config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`, {
            method: config.gistId ? 'PATCH' : 'POST',
            headers: { 'Authorization': `token ${config.token}` },
            body: JSON.stringify({ 
                files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } } 
            })
        });
        const data = await res.json();
        if (!config.gistId) { 
            config.gistId = data.id; 
            localStorage.setItem('gist_config', JSON.stringify(config));
            document.getElementById('gist-id').value = data.id;
        }
        updateStatus('云端已更新');
    } catch (e) { updateStatus('上传失败'); }
}

function updateStatus(msg, show = false) {
    elements.statusBar.classList.remove('hidden');
    elements.statusBar.innerText = msg;
    if (!show) setTimeout(() => elements.statusBar.classList.add('hidden'), 2500);
}

function resetConfig() { 
    if(confirm('重置会注销本地配置，确定吗？')) { 
        localStorage.clear(); 
        location.reload(); 
    } 
}