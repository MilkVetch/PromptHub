let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
let currentModalIndex = -1;
let draggedItemIndex = null;

const categories = ["工作流", "其他"];

const elements = {
    listContainer: document.getElementById('list-container'),
    searchBar: document.getElementById('search-bar'),
    emptyState: document.getElementById('empty-state'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalTitle: document.getElementById('modal-title'),
    modalCategoryBadge: document.getElementById('modal-category-badge'),
    viewModeContent: document.getElementById('view-mode-content'),
    modalContentText: document.getElementById('modal-content-text'),
    editModeForm: document.getElementById('edit-mode-form'),
    titleInput: document.getElementById('p-title'),
    categoryInput: document.getElementById('p-category'),
    contentInput: document.getElementById('p-content'),
    viewActions: document.getElementById('view-actions'),
    editActions: document.getElementById('edit-actions'),
    statusBar: document.getElementById('status-bar'),
    statusText: document.getElementById('status-text')
};

window.onload = () => {
    if (!config.token) document.getElementById('config-section').classList.remove('hidden');
    else fetchData();
};

function handleSearch() { render(elements.searchBar.value.toLowerCase()); }

// ===========================
// 渲染逻辑：按分类分组渲染
// ===========================
function render(filter = "") {
    elements.listContainer.innerHTML = '';
    let hasResults = false;

    categories.forEach(catName => {
        // 过滤出属于该分类且匹配搜索的项
        const catItems = prompts.filter(p => (p.category === catName || (!p.category && catName === "其他")) && p.title.toLowerCase().includes(filter));
        
        if (catItems.length > 0) {
            hasResults = true;
            
            // 创建分类区块
            const section = document.createElement('div');
            section.innerHTML = `
                <div class="category-header">
                    <span class="text-[#ff9900] font-black tracking-widest text-sm uppercase">${catName}</span>
                    <span class="text-zinc-700 text-xs font-bold">${catItems.length} ITEMS</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 list-grid" data-category="${catName}"></div>
            `;
            
            const grid = section.querySelector('.list-grid');
            catItems.forEach(p => {
                const realIndex = prompts.indexOf(p);
                const card = document.createElement('div');
                card.className = 'title-card bg-[#1b1b1b] p-6 rounded-2xl border border-zinc-800 hover:border-[#ff9900] shadow-lg flex justify-between items-center group';
                
                if (filter === "") {
                    card.draggable = true;
                    card.ondragstart = (e) => { draggedItemIndex = realIndex; e.target.classList.add('dragging'); };
                    card.ondragend = (e) => e.target.classList.remove('dragging');
                    card.ondrop = () => handleDrop(realIndex);
                    card.ondragover = e => e.preventDefault();
                }

                card.innerHTML = `
                    <div class="flex-grow cursor-pointer" onclick="openViewModal(${realIndex})">
                        <h3 class="font-bold text-white group-hover:text-[#ph-orange] text-lg transition-colors truncate pr-4">${p.title}</h3>
                        <p class="text-zinc-600 text-xs mt-1">点击查看</p>
                    </div>
                    <div class="text-zinc-800 group-hover:text-[#ff9900]">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/></svg>
                    </div>
                `;
                grid.appendChild(card);
            });
            elements.listContainer.appendChild(section);
        }
    });

    elements.emptyState.classList.toggle('hidden', hasResults);
}

function handleDrop(targetIndex) {
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;
    const movedItem = prompts.splice(draggedItemIndex, 1)[0];
    prompts.splice(targetIndex, 0, movedItem);
    draggedItemIndex = null;
    render();
    pushData();
}

// ===========================
// 弹窗管理
// ===========================
function openCreateModal() {
    currentModalIndex = -1;
    elements.modalTitle.innerText = "新建 PROMPT";
    elements.modalCategoryBadge.classList.add('hidden');
    elements.titleInput.value = "";
    elements.contentInput.value = "";
    elements.categoryInput.value = "工作流";
    showModalMode('edit');
    showModal(true);
}

function openViewModal(index) {
    currentModalIndex = index;
    const p = prompts[index];
    elements.modalTitle.innerText = p.title;
    elements.modalContentText.innerText = p.content;
    elements.modalCategoryBadge.innerText = p.category || "其他";
    elements.modalCategoryBadge.classList.remove('hidden');
    showModalMode('view');
    showModal(true);
}

function showModalMode(mode) {
    const isView = (mode === 'view');
    elements.viewModeContent.classList.toggle('hidden', !isView);
    elements.viewActions.classList.toggle('hidden', !isView);
    elements.editModeForm.classList.toggle('hidden', isView);
    elements.editActions.classList.toggle('hidden', isView);
}

function switchToEditMode() {
    const p = prompts[currentModalIndex];
    elements.titleInput.value = p.title;
    elements.contentInput.value = p.content;
    elements.categoryInput.value = p.category || "其他";
    showModalMode('edit');
    elements.modalTitle.innerText = "修改";
}

function showModal(show) {
    elements.modalBackdrop.classList.toggle('hidden', !show);
    document.body.style.overflow = show ? 'hidden' : '';
}

function closeModal() { showModal(false); }

// ===========================
// 数据操作 (CRUD)：改为 push 到末尾
// ===========================
function handleSave() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentInput.value.trim();
    const category = elements.categoryInput.value;
    if (!title || !content) return;

    const data = { title, content, category };
    
    if (currentModalIndex === -1) {
        // 新增：加在数组最后（即该分类的最后）
        prompts.push(data);
    } else {
        // 修改：替换原有位置
        prompts[currentModalIndex] = data;
    }
    
    render(); closeModal(); pushData();
}

function deleteFromModal() {
    if (confirm('确认删除？')) {
        prompts.splice(currentModalIndex, 1);
        render(); closeModal(); pushData();
    }
}

function copyFromModal(btn) {
    navigator.clipboard.writeText(elements.modalContentText.innerText);
    const origin = btn.innerText; btn.innerText = "复制成功！";
    btn.classList.replace('bg-[#ff9900]', 'bg-green-600');
    setTimeout(() => {
        btn.innerText = origin;
        btn.classList.replace('bg-green-600', 'bg-[#ff9900]');
    }, 1200);
}

// ===========================
// 云同步逻辑
// ===========================
function saveConfig() {
    config = { token: document.getElementById('gh-token').value.trim(), gistId: document.getElementById('gist-id').value.trim() };
    localStorage.setItem('gist_config', JSON.stringify(config));
    fetchData(); document.getElementById('config-section').classList.add('hidden');
}

async function fetchData() {
    if (!config.token || !config.gistId) return;
    updateStatus('同步中...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { headers: { 'Authorization': `token ${config.token}` } });
        const data = await res.json();
        prompts = JSON.parse(data.files['prompts.json'].content);
        render(); updateStatus('同步完成');
    } catch (e) { updateStatus('同步失败', false); }
}

async function pushData() {
    if (!config.token) return;
    updateStatus('正在云端同步...', true);
    const method = config.gistId ? 'PATCH' : 'POST';
    const url = config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`;
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `token ${config.token}` },
            body: JSON.stringify({ files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } } })
        });
        const data = await res.json();
        if (!config.gistId) { config.gistId = data.id; localStorage.setItem('gist_config', JSON.stringify(config)); }
        updateStatus('云端已更新');
    } catch (e) { updateStatus('上传失败'); }
}

function updateStatus(msg, loading = false) {
    elements.statusBar.classList.remove('hidden');
    elements.statusText.innerText = msg;
    if (!loading) setTimeout(() => elements.statusBar.classList.add('hidden'), 2000);
}

function resetConfig() { if(confirm('重置？')) { localStorage.clear(); location.reload(); } }