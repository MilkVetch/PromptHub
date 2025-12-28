let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
let currentModalIndex = -1;
let draggedItemIndex = null;

const elements = {
    listContainer: document.getElementById('list'),
    searchBar: document.getElementById('search-bar'),
    emptyState: document.getElementById('empty-state'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalTitle: document.getElementById('modal-title'),
    viewModeContent: document.getElementById('view-mode-content'),
    modalContentText: document.getElementById('modal-content-text'),
    editModeForm: document.getElementById('edit-mode-form'),
    titleInput: document.getElementById('p-title'),
    contentInput: document.getElementById('p-content'),
    editIndexInput: document.getElementById('edit-index'),
    viewActions: document.getElementById('view-actions'),
    editActions: document.getElementById('edit-actions'),
    statusBar: document.getElementById('status-bar'),
    statusText: document.getElementById('status-text')
};

// ===========================
// 初始化
// ===========================
window.onload = () => {
    if (!config.token) {
        document.getElementById('config-section').classList.remove('hidden');
    } else {
        fetchData();
    }
    // 允许拖放容器接收目标
    elements.listContainer.addEventListener('dragover', e => e.preventDefault());
};

// ===========================
// 搜索过滤
// ===========================
function handleSearch() {
    const keyword = elements.searchBar.value.toLowerCase();
    render(keyword);
}

// ===========================
// 渲染主列表 (核心逻辑)
// ===========================
function render(filter = "") {
    elements.listContainer.innerHTML = '';
    // 模糊搜索：标题包含关键词即可
    const filteredPrompts = prompts.filter(p => p.title.toLowerCase().includes(filter));

    if (filteredPrompts.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }
    elements.emptyState.classList.add('hidden');

    filteredPrompts.forEach((p, i) => {
        const realIndex = prompts.indexOf(p);
        const card = document.createElement('div');
        card.className = 'title-card bg-[#1b1b1b] p-6 rounded-2xl border border-zinc-800 hover:border-[#ff9900] shadow-lg flex justify-between items-center group';
        
        // 只有在非搜索状态下允许拖拽，防止逻辑混乱
        if (filter === "") {
            card.draggable = true;
            card.ondragstart = (e) => {
                draggedItemIndex = realIndex;
                e.target.classList.add('dragging');
            };
            card.ondragend = (e) => e.target.classList.remove('dragging');
            card.ondrop = () => handleDrop(realIndex);
        }

        card.innerHTML = `
            <div class="flex-grow cursor-pointer" onclick="openViewModal(${realIndex})">
                <h3 class="font-bold text-white group-hover:text-[#ff9900] text-lg transition-colors truncate pr-4">${p.title}</h3>
                <p class="text-zinc-600 text-xs mt-1">点击查看详情</p>
            </div>
            <div class="text-zinc-700 group-hover:text-[#ff9900] cursor-grab active:cursor-grabbing">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M10 9h4V5h3l-5-5-5 5h3v4zm0 6H7v3l-5-5 5-5v3h3v4zm4 0h3v-3l5 5-5 5v-3h-3v-4zm-4 0v4H7l5 5 5-5h-3v-4h-4z"/></svg>
            </div>
        `;
        elements.listContainer.appendChild(card);
    });
}

function handleDrop(targetIndex) {
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;
    const movedItem = prompts.splice(draggedItemIndex, 1)[0];
    prompts.splice(targetIndex, 0, movedItem);
    draggedItemIndex = null;
    render();
    pushData(); // 排序后自动同步
}

// ===========================
// 弹窗管理
// ===========================
function openCreateModal() {
    currentModalIndex = -1;
    elements.modalTitle.innerText = "新建 PROMPT";
    elements.titleInput.value = "";
    elements.contentInput.value = "";
    showModalMode('edit');
    showModal(true);
}

function openViewModal(index) {
    currentModalIndex = index;
    const p = prompts[index];
    elements.modalTitle.innerText = p.title;
    elements.modalContentText.innerText = p.content;
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
    showModalMode('edit');
    elements.modalTitle.innerText = "修改内容";
}

function showModal(show) {
    elements.modalBackdrop.classList.toggle('hidden', !show);
    document.body.style.overflow = show ? 'hidden' : '';
}

function closeModal() { showModal(false); }

// ===========================
// 数据操作 (CRUD)
// ===========================
function handleSave() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentInput.value.trim();
    if (!title || !content) { alert('标题和内容缺一不可'); return; }

    const data = { title, content, time: new Date().getTime() };
    if (currentModalIndex === -1) {
        prompts.unshift(data);
    } else {
        prompts[currentModalIndex] = data;
    }
    render();
    closeModal();
    pushData();
}

function deleteFromModal() {
    if (confirm('确认销毁这条记录吗？')) {
        prompts.splice(currentModalIndex, 1);
        render();
        closeModal();
        pushData();
    }
}

function copyFromModal(btn) {
    navigator.clipboard.writeText(elements.modalContentText.innerText);
    const origin = btn.innerText;
    btn.innerText = "复制成功！";
    btn.classList.replace('bg-[#ff9900]', 'bg-green-600');
    setTimeout(() => {
        btn.innerText = origin;
        btn.classList.replace('bg-green-600', 'bg-[#ff9900]');
    }, 1500);
}

// ===========================
// 云同步逻辑
// ===========================
function toggleConfigPanel() {
    document.getElementById('config-section').classList.toggle('hidden');
}

function saveConfig() {
    const token = document.getElementById('gh-token').value.trim();
    const id = document.getElementById('gist-id').value.trim();
    if (!token.startsWith('ghp_')) { alert('Token 必须以 ghp_ 开头'); return; }
    config = { token, gistId: id };
    localStorage.setItem('gist_config', JSON.stringify(config));
    fetchData();
    toggleConfigPanel();
}

async function fetchData() {
    if (!config.token || !config.gistId) return;
    updateStatus('同步云端中...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
            headers: { 'Authorization': `token ${config.token}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        prompts = JSON.parse(data.files['prompts.json'].content);
        render();
        updateStatus('云端同步完成');
    } catch (e) {
        updateStatus('同步失败，请检查配置', false);
    }
}

async function pushData() {
    if (!config.token) return;
    updateStatus('正在保存至云端...', true);
    const method = config.gistId ? 'PATCH' : 'POST';
    const url = config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`;
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: "Prompt Hub Sync",
                files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } }
            })
        });
        const data = await res.json();
        if (!config.gistId) {
            config.gistId = data.id;
            localStorage.setItem('gist_config', JSON.stringify(config));
        }
        updateStatus('云端已更新');
    } catch (e) {
        updateStatus('云端更新失败');
    }
}

function updateStatus(msg, loading = false) {
    elements.statusBar.classList.remove('hidden');
    elements.statusText.innerText = msg;
    if (!loading) setTimeout(() => elements.statusBar.classList.add('hidden'), 3000);
}

function resetConfig() {
    if(confirm('确定清空本地配置吗？')) {
        localStorage.clear();
        location.reload();
    }
}