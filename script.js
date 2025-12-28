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
// 初始化与自动纠错
// ===========================
window.onload = () => {
    // 自动纠错：如果检测到错误的 "undefined" 字符串，强行清空
    if (config.gistId === 'undefined' || config.gistId === 'null') {
        config.gistId = '';
        localStorage.setItem('gist_config', JSON.stringify(config));
    }

    if (!config.token) {
        document.getElementById('config-section').classList.remove('hidden');
        updateStatus('请点击设置按钮配置 Token', false);
    } else {
        fetchData();
    }
    elements.listContainer.addEventListener('dragover', e => e.preventDefault());
};

function handleSearch() {
    render(elements.searchBar.value.toLowerCase());
}

// ===========================
// 渲染逻辑
// ===========================
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
        card.className = 'title-card bg-[#1b1b1b] p-6 rounded-2xl border border-zinc-800 hover:border-[#ff9900] shadow-lg flex justify-between items-center group animate-fade-in';
        
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
                <p class="text-zinc-600 text-xs mt-1 font-bold italic underline">点击查看详情</p>
            </div>
            <div class="text-zinc-700 group-hover:text-[#ff9900] flex flex-col space-y-1">
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
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
// 弹窗逻辑
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
    if (!title || !content) { alert('内容不能为空'); return; }

    if (currentModalIndex === -1) prompts.unshift({ title, content });
    else prompts[currentModalIndex] = { title, content };
    
    render(); closeModal(); pushData();
}

function deleteFromModal() {
    if (confirm('确认彻底删除吗？')) {
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
// 同步逻辑 (修复 401 和 undefined 问题)
// ===========================
function toggleConfigPanel() { document.getElementById('config-section').classList.toggle('hidden'); }

function saveConfig() {
    const token = document.getElementById('gh-token').value.trim();
    const id = document.getElementById('gist-id').value.trim();
    if (!token.startsWith('ghp_')) { alert('Token 格式错误，必须以 ghp_ 开头'); return; }
    
    // 强制清理 ID 中的潜在错误字符串
    const cleanId = (id === 'undefined' || id === 'null') ? '' : id;
    
    config = { token, gistId: cleanId };
    localStorage.setItem('gist_config', JSON.stringify(config));
    fetchData(); 
    toggleConfigPanel();
}

async function fetchData() {
    // 如果没有 ID，说明是新用户，不执行下载
    if (!config.token || !config.gistId || config.gistId === 'undefined') {
        updateStatus('等待添加第一个 Prompt...', false);
        return;
    }

    updateStatus('正在同步云端...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
            headers: { 'Authorization': `token ${config.token}` }
        });
        
        if (res.status === 401) {
            updateStatus('❌ Token 无效 (401)，请检查设置', false);
            return;
        }
        if (!res.ok) throw new Error();

        const data = await res.json();
        if (data.files && data.files['prompts.json']) {
            prompts = JSON.parse(data.files['prompts.json'].content);
            render(); 
            updateStatus('✅ 同步完成');
        }
    } catch (e) { 
        updateStatus('⚠️ 同步失败，请检查网络或 ID', false); 
    }
}

async function pushData() {
    if (!config.token) return;
    updateStatus('正在保存至云端...', true);
    
    // 如果没有 ID，则创建 (POST)，如果有则更新 (PATCH)
    const hasValidId = config.gistId && config.gistId !== 'undefined';
    const method = hasValidId ? 'PATCH' : 'POST';
    const url = hasValidId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`;
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: "Prompt Hub Sync",
                files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } }
            })
        });

        if (res.status === 401) {
            updateStatus('❌ 权限错误，请检查 Token', false);
            return;
        }

        const data = await res.json();
        if (!hasValidId) {
            config.gistId = data.id;
            localStorage.setItem('gist_config', JSON.stringify(config));
        }
        updateStatus('✅ 云端已同步');
    } catch (e) { 
        updateStatus('❌ 上传失败', false); 
    }
}

function updateStatus(msg, loading = false) {
    elements.statusBar.classList.remove('hidden');
    elements.statusText.innerText = msg;
    if (!loading) setTimeout(() => elements.statusBar.classList.add('hidden'), 3000);
}

function resetConfig() { if(confirm('确定要清除所有本地配置并重置吗？')) { localStorage.clear(); location.reload(); } }