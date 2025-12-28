let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
let currentModalIndex = -1;
let draggedItemIndex = null;
let touchTimer = null;

const elements = {
    listContainer: document.getElementById('list-container'),
    searchBar: document.getElementById('search-bar'),
    configSection: document.getElementById('config-section'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    statusBar: document.getElementById('status-bar')
};

window.onload = () => {
    document.getElementById('gh-token').value = config.token || '';
    document.getElementById('gist-id').value = config.gistId || '';
    if (config.token && config.gistId) fetchData();
    else elements.configSection.classList.remove('hidden');
};

// 1. 同步设置面板交互：点击空白处关闭
document.addEventListener('click', (e) => {
    const isClickInside = elements.configSection.contains(e.target);
    const isToggleButton = document.getElementById('config-toggle-btn').contains(e.target);
    if (!isClickInside && !isToggleButton && !elements.configSection.classList.contains('hidden')) {
        elements.configSection.classList.add('hidden');
    }
});

function toggleConfig(e) {
    e.stopPropagation();
    elements.configSection.classList.toggle('hidden');
}

// 2. 导出配置功能
function exportConfig() {
    const configData = JSON.stringify(config, null, 2);
    const blob = new Blob([configData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompthub_config_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 3. 版权信息弹窗
function showContactModal() {
    alert("联系方式: Khee.huang@hotmail.com\n\n提示: 如果喜欢这个工具，可以联系我进行打赏以支持后续开发。感谢支持！");
}

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
                <button onclick="renameCategory('${cat}')" class="btn-edit-cat">重命名</button>
                <span class="text-zinc-800 text-[10px] font-black ml-auto">${catItems.length} ITEMS</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-grid"></div>
        `;

        const grid = section.querySelector('.list-grid');
        catItems.forEach(p => {
            const realIdx = prompts.indexOf(p);
            const card = document.createElement('div');
            card.className = 'title-card bg-[#111] p-7 rounded-[1.5rem] border border-zinc-900 hover:border-[#ff9900]/50 shadow-lg flex flex-col justify-between group';
            
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
                    <span class="text-[9px] font-black text-zinc-700 uppercase tracking-widest">点击查看，长按拖动</span>
                    <div class="text-zinc-800 group-hover:text-[#ff9900]">
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

// 重命名分类 (中文按钮触发)
function renameCategory(oldName) {
    const newName = prompt(`将分类 [${oldName}] 修改为:`, oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        prompts.forEach(p => { if ((p.category || "未分类") === oldName) p.category = newName.trim(); });
        render(); pushData();
    }
}

// 拖拽插入逻辑 (PC + Mobile)
function bindDragEvents(el, index) {
    el.ondragstart = (e) => { draggedItemIndex = index; setTimeout(() => el.classList.add('dragging'), 0); };
    el.ondragend = () => { el.classList.remove('dragging'); clearDropIndicators(); };
    el.ondragover = (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        clearDropIndicators();
        if (window.innerWidth > 640) el.classList.add(e.clientX < rect.left + rect.width / 2 ? 'drop-target-left' : 'drop-target-right');
        else el.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-target-above' : 'drop-target-below');
    };
    el.ondrop = (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const isBefore = (window.innerWidth > 640) ? (e.clientX < rect.left + rect.width / 2) : (e.clientY < rect.top + rect.height / 2);
        handleMove(draggedItemIndex, index, isBefore);
    };
}

function bindTouchEvents(el, index) {
    el.ontouchstart = () => { touchTimer = setTimeout(() => { draggedItemIndex = index; el.classList.add('dragging'); if (navigator.vibrate) navigator.vibrate(50); }, 600); };
    el.ontouchend = () => clearTimeout(touchTimer);
}

function clearDropIndicators() { document.querySelectorAll('.title-card').forEach(c => c.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-left', 'drop-target-right')); }

async function handleMove(fromIdx, toIdx, isBefore) {
    if (fromIdx === toIdx) return;
    const source = prompts[fromIdx];
    const target = prompts[toIdx];
    if ((source.category || "未分类") !== (target.category || "未分类")) {
        if (!confirm(`移动到新分类 [${target.category || "未分类"}]？`)) return;
        source.category = target.category || "未分类";
    }
    prompts.splice(fromIdx, 1);
    const newTargetIdx = prompts.indexOf(target);
    prompts.splice(isBefore ? newTargetIdx : newTargetIdx + 1, 0, source);
    render(); await pushData();
}

// 弹窗与同步基础逻辑 (保持不变)
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

function showModal(show) { elements.modalBackdrop.classList.toggle('hidden', !show); document.body.style.overflow = show ? 'hidden' : ''; }
function closeModal() { showModal(false); }
function openCreateModal() {
    currentModalIndex = -1;
    document.getElementById('p-title').value = ""; document.getElementById('p-content').value = ""; document.getElementById('p-category').value = "";
    showModalMode('edit'); showModal(true);
}
function switchToEditMode() {
    const p = prompts[currentModalIndex];
    document.getElementById('p-title').value = p.title; document.getElementById('p-content').value = p.content; document.getElementById('p-category').value = p.category || "";
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
function deleteFromModal() { if (confirm('确认删除？')) { prompts.splice(currentModalIndex, 1); render(); closeModal(); pushData(); } }
function copyFromModal(btn) { navigator.clipboard.writeText(prompts[currentModalIndex].content); const old = btn.innerText; btn.innerText = "已复制 ✅"; setTimeout(() => btn.innerText = old, 1500); }
function handleSearch() { render(elements.searchBar.value.toLowerCase()); }
async function saveConfig() {
    config = { token: document.getElementById('gh-token').value.trim(), gistId: document.getElementById('gist-id').value.trim() };
    localStorage.setItem('gist_config', JSON.stringify(config));
    await fetchData(); elements.configSection.classList.add('hidden');
}
async function fetchData() {
    if (!config.token || !config.gistId) return;
    updateStatus('正在同步...', true);
    try {
        const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { headers: { 'Authorization': `token ${config.token}` } });
        const data = await res.json();
        prompts = JSON.parse(data.files['prompts.json'].content);
        render(); updateStatus('同步成功');
    } catch (e) { updateStatus('获取失败'); }
}
async function pushData() {
    if (!config.token) return;
    updateStatus('正在保存...', true);
    try {
        const res = await fetch(config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`, {
            method: config.gistId ? 'PATCH' : 'POST',
            headers: { 'Authorization': `token ${config.token}` },
            body: JSON.stringify({ files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } } })
        });
        const data = await res.json();
        if (!config.gistId) { config.gistId = data.id; localStorage.setItem('gist_config', JSON.stringify(config)); document.getElementById('gist-id').value = data.id; }
        updateStatus('云端已更新');
    } catch (e) { updateStatus('上传失败'); }
}
function updateStatus(msg, show = false) { elements.statusBar.classList.remove('hidden'); elements.statusBar.innerText = msg; if (!show) setTimeout(() => elements.statusBar.classList.add('hidden'), 2500); }
function resetConfig() { if(confirm('重置注销？')) { localStorage.clear(); location.reload(); } }