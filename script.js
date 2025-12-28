// ===========================
// 全局变量与状态管理
// ===========================
let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
// 记录当前正在查看/编辑的 prompt 索引
let currentModalIndex = -1;

// DOM 元素引用
const elements = {
    configSection: document.getElementById('config-section'),
    toggleBtn: document.getElementById('toggle-config-btn'),
    ghTokenInput: document.getElementById('gh-token'),
    gistIdInput: document.getElementById('gist-id'),
    statusBar: document.getElementById('status-bar'),
    statusText: document.getElementById('status-text'),
    loadingIcon: document.getElementById('loading-icon'),
    listContainer: document.getElementById('list'),
    emptyState: document.getElementById('empty-state'),
    
    // Modal 相关
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
    saveBtn: document.getElementById('btn-save')
};

// ===========================
// 初始化与生命周期
// ===========================
window.onload = () => {
    bindEvents();
    // 自动纠错
    if (config.gistId === 'undefined' || config.gistId === 'null') {
        config.gistId = '';
        localStorage.setItem('gist_config', JSON.stringify(config));
    }

    if (!config.token) {
        showConfigPanel(true);
    } else {
        fetchData();
    }
};

function bindEvents() {
    elements.toggleBtn.addEventListener('click', toggleConfigPanel);
    // 点击遮罩层关闭 Modal
    elements.modalBackdrop.addEventListener('click', (e) => {
        if (e.target === elements.modalBackdrop) closeModal();
    });
}

// ===========================
// UI 交互逻辑 (Modal & Config)
// ===========================

// --- Config Panel ---
function toggleConfigPanel() {
    const isHidden = elements.configSection.classList.contains('hidden');
    showConfigPanel(isHidden);
}

function showConfigPanel(show) {
    if (show) {
        elements.configSection.classList.remove('hidden');
        elements.ghTokenInput.value = config.token || '';
        elements.gistIdInput.value = config.gistId || '';
    } else {
        elements.configSection.classList.add('hidden');
    }
}

// --- Modal Management ---

// 打开新建模式
function openCreateModal() {
    currentModalIndex = -1;
    elements.modalTitle.innerText = "新建 Prompt";
    elements.editIndexInput.value = -1;
    elements.titleInput.value = "";
    elements.contentInput.value = "";
    
    // 显示表单，隐藏查看内容
    elements.viewModeContent.classList.add('hidden');
    elements.editModeForm.classList.remove('hidden');
    // 显示编辑按钮组，隐藏查看按钮组
    elements.viewActions.classList.add('hidden');
    elements.editActions.classList.remove('hidden');
    
    elements.saveBtn.innerText = "保存并上传";
    
    showModal(true);
}

// 打开查看模式
function openViewModal(index) {
    currentModalIndex = index;
    const p = prompts[index];
    elements.modalTitle.innerText = p.title;
    elements.modalContentText.innerText = p.content;

    // 显示查看内容，隐藏表单
    elements.viewModeContent.classList.remove('hidden');
    elements.editModeForm.classList.add('hidden');
    // 显示查看按钮组，隐藏编辑按钮组
    elements.viewActions.classList.remove('hidden');
    elements.editActions.classList.add('hidden');

    showModal(true);
}

// 切换到编辑模式 (在当前弹窗内)
function switchToEditMode() {
    if (currentModalIndex === -1) return;
    const p = prompts[currentModalIndex];
    
    elements.modalTitle.innerText = `修改: ${p.title}`;
    elements.editIndexInput.value = currentModalIndex;
    elements.titleInput.value = p.title;
    elements.contentInput.value = p.content;

    // 切换显示状态
    elements.viewModeContent.classList.add('hidden');
    elements.editModeForm.classList.remove('hidden');
    elements.viewActions.classList.add('hidden');
    elements.editActions.classList.remove('hidden');

    elements.saveBtn.innerText = "确认修改";
}

function showModal(show) {
    if (show) {
        elements.modalBackdrop.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // 禁止背景滚动
    } else {
        elements.modalBackdrop.classList.add('hidden');
        document.body.style.overflow = ''; // 恢复背景滚动
    }
}

function closeModal() {
    showModal(false);
    // 延迟清空，防止动画闪烁
    setTimeout(() => {
        currentModalIndex = -1;
        elements.titleInput.value = "";
        elements.contentInput.value = "";
    }, 200);
}


// --- Status Bar ---
function updateStatus(msg, type = 'normal', isLoading = false) {
    elements.statusText.innerText = msg;
    elements.statusBar.classList.remove('hidden');
    if (isLoading) {
        elements.loadingIcon.classList.remove('hidden');
    } else {
        elements.loadingIcon.classList.add('hidden');
    }

    const statusClasses = {
        'normal': ['bg-zinc-900', 'text-zinc-400', 'border-zinc-800'],
        'success': ['bg-green-900/30', 'text-green-400', 'border-green-900'],
        'error': ['bg-red-900/30', 'text-red-400', 'border-red-900'],
    };

    elements.statusBar.className = 'mb-6 p-3 rounded-xl text-sm flex items-center justify-center border transition-all duration-300';
    elements.statusBar.classList.add(...(statusClasses[type] || statusClasses.normal));
    
    // 如果是成功或普通信息，3秒后自动隐藏
    if (type !== 'error' && !isLoading) {
        setTimeout(() => {
            elements.statusBar.classList.add('hidden');
        }, 3000);
    }
}

