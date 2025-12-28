let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
let currentModalIndex = -1;

// 拖拽相关状态
let draggedItemIndex = null;
let touchTimer = null;

const elements = {
    listContainer: document.getElementById('list-container'),
    searchBar: document.getElementById('search-bar'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalContentHtml: document.getElementById('modal-content-html'),
    statusBar: document.getElementById('status-bar'),
    statusText: document.getElementById('status-text')
};

window.onload = () => {
    if (config.token && config.gistId) fetchData();
    else document.getElementById('config-section').classList.remove('hidden');
};

// ===========================
// 渲染逻辑 (含分类修改按钮)
// ===========================
function render(filter = "") {
    elements.listContainer.innerHTML = '';
    const filtered = prompts.filter(p => 
        p.title.toLowerCase().includes(filter) || p.content.toLowerCase().includes(filter)
    );

    const categories = [...new Set(prompts.map(p => p.category || "未分类"))];
    let hasVisible = false;

    categories.forEach(cat => {
        const catItems = filtered.filter(p => (p.category || "未分类") === cat);
        if (catItems.length === 0) return;
        hasVisible = true;

        const section = document.createElement('div');
        section.className = "mb-8 animate-scale-in";
        section.innerHTML = `
            <div class="category-header group">
                <span class="text-[#ff9900] font-black tracking-widest text-sm uppercase">${cat}</span>
                <button onclick="renameCategory('${cat}')" class="edit-cat-btn text-zinc-600 hover:text-white text-xs">✎ 修改名称</button>
                <span class="text-zinc-700 text-xs font-bold ml-auto">${catItems.length} ITEMS</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 list-grid" data-category="${cat}"></div>
        `;

        const grid = section.querySelector('.list-grid');
        catItems.forEach(p => {
            const realIdx = prompts.indexOf(p);
            const card = document.createElement('div');
            card.className = 'title-card bg-[#1b1b1b] p-6 rounded-2xl border border-zinc-800 hover:border-[#ff9900] shadow-lg flex justify-between items-center';
            card.dataset.index = realIdx;

            // PC 端拖拽
            if (filter === "") {
                card.draggable = true;
                bindDragEvents(card, realIdx);
                // 移动端长按
                bindTouchEvents(card, realIdx);
            }

            card.innerHTML = `
                <div class="flex-grow cursor-pointer overflow-hidden" onclick="openViewModal(${realIdx})">
                    <h3 class="font-bold text-white group-hover:text-[#ff9900] text-lg truncate pr-4">${p.title}</h3>
                    <p class="text-zinc-600 text-[10px] mt-1 uppercase font-black">Hold to move / Click to view</p>
                </div>
                <div class="text-zinc-800"><svg width="16" height="16" fill="currentColor"><circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/></svg></div>
            `;
            grid.appendChild(card);
        });
        elements.listContainer.appendChild(section);
    });
    document.getElementById('empty-state').classList.toggle('hidden', hasVisible);
}

// ===========================
// 分类重命名逻辑
// ===========================
function renameCategory(oldName) {
    const newName = prompt(`将分类 "${oldName}" 重命名为:`, oldName);
    if (newName && newName.trim() !== "" && newName !== oldName) {
        prompts.forEach(p => {
            if ((p.category || "未分类") === oldName) p.category = newName.trim();
        });
        render(); pushData();
    }
}

// ===========================
// 增强型插入排序逻辑 (含跨分类提示)
// ===========================
function bindDragEvents(el, index) {
    el.ondragstart = (e) => {
        draggedItemIndex = index;
        setTimeout(() => el.classList.add('dragging'), 0);
    };
    el.ondragend = () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.title-card').forEach(c => c.classList.remove('drop-target-above', 'drop-target-below'));
    };
    el.ondragover = (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        el.classList.remove('drop-target-above', 'drop-target-below');
        el.classList.add(e.clientY < midpoint ? 'drop-target-above' : 'drop-target-below');
    };
    el.ondrop = (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const isAbove = e.clientY < rect.top + rect.height / 2;
        executeMove(draggedItemIndex, index, isAbove);
    };
}

// 移动端模拟长按拖拽 (极简实现)
function bindTouchEvents(el, index) {
    el.ontouchstart = (e) => {
        touchTimer = setTimeout(() => {
            draggedItemIndex = index;
            el.classList.add('dragging');
            // 简单提示进入拖拽模式
            if(window.navigator.vibrate) window.navigator.vibrate(50);
        }, 600);
    };
    el.ontouchend = () => clearTimeout(touchTimer);
    // 注意：移动端完整自由拖拽通常需要 SortableJS 库，此处实现长按后的逻辑触发
}

async function executeMove(fromIdx, toIdx, isAbove) {
    if (fromIdx === null || fromIdx === toIdx) return;

    const source = prompts[fromIdx];
    const target = prompts[toIdx];
    const targetCat = target.category || "未分类";
    const sourceCat = source.category || "未分类";

    // 跨分类逻辑
    if (sourceCat !== targetCat) {
        if (!confirm(`确定将 "${source.title}" 移动到分类 [${targetCat}] 吗？`)) return;
        source.category = targetCat;
    }

    // 计算插入位置
    prompts.splice(fromIdx, 1);
    const newToIdx = prompts.indexOf(target);
    const finalIdx = isAbove ? newToIdx : newToIdx + 1;
    
    prompts.splice(finalIdx, 0, source);
    
    draggedItemIndex = null;
    render();
    await pushData();
}

// ===========================
// 基础 CRUD 与 同步 (同上个版本)
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
    if (confirm('确认删除？')) {
        prompts.splice(currentModalIndex, 1);
        render(); closeModal(); pushData();
    }
}

function copyFromModal(btn) {
    navigator.clipboard.writeText(prompts[currentModalIndex].content);
    const origin = btn.innerText; btn.innerText = "已复制！";
    btn.classList.add('bg-green-600');
    setTimeout(() => { btn.innerText = origin; btn.classList.remove('bg-green-600'); }, 1200);
}

function handleSearch() { render(elements.searchBar.value.toLowerCase()); }

// ===========================
// 云同步
// ===========================
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
    updateStatus('同步中...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { 
            headers: { 'Authorization': `token ${config.token}` } 
        });
        const data = await res.json();
        prompts = JSON.parse(data.files['prompts.json'].content);
        render(); updateStatus('同步完成');
    } catch (e) { updateStatus('获取失败'); }
}

async function pushData() {
    if (!config.token) return;
    updateStatus('云端同步中...', true);
    const url = config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`;
    try {
        const res = await fetch(url, {
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
    } catch (e) { updateStatus('更新失败'); }
}

function updateStatus(msg, show = false) {
    elements.statusBar.classList.toggle('hidden', !show && msg==='');
    elements.statusText.innerText = msg;
    if (!show) setTimeout(() => elements.statusBar.classList.add('hidden'), 2000);
}

function exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prompts));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "prompts_backup.json");
    dl.click();
}