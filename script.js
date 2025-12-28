// ===========================
// 全局变量与状态管理
// ===========================
let prompts = []; // 存储 prompt 数据的数组
// 从本地存储尝试获取配置，如果没有则初始化为空对象
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };

// DOM 元素引用 (提高性能，避免重复查询)
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
    formTitle: document.getElementById('form-title'),
    titleInput: document.getElementById('p-title'),
    contentInput: document.getElementById('p-content'),
    editIndexInput: document.getElementById('edit-index'),
    saveBtn: document.getElementById('btn-save'),
    cancelBtn: document.getElementById('btn-cancel')
};

// ===========================
// 初始化与生命周期
// ===========================

// 页面加载完成后执行
window.onload = () => {
    bindEvents();
    // 自动纠错：如果本地存储了 "undefined" 的 ID，清除它
    if (config.gistId === 'undefined' || config.gistId === 'null') {
        config.gistId = '';
        localStorage.setItem('gist_config', JSON.stringify(config));
    }

    // 检查配置状态
    if (!config.token) {
        showConfigPanel(true);
        updateStatus('请先配置 GitHub Token 以启用云同步', 'warning');
    } else {
        // 有 token，尝试拉取数据
        fetchData();
    }
};

// 绑定基础事件
function bindEvents() {
    elements.toggleBtn.addEventListener('click', toggleConfigPanel);
}

// ===========================
// UI 交互逻辑
// ===========================

// 切换设置面板的显示/隐藏
function toggleConfigPanel() {
    const isHidden = elements.configSection.classList.contains('hidden');
    if (isHidden) {
        showConfigPanel(true);
    } else {
        showConfigPanel(false);
    }
}

// 显示或隐藏设置面板的具体实现
function showConfigPanel(show) {
    if (show) {
        elements.configSection.classList.remove('hidden');
        // 填充当前配置到输入框
        elements.ghTokenInput.value = config.token || '';
        elements.gistIdInput.value = config.gistId || '';
    } else {
        elements.configSection.classList.add('hidden');
    }
}

// 更新状态栏信息和样式
function updateStatus(msg, type = 'normal', isLoading = false) {
    elements.statusText.innerText = msg;
    // 控制加载图标的显示
    if (isLoading) {
        elements.loadingIcon.classList.remove('hidden');
    } else {
        elements.loadingIcon.classList.add('hidden');
    }

    // 根据类型设置不同的背景色和文字颜色
    const statusClasses = {
        'normal': ['bg-slate-100', 'text-slate-500'],
        'success': ['bg-green-100', 'text-green-700'],
        'error': ['bg-red-100', 'text-red-700'],
        'warning': ['bg-amber-100', 'text-amber-700']
    };

    // 清除旧样式并应用新样式
    elements.statusBar.className = 'mt-4 p-3 rounded-xl text-sm flex items-center justify-center transition-all duration-300';
    elements.statusBar.classList.add(...(statusClasses[type] || statusClasses.normal));
}

// 渲染 Prompt 列表视图
function render() {
    elements.listContainer.innerHTML = '';
    
    // 控制空状态提示的显示
    if (prompts.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.listContainer.classList.add('hidden');
        return;
    } else {
        elements.emptyState.classList.add('hidden');
        elements.listContainer.classList.remove('hidden');
    }

    // 遍历数组生成卡片 HTML
    prompts.forEach((p, i) => {
        const card = document.createElement('div');
        // 使用 Tailwind 类名构建卡片样式，响应式网格布局
        card.className = 'bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group animate-fade-in flex flex-col h-full';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-slate-800 text-lg truncate pr-4">${escapeHtml(p.title)}</h3>
            </div>
            <div class="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3 mb-4 flex-grow">${escapeHtml(p.content)}</div>
            
            <div class="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                <button onclick="copyIt(this, ${i})" class="flex items-center text-indigo-600 hover:text-indigo-800 text-sm font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>复制</span>
                </button>
                <div class="space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editIt(${i})" class="text-slate-400 hover:text-indigo-600 p-2 hover:bg-slate-100 rounded-lg transition-colors" title="修改">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                    <button onclick="deleteIt(${i})" class="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="删除">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        elements.listContainer.appendChild(card);
    });
}

// 简单的 HTML 转义，防止 XSS
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// ===========================
// 配置与网络请求逻辑 (核心)
// ===========================

// 保存配置信息到本地存储
function saveConfig() {
    const newToken = elements.ghTokenInput.value.trim();
    // 关键验证：确保用户输入的是 ghp_ 开头的 Token
    if (newToken && !newToken.startsWith('ghp_')) {
        alert('Token 格式错误！必须以 "ghp_" 开头。请重新复制完整的 Token。');
        return;
    }

    config.token = newToken;
    // 如果用户清空了 ID 输入框，则将配置中的 ID 置空，触发新建 Gist 流程
    if (elements.gistIdInput.value.trim() === '') {
        config.gistId = '';
    } else {
        config.gistId = elements.gistIdInput.value.trim();
    }
    
    localStorage.setItem('gist_config', JSON.stringify(config));
    // 保存后立即尝试拉取或创建
    fetchData();
    showConfigPanel(false);
}

// 重置配置
function resetConfig() {
    if(confirm('确定要清空所有配置吗？这将断开云端连接。')) {
        config = { token: '', gistId: '' };
        localStorage.removeItem('gist_config');
        elements.ghTokenInput.value = '';
        elements.gistIdInput.value = '';
        prompts = [];
        render();
        updateStatus('配置已重置', 'normal');
    }
}

// 从 GitHub Gist 获取数据
async function fetchData() {
    // 如果没有 Token，或者 Gist ID 不合法，则不执行请求
    if (!config.token || !config.gistId || config.gistId === 'undefined') {
        if (config.token && !config.gistId) {
             updateStatus('Token 已保存，准备首次同步 (将创建新 Gist)...', 'normal');
        }
        return;
    }

    updateStatus('正在从云端下载...', 'normal', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
            headers: { 
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            cache: 'no-cache' // 禁用缓存，确保获取最新数据
        });

        if (res.status === 401) {
             throw new Error('Token 无效或权限不足。请检查是否完整复制了 ghp_ 开头的 Token，并勾选了 gist 权限。');
        }
        if (res.status === 404) {
             throw new Error('Gist ID 不存在或已删除。请清空 Gist ID 后重新保存以创建新的。');
        }
        if (!res.ok) throw new Error(`网络错误 (${res.status})`);

        const data = await res.json();
        // 检查目标文件是否存在
        if (data.files && data.files['prompts.json']) {
            const content = data.files['prompts.json'].content;
            // 解析 JSON 内容
            prompts = JSON.parse(content);
            render();
            updateStatus('云端数据同步成功', 'success');
        } else {
            throw new Error('Gist 中找不到 prompts.json 文件');
        }
    } catch (e) {
        console.error(e);
        updateStatus(`同步失败: ${e.message}`, 'error');
    }
}

// 将数据上传到 GitHub Gist
async function pushData() {
    if (!config.token) {
        alert('请先在设置中配置 GitHub Token');
        showConfigPanel(true);
        return;
    }

    updateStatus('正在上传到云端...', 'normal', true);
    // 根据是否有 Gist ID 决定是创建 (POST) 还是更新 (PATCH)
    const method = config.gistId ? 'PATCH' : 'POST';
    const url = config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 
                'Authorization': `token ${config.token}`, 
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                description: "AI Prompts Storage (Powered by Prompt Hub)",
                public: false, // 创建为私密 Gist
                files: { 
                    "prompts.json": { 
                        content: JSON.stringify(prompts, null, 2) // 格式化 JSON 字符串
                    } 
                }
            })
        });

        if (res.status === 401) throw new Error('Token 无效，无法写入。请检查权限。');
        if (!res.ok) throw new Error(`上传失败 (${res.status})`);

        const data = await res.json();
        // 如果是首次创建，保存新生成的 Gist ID
        if (!config.gistId) {
            config.gistId = data.id;
            localStorage.setItem('gist_config', JSON.stringify(config));
            // 更新设置面板里的显示
            elements.gistIdInput.value = config.gistId;
            updateStatus('已成功创建云端 Gist 并上传!', 'success');
        } else {
            updateStatus('已同步至云端', 'success');
        }

    } catch (e) {
        console.error(e);
        updateStatus(`上传失败: ${e.message}`, 'error');
    }
}

// ===========================
// CRUD 操作逻辑 (增删改查)
// ===========================

// 处理保存按钮点击 (新增或修改)
function handleSave() {
    const title = elements.titleInput.value.trim();
    const content = elements.contentInput.value.trim();
    const idx = parseInt(elements.editIndexInput.value);

    if (!title || !content) {
        alert('标题和内容不能为空');
        return;
    }

    // 禁用保存按钮防止重复提交
    elements.saveBtn.disabled = true;
    elements.saveBtn.innerHTML = '处理中...';

    if (idx === -1) {
        // 新增模式：添加到数组开头
        prompts.unshift({ title, content, updatedAt: new Date().toISOString() });
    } else {
        // 修改模式：更新指定索引的数据
        prompts[idx] = { title, content, updatedAt: new Date().toISOString() };
        cancelEdit(); // 退出编辑模式
    }

    // 重置表单
    elements.titleInput.value = '';
    elements.contentInput.value = '';
    
    // 渲染并上传
    render();
    pushData().finally(() => {
        // 恢复按钮状态
        elements.saveBtn.disabled = false;
        elements.saveBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            保存并上传
        `;
    });
}

// 进入编辑模式
function editIt(i) {
    const p = prompts[i];
    elements.titleInput.value = p.title;
    elements.contentInput.value = p.content;
    elements.editIndexInput.value = i;
    
    // 更新 UI 状态
    elements.formTitle.innerText = '修改 Prompt';
    elements.saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        确认修改
    `;
    elements.cancelBtn.classList.remove('hidden');
    
    // 滚动到顶部输入框
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 取消编辑模式
function cancelEdit() {
    elements.editIndexInput.value = -1;
    elements.formTitle.innerText = '新建 Prompt';
    elements.saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        保存并上传
    `;
    elements.cancelBtn.classList.add('hidden');
    elements.titleInput.value = '';
    elements.contentInput.value = '';
}

// 删除操作
function deleteIt(i) {
    if(confirm('确定要删除这个 Prompt 吗？此操作无法撤销。')) {
        prompts.splice(i, 1);
        render();
        pushData();
    }
}

// 一键复制功能
function copyIt(btnElement, i) {
    const content = prompts[i].content;
    navigator.clipboard.writeText(content).then(() => {
        // 提供视觉反馈
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            <span class="text-green-600">已复制!</span>
        `;
        btnElement.classList.replace('bg-indigo-50', 'bg-green-50');
        
        // 1.5秒后恢复原样
        setTimeout(() => {
            btnElement.innerHTML = originalHtml;
            btnElement.classList.replace('bg-green-50', 'bg-indigo-50');
        }, 1500);
    }).catch(err => {
        alert('复制失败，请手动复制');
        console.error('复制失败:', err);
    });
}