// ===========================
// 渲染逻辑 (只显示标题列表)
// ===========================
function render() {
    elements.listContainer.innerHTML = '';
    if (prompts.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.listContainer.classList.add('hidden');
        return;
    } else {
        elements.emptyState.classList.add('hidden');
        elements.listContainer.classList.remove('hidden');
    }

    prompts.forEach((p, i) => {
        // 创建一个点击即打开弹窗的标题卡片
        const card = document.createElement('button');
        card.onclick = () => openViewModal(i);
        card.className = 'title-card text-left bg-ph-dark p-5 rounded-xl border border-zinc-800 hover:border-ph-orange hover:shadow-lg hover:shadow-ph-orange/10 transition-all group';
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-white text-lg truncate pr-4 group-hover:text-ph-orange transition-colors">${escapeHtml(p.title)}</h3>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-zinc-600 group-hover:text-ph-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        `;
        elements.listContainer.appendChild(card);
    });
}

function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ===========================
// 网络请求逻辑 (GitHub API)
// ===========================
function saveConfig() {
    const newToken = elements.ghTokenInput.value.trim();
    if (newToken && !newToken.startsWith('ghp_')) {
        alert('Token 格式错误！必须以 "ghp_" 开头。');
        return;
    }
    config.token = newToken;
    config.gistId = elements.gistIdInput.value.trim() === '' ? '' : elements.gistIdInput.value.trim();
    
    localStorage.setItem('gist_config', JSON.stringify(config));
    fetchData();
    showConfigPanel(false);
}

function resetConfig() {
    if(confirm('确定要清空配置并断开连接吗？')) {
        config = { token: '', gistId: '' };
        localStorage.removeItem('gist_config');
        elements.ghTokenInput.value = '';
        elements.gistIdInput.value = '';
        prompts = [];
        render();
        updateStatus('配置已重置', 'normal');
        showConfigPanel(true);
    }
}

async function fetchData() {
    if (!config.token) return;
    if (!config.gistId || config.gistId === 'undefined') {
        if (config.token) updateStatus('准备首次同步...', 'normal');
        return;
    }

    updateStatus('正在从云端下载...', 'normal', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
            headers: { 'Authorization': `token ${config.token}`, 'Accept': 'application/vnd.github.v3+json' },
            cache: 'no-cache'
        });
        if (res.status === 401) throw new Error('Token 无效 (401)');
        if (res.status === 404) throw new Error('Gist ID 不存在 (404)，请清空 ID 重试');
        if (!res.ok) throw new Error(`网络错误 (${res.status})`);

        const data = await res.json();
        if (data.files && data.files['prompts.json']) {
            prompts = JSON.parse(data.files['prompts.json'].content);
            render();
            updateStatus('同步成功', 'success');
        }
    } catch (e) {
        updateStatus(`同步失败: ${e.message}`, 'error');
    }
}

async function pushData() {
    if (!config.token) { alert('请先配置 Token'); return; }
    updateStatus('正在上传...', 'normal', true);
    
    const method = config.gistId ? 'PATCH' : 'POST';
    const url = config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: "Prompt Hub Storage", public: false,
                files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } }
            })
        });
        if (!res.ok) throw new Error(`上传失败 (${res.status})`);
        const data = await res.json();
        if (!config.gistId) {
            config.gistId = data.id;
            localStorage.setItem('gist_config', JSON.stringify(config));
            elements.gistIdInput.value = config.gistId;
        }
        updateStatus('已同步至云端', 'success');
    } catch (e) {
        updateStatus(`上传失败: ${e.message}`, 'error');
    }
}

// ===========================
// CRUD 操作 (在 Modal 中执行)
// ===========================

// 保存 (新增或修改)
function handleSave() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentInput.value.trim();
    const idx = parseInt(elements.editIndexInput.value);

    if (!title || !content) { alert('标题和内容不能为空'); return; }

    elements.saveBtn.disabled = true;
    elements.saveBtn.innerText = '提交中...';

    const promptData = { title, content, updatedAt: new Date().toISOString() };
    if (idx === -1) {
        prompts.unshift(promptData);
    } else {
        prompts[idx] = promptData;
    }

    render();
    closeModal(); // 保存后关闭弹窗
    pushData().finally(() => {
        elements.saveBtn.disabled = false;
    });
}

// 删除 (在查看模式下)
function deleteFromModal() {
    if (currentModalIndex === -1) return;
    if(confirm('确定要删除这个 Prompt 吗？不可恢复。')) {
        prompts.splice(currentModalIndex, 1);
        render();
        closeModal();
        pushData();
    }
}

// 复制 (在查看模式下)
function copyFromModal(btnElement) {
    if (currentModalIndex === -1) return;
    const content = prompts[currentModalIndex].content;
    navigator.clipboard.writeText(content).then(() => {
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = `<span class="text-black">已复制!</span>`;
        btnElement.classList.replace('bg-ph-orange', 'bg-green-500');
        setTimeout(() => {
            btnElement.innerHTML = originalHtml;
            btnElement.classList.replace('bg-green-500', 'bg-ph-orange');
        }, 1500);
    });
}