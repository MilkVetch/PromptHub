let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
let currentModalIndex = -1;
let draggedItemIndex = null;

const elements = {
    listContainer: document.getElementById('list-container'),
    searchBar: document.getElementById('search-bar'),
    emptyState: document.getElementById('empty-state'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalTitle: document.getElementById('modal-title'),
    modalCategoryBadge: document.getElementById('modal-category-badge'),
    viewModeContent: document.getElementById('view-mode-content'),
    modalContentHtml: document.getElementById('modal-content-html'),
    editModeForm: document.getElementById('edit-mode-form'),
    titleInput: document.getElementById('p-title'),
    categoryInput: document.getElementById('p-category'),
    contentInput: document.getElementById('p-content'),
    viewActions: document.getElementById('view-actions'),
    editActions: document.getElementById('edit-actions'),
    statusBar: document.getElementById('status-bar'),
    statusText: document.getElementById('status-text'),
    catList: document.getElementById('category-suggestions')
};

window.onload = () => {
    if (config.token && config.gistId) fetchData();
    else document.getElementById('config-section').classList.remove('hidden');
};

function handleSearch() { render(elements.searchBar.value.toLowerCase()); }

// ===========================
// 渲染逻辑：动态提取分类并分组
// ===========================
function render(filter = "") {
    elements.listContainer.innerHTML = '';
    
    // 1. 过滤符合搜索条件的项（匹配标题或内容）
    const filteredPrompts = prompts.filter(p => 
        p.title.toLowerCase().includes(filter) || 
        p.content.toLowerCase().includes(filter)
    );

    // 2. 提取当前所有存在的分类
    const currentCategories = [...new Set(prompts.map(p => p.category || "未分类"))];
    
    // 更新输入框的建议列表
    elements.catList.innerHTML = currentCategories.map(c => `<option value="${c}">`).join('');

    let hasVisibleItems = false;

    currentCategories.forEach(catName => {
        const catItems = filteredPrompts.filter(p => (p.category || "未分类") === catName);
        
        if (catItems.length > 0) {
            hasVisibleItems = true;
            const section = document.createElement('div');
            section.className = "mb-8 animate-scale-in";
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
                
                // 仅在非搜索模式下允许拖拽
                if (filter === "") {
                    card.draggable = true;
                    card.ondragstart = (e) => { draggedItemIndex = realIndex; e.target.classList.add('dragging'); };
                    card.ondragend = (e) => e.target.classList.remove('dragging');
                    card.ondrop = () => handleDrop(realIndex);
                    card.ondragover = e => e.preventDefault();
                }

                card.innerHTML = `
                    <div class="flex-grow cursor-pointer overflow-hidden" onclick="openViewModal(${realIndex})">
                        <h3 class="font-bold text-white group-hover:text-[#ff9900] text-lg transition-colors truncate pr-4">${p.title}</h3>
                        <p class="text-zinc-600 text-[10px] mt-1 uppercase font-black tracking-tighter">Click to reveal</p>
                    </div>
                    <div class="text-zinc-800 group-hover:text-[#ff9900] flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/></svg>
                    </div>
                `;
                grid.appendChild(card);
            });
            elements.listContainer.appendChild(section);
        }
    });

    elements.emptyState.classList.toggle('hidden', hasVisibleItems);
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
    elements.categoryInput.value = "";
    showModalMode('edit');
    showModal(true);
}

function openViewModal(index) {
    currentModalIndex = index;
    const p = prompts[index];
    elements.modalTitle.innerText = p.title;
    // 使用 marked 渲染 Markdown
    elements.modalContentHtml.innerHTML = marked.parse(p.content);
    elements.modalCategoryBadge.innerText = p.category || "未分类";
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
    elements.categoryInput.value = p.category || "";
    showModalMode('edit');
    elements.modalTitle.innerText = "编辑 Prompt";
}

function showModal(show) {
    elements.modalBackdrop.classList.toggle('hidden', !show);
    document.body.style.overflow = show ? 'hidden' : '';
}

function closeModal() { showModal(false); }

// ===========================
// 数据操作
// ===========================
function handleSave() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentInput.value.trim();
    const category = elements.categoryInput.value.trim() || "未分类";
    if (!title || !content) return;

    const data = { title, content, category };
    
    if (currentModalIndex === -1) prompts.push(data);
    else prompts[currentModalIndex] = data;
    
    render(); closeModal(); pushData();
}

function deleteFromModal() {
    if (confirm('确定要删除这个 Prompt 吗？此操作不可撤销。')) {
        prompts.splice(currentModalIndex, 1);
        render(); closeModal(); pushData();
    }
}

function copyFromModal(btn) {
    const rawText = prompts[currentModalIndex].content;
    navigator.clipboard.writeText(rawText);
    const origin = btn.innerText; btn.innerText = "已复制到剪贴板！";
    btn.classList.replace('bg-[#ff9900]', 'bg-green-600');
    setTimeout(() => {
        btn.innerText = origin;
        btn.classList.replace('bg-green-600', 'bg-[#ff9900]');
    }, 1200);
}

function exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prompts, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `prompts_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// ===========================
// 云同步逻辑
// ===========================
async function saveConfig() {
    const token = document.getElementById('gh-token').value.trim();
    const gistId = document.getElementById('gist-id').value.trim();
    if (!token) return alert('请输入 Token');
    
    config = { token, gistId };
    localStorage.setItem('gist_config', JSON.stringify(config));
    
    updateStatus('正在验证并获取数据...');
    await fetchData();
    document.getElementById('config-section').classList.add('hidden');
}

async function fetchData() {
    if (!config.token || !config.gistId) return;
    updateStatus('同步云端数据中...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { 
            headers: { 'Authorization': `token ${config.token}` } 
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        prompts = JSON.parse(data.files['prompts.json'].content);
        render(); 
        updateStatus('同步完成');
    } catch (e) { 
        updateStatus('同步失败，请检查 Token 或 Gist ID', false);
        document.getElementById('config-section').classList.remove('hidden');
    }
}

async function pushData() {
    if (!config.token) return;
    updateStatus('正在推送到云端...', true);
    const method = config.gistId ? 'PATCH' : 'POST';
    const url = config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`;
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `token ${config.token}` },
            body: JSON.stringify({ 
                description: "Prompt Hub Data Storage",
                public: false,
                files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } } 
            })
        });
        const data = await res.json();
        if (!config.gistId) { 
            config.gistId = data.id; 
            localStorage.setItem('gist_config', JSON.stringify(config)); 
            document.getElementById('gist-id').value = data.id;
        }
        updateStatus('云端已实时同步');
    } catch (e) { updateStatus('上传失败，请检查网络'); }
}

function updateStatus(msg, loading = false) {
    elements.statusBar.classList.remove('hidden');
    elements.statusText.innerText = msg;
    if (!loading) setTimeout(() => elements.statusBar.classList.add('hidden'), 3000);
}

function resetConfig() { 
    if(confirm('重置将清除本地 Token 配置，确定吗？')) { 
        localStorage.clear(); 
        location.reload(); 
    } 
}