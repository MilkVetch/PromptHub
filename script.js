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
    if (config.token && config.gistId) fetchData();
    else document.getElementById('config-section').classList.remove('hidden');
};

// ===========================
// 核心渲染逻辑 (包含分类编辑按钮)
// ===========================
function render(filter = "") {
    elements.listContainer.innerHTML = '';
    const filtered = prompts.filter(p => 
        p.title.toLowerCase().includes(filter) || p.content.toLowerCase().includes(filter)
    );

    const cats = [...new Set(prompts.map(p => p.category || "未分类"))];
    let hasVisible = false;

    cats.forEach(cat => {
        const catItems = filtered.filter(p => (p.category || "未分类") === cat);
        if (catItems.length === 0) return;
        hasVisible = true;

        const section = document.createElement('div');
        section.className = "mb-10 animate-scale-in";
        section.innerHTML = `
            <div class="category-header">
                <span class="text-[#ff9900] font-black tracking-widest text-sm uppercase">${cat}</span>
                <button onclick="renameCategory('${cat}')" class="btn-edit-cat">修改名称</button>
                <span class="text-zinc-700 text-[10px] font-bold ml-auto">${catItems.length} ITEMS</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 list-grid" data-category="${cat}"></div>
        `;

        const grid = section.querySelector('.list-grid');
        catItems.forEach(p => {
            const realIdx = prompts.indexOf(p);
            const card = document.createElement('div');
            card.className = 'title-card bg-[#1b1b1b] p-6 rounded-2xl border border-zinc-800 hover:border-[#ff9900] shadow-lg flex justify-between items-center';
            card.dataset.index = realIdx;

            if (filter === "") {
                card.draggable = true;
                bindDragEvents(card, realIdx);
                bindTouchEvents(card, realIdx);
            }

            card.innerHTML = `
                <div class="flex-grow cursor-pointer overflow-hidden" onclick="openViewModal(${realIdx})">
                    <h3 class="font-bold text-white group-hover:text-[#ff9900] text-lg truncate pr-4">${p.title}</h3>
                    <p class="text-zinc-600 text-[10px] mt-1 uppercase font-black">长按移动 / 点击查看</p>
                </div>
                <div class="text-zinc-800"><svg width="18" height="18" fill="currentColor"><circle cx="5" cy="4" r="1.5"/><circle cx="13" cy="4" r="1.5"/><circle cx="5" cy="9" r="1.5"/><circle cx="13" cy="9" r="1.5"/><circle cx="5" cy="14" r="1.5"/><circle cx="13" cy="14" r="1.5"/></svg></div>
            `;
            grid.appendChild(card);
        });
        elements.listContainer.appendChild(section);
    });
    document.getElementById('empty-state').classList.toggle('hidden', hasVisible);
}

// ===========================
// 分类修改功能
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
// 优化后的插入移动逻辑
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
        const isAbove = e.clientY < rect.top + rect.height / 2;
        clearDropIndicators();
        el.classList.add(isAbove ? 'drop-target-above' : 'drop-target-below');
    };
    el.ondrop = (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const isAbove = e.clientY < rect.top + rect.height / 2;
        handleMove(draggedItemIndex, index, isAbove);
    };
}

function bindTouchEvents(el, index) {
    el.ontouchstart = () => {
        touchTimer = setTimeout(() => {
            draggedItemIndex = index;
            el.classList.add('dragging');
            if (navigator.vibrate) navigator.vibrate(40);
        }, 600);
    };
    el.ontouchend = () => {
        clearTimeout(touchTimer);
        if (el.classList.contains('dragging')) {
            el.classList.remove('dragging');
            // 移动端简单移动：仅支持长按后点击另一个来交换（或在此处扩展 TouchMove 逻辑）
        }
    };
}

function clearDropIndicators() {
    document.querySelectorAll('.title-card').forEach(c => {
        c.classList.remove('drop-target-above', 'drop-target-below');
    });
}

async function handleMove(fromIdx, toIdx, isAbove) {
    if (fromIdx === toIdx) return;

    const source = prompts[fromIdx];
    const target = prompts[toIdx];
    const sourceCat = source.category || "未分类";
    const targetCat = target.category || "未分类";

    // 跨分类逻辑
    if (sourceCat !== targetCat) {
        if (!confirm(`确定将 "${source.title}" 移动到分类 [${targetCat}] 吗？`)) return;
        source.category = targetCat;
    }

    // 执行移动：删除原项 -> 插入新项
    prompts.splice(fromIdx, 1);
    const newToIdx = prompts.indexOf(target);
    const finalIdx = isAbove ? newToIdx : newToIdx + 1;
    
    prompts.splice(finalIdx, 0, source);
    
    draggedItemIndex = null;
    render();
    await pushData();
}

// ===========================
// 常规 CRUD 与同步
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

    if (currentModalIndex === -1) prompts.push({ title, content, category });
    else prompts[currentModalIndex] = { title, content, category };
    
    render(); closeModal(); await pushData();
}

function deleteFromModal() {
    if (confirm('确认删除？')) {
        prompts.splice(currentModalIndex, 1);
        render(); closeModal(); pushData();
    }
}

function copyFromModal(btn) {
    navigator.clipboard.writeText(prompts[currentModalIndex].content);
    btn.innerText = "已复制 ✅";
    setTimeout(() => btn.innerText = "复制正文", 1500);
}

function handleSearch() { render(elements.searchBar.value.toLowerCase()); }

async function saveConfig() {
    config = { 
        token: document.getElementById('gh-token').value.trim(), 
        gistId: document.getElementById('gist-id').value.trim() 
    };
    localStorage.setItem('gist_config', JSON.stringify(config));
    await fetchData();
    document.getElementById('config-section').classList.add('hidden');
}

async function fetchData() {
    if (!config.token || !config.gistId) return;
    updateStatus('正在拉取云端数据...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { 
            headers: { 'Authorization': `token ${config.token}` } 
        });
        const data = await res.json();
        prompts = JSON.parse(data.files['prompts.json'].content);
        render(); 
        updateStatus('同步成功');
    } catch (e) { updateStatus('获取失败，请检查配置'); }
}

async function pushData() {
    if (!config.token) return;
    updateStatus('同步云端...', true);
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
        }
        updateStatus('云端已更新');
    } catch (e) { updateStatus('上传失败'); }
}

function updateStatus(msg, show = false) {
    elements.statusBar.classList.remove('hidden');
    elements.statusBar.innerText = msg;
    if (!show) setTimeout(() => elements.statusBar.classList.add('hidden'), 2000);
}

function resetConfig() { if(confirm('重置配置？')) { localStorage.clear(); location.reload(); } }