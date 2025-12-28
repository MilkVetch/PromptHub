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
// 初始化与渲染
// ===========================
window.onload = () => {
    if (!config.token) {
        document.getElementById('config-section').classList.remove('hidden');
    } else {
        fetchData();
    }
    elements.listContainer.addEventListener('dragover', e => e.preventDefault());
};

function handleSearch() {
    render(elements.searchBar.value.toLowerCase());
}

function render(filter = "") {
    elements.listContainer.innerHTML = '';
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
        
        // 搜索状态下禁用拖拽
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
                <p class="text-zinc-600 text-xs mt-1">查看内容</p>
            </div>
            <div class="text-zinc-700 group-hover:text-[#ff9900] flex flex-col space-y-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
                    <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                    <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
                </svg>
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
    pushData();
}

// ===========================
// 弹窗与交互逻辑
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
    elements.modalTitle.innerText = "修改";
}

function showModal(show) {
    elements.modalBackdrop.classList.toggle('hidden', !show);
    document.body.style.overflow = show ? 'hidden' : '';
}

function closeModal() { showModal(false); }

function handleSave() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentInput.value.trim();
    if (!title || !content) return;

    if (currentModalIndex === -1) prompts.unshift({ title, content });
    else prompts[currentModalIndex] = { title, content };
    
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
    const origin = btn.innerText; btn.innerText = "已复制！";
    btn.classList.replace('bg-[#ff9900]', 'bg-green-600');
    setTimeout(() => {
        btn.innerText = origin;
        btn.classList.replace('bg-green-600', 'bg-[#ff9900]');
    }, 1200);
}

// ===========================
// 同步逻辑 (GitHub Gist)
// ===========================
function toggleConfigPanel() { document.getElementById('config-section').classList.toggle('hidden'); }

function saveConfig() {
    const token = document.getElementById('gh-token').value.trim();
    const id = document.getElementById('gist-id').value.trim();
    if (!token.startsWith('ghp_')) { alert('Token 格式错误'); return; }
    config = { token, gistId: id };
    localStorage.setItem('gist_config', JSON.stringify(config));
    fetchData(); toggleConfigPanel();
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

function updateStatus(msg, loading = false) {
    elements.statusBar.classList.remove('hidden');
    elements.statusText.innerText = msg;
    if (!loading) setTimeout(() => elements.statusBar.classList.add('hidden'), 2000);
}

function resetConfig() { if(confirm('重置？')) { localStorage.clear(); location.reload(); } }