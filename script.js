let prompts = [];
let config = JSON.parse(localStorage.getItem('gist_config')) || { token: '', gistId: '' };
let currentModalIndex = -1;
let draggedItemIndex = null;
let touchTimer = null;
let touchStartX = 0, touchStartY = 0;

const els = {
    list: document.getElementById('list-container'),
    search: document.getElementById('search-bar'),
    config: document.getElementById('config-section'),
    modal: document.getElementById('modal-backdrop'),
    dialog: document.getElementById('dialog-backdrop'),
    status: document.getElementById('status-bar')
};

window.onload = () => {
    document.getElementById('gh-token').value = config.token || '';
    document.getElementById('gist-id').value = config.gistId || '';
    if (config.token && config.gistId) fetchData();
    else els.config.classList.remove('hidden');
};

// --- 绑定 Handle 触发的 Touch 逻辑 ---
function bindTouchEvents(card, index) {
    const handle = card.querySelector('.drag-handle');
    
    handle.ontouchstart = (e) => {
        // 允许卡片正常点击查看，但如果手指点在 Handle 上，我们准备触发拖拽
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        clearTimeout(touchTimer);
        draggedItemIndex = null;

        touchTimer = setTimeout(() => {
            draggedItemIndex = index;
            card.classList.add('mobile-dragging');
            if (navigator.vibrate) navigator.vibrate(50);
        }, 400); // 移动端 400ms 长按触发图标拖动
    };

    handle.ontouchmove = (e) => {
        if (draggedItemIndex === null) {
            // 如果还没进入拖拽模式（即长按还没到时间），就不干涉，让页面滚动
            return; 
        }

        // 已经进入拖拽模式，禁用页面滚动，卡片随手指移动
        e.preventDefault(); 
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        card.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

        // 获取当前手指下的目标卡片
        const target = getTouchTarget(touch.clientX, touch.clientY);
        clearDropIndicators();
        if (target && target !== card) {
            const rect = target.getBoundingClientRect();
            target.classList.add(touch.clientY < rect.top + rect.height / 2 ? 'drop-target-above' : 'drop-target-below');
        }
    };

    handle.ontouchend = (e) => {
        clearTimeout(touchTimer);
        
        if (draggedItemIndex !== null) {
            const touch = e.changedTouches[0];
            const target = getTouchTarget(touch.clientX, touch.clientY);

            if (target && target !== card) {
                const rect = target.getBoundingClientRect();
                const isBefore = touch.clientY < rect.top + rect.height / 2;
                const targetTitle = target.querySelector('h3').innerText;
                const toIdx = prompts.findIndex(p => p.title === targetTitle);
                handleMove(draggedItemIndex, toIdx, isBefore);
            } else {
                render(); // 复位
            }
        }

        draggedItemIndex = null;
        card.classList.remove('mobile-dragging');
        card.style.transform = "";
        clearDropIndicators();
    };
}

// 辅助：获取手指位置下方的卡片
function getTouchTarget(x, y) {
    // mobile-dragging 类设置了 pointer-events: none，所以这里能透过拖拽中的卡片选到下面的目标
    const elementUnder = document.elementFromPoint(x, y);
    return elementUnder ? elementUnder.closest('.title-card') : null;
}

// --- 桌面端 Drag 逻辑 (同样限制为 Handle 启动) ---
function bindDragEvents(card, index) {
    const handle = card.querySelector('.drag-handle');
    
    // 设置 handle 为 draggable，整张卡片不可拖动
    handle.draggable = true;
    card.draggable = false;

    handle.ondragstart = (e) => {
        draggedItemIndex = index;
        // 视觉上隐藏原卡片
        setTimeout(() => card.classList.add('dragging'), 0);
    };

    card.ondragend = () => {
        card.classList.remove('dragging');
        clearDropIndicators();
    };

    card.ondragover = (e) => {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        clearDropIndicators();
        // 指示器判定
        if (window.innerWidth > 640) {
            card.classList.add(e.clientX < rect.left + rect.width / 2 ? 'drop-target-left' : 'drop-target-right');
        } else {
            card.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-target-above' : 'drop-target-below');
        }
    };

    card.ondrop = (e) => {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        const isBefore = (window.innerWidth > 640) ? (e.clientX < rect.left + rect.width / 2) : (e.clientY < rect.top + rect.height / 2);
        handleMove(draggedItemIndex, index, isBefore);
    };
}

// --- 业务渲染渲染逻辑 ---
function render(filter = "") {
    els.list.innerHTML = '';
    const filtered = prompts.filter(p => p.title.toLowerCase().includes(filter) || p.content.toLowerCase().includes(filter));
    const cats = [...new Set(prompts.map(p => p.category || "未分类"))];
    
    document.getElementById('category-suggestions').innerHTML = cats.map(c => `<option value="${c}">`).join('');
    
    let hasVisible = false;
    cats.forEach(cat => {
        const catItems = filtered.filter(p => (p.category || "未分类") === cat);
        if (catItems.length === 0) return;
        hasVisible = true;

        const section = document.createElement('div');
        section.className = "mb-12 animate-modal";
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
            card.className = 'title-card bg-[#111] p-7 rounded-[1.5rem] border border-zinc-900 shadow-lg flex flex-col justify-between group';
            
            card.innerHTML = `
                <div class="cursor-pointer overflow-hidden mb-4" onclick="openViewModal(${realIdx})">
                    <h3 class="font-black text-zinc-100 group-hover:text-[#ff9900] text-lg leading-tight truncate transition-colors">${p.title}</h3>
                </div>
                <div class="flex justify-between items-center mt-auto">
                    <span class="text-[9px] font-black text-zinc-700 uppercase tracking-widest">点击查看标题</span>
                    <div class="drag-handle text-zinc-800 group-hover:text-[#ff9900]">
                        <svg width="20" height="20" fill="currentColor" style="pointer-events: none;"><circle cx="6" cy="6" r="1.5"/><circle cx="14" cy="6" r="1.5"/><circle cx="6" cy="14" r="1.5"/><circle cx="14" cy="14" r="1.5"/></svg>
                    </div>
                </div>
            `;
            
            if (filter === "") {
                bindDragEvents(card, realIdx);
                bindTouchEvents(card, realIdx);
            }
            grid.appendChild(card);
        });
        els.list.appendChild(section);
    });
    document.getElementById('empty-state').classList.toggle('hidden', hasVisible);
}

// 核心移动逻辑
async function handleMove(fromIdx, toIdx, isBefore) {
    if (fromIdx === toIdx || fromIdx === -1) return;
    const source = prompts[fromIdx];
    const target = prompts[toIdx];
    
    if ((source.category || "未分类") !== (target.category || "未分类")) {
        source.category = target.category || "未分类";
    }

    prompts.splice(fromIdx, 1);
    const newTargetIdx = prompts.indexOf(target);
    prompts.splice(isBefore ? newTargetIdx : newTargetIdx + 1, 0, source);
    
    render(); 
    await pushData();
}

function clearDropIndicators() { document.querySelectorAll('.title-card').forEach(c => c.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-left', 'drop-target-right')); }

// 其他业务函数 (Fetch/Save/Config) 保持不变...
async function saveConfig() { config = { token: document.getElementById('gh-token').value.trim(), gistId: document.getElementById('gist-id').value.trim() }; localStorage.setItem('gist_config', JSON.stringify(config)); await fetchData(); els.config.classList.add('hidden'); }
async function fetchData() { if (!config.token || !config.gistId) return; updateStatus('同步中...', true); try { const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { headers: { 'Authorization': `token ${config.token}` } }); const data = await res.json(); prompts = JSON.parse(data.files['prompts.json'].content); render(); updateStatus('同步成功'); } catch (e) { updateStatus('获取失败'); } }
async function pushData() { if (!config.token) return; updateStatus('正在保存...', true); try { const res = await fetch(config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`, { method: config.gistId ? 'PATCH' : 'POST', headers: { 'Authorization': `token ${config.token}` }, body: JSON.stringify({ files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } } }) }); const data = await res.json(); if (!config.gistId) { config.gistId = data.id; localStorage.setItem('gist_config', JSON.stringify(config)); document.getElementById('gist-id').value = data.id; } updateStatus('云端已更新'); } catch (e) { updateStatus('保存失败'); } }
function updateStatus(msg, show = false) { els.status.classList.remove('hidden'); els.status.innerText = msg; if (!show) setTimeout(() => els.status.classList.add('hidden'), 2500); }
function toggleConfig(e) { e.stopPropagation(); els.config.classList.toggle('hidden'); }
function closeModal() { showModal(false); }
function showModal(show) { els.modal.classList.toggle('hidden', !show); document.body.style.overflow = show ? 'hidden' : ''; }
function showModalMode(mode) { const isView = (mode === 'view'); document.getElementById('view-mode-content').classList.toggle('hidden', !isView); document.getElementById('view-actions').classList.toggle('hidden', !isView); document.getElementById('edit-mode-form').classList.toggle('hidden', isView); document.getElementById('edit-actions').classList.toggle('hidden', isView); }
function openCreateModal() { currentModalIndex = -1; document.getElementById('p-title').value = ""; document.getElementById('p-content').value = ""; document.getElementById('p-category').value = ""; document.getElementById('modal-title').innerText = "新建 PROMPT"; document.getElementById('modal-category-badge').innerText = "NEW"; showModalMode('edit'); showModal(true); }
function openViewModal(index) { currentModalIndex = index; const p = prompts[index]; document.getElementById('modal-title').innerText = p.title; document.getElementById('modal-content-html').innerHTML = marked.parse(p.content); document.getElementById('modal-category-badge').innerText = p.category || "未分类"; showModalMode('view'); showModal(true); }
function switchToEditMode() { const p = prompts[currentModalIndex]; document.getElementById('p-title').value = p.title; document.getElementById('p-content').value = p.content; document.getElementById('p-category').value = p.category || ""; showModalMode('edit'); }
async function handleSave() { const title = document.getElementById('p-title').value.trim(); const content = document.getElementById('p-content').value.trim(); const category = document.getElementById('p-category').value.trim() || "未分类"; if (!title || !content) return; if (currentModalIndex === -1) prompts.push({ title, content, category }); else prompts[currentModalIndex] = { title, content, category }; render(); closeModal(); await pushData(); }
function handleSearch() { render(els.search.value.toLowerCase()); }
function copyFromModal(btn) { navigator.clipboard.writeText(prompts[currentModalIndex].content); const old = btn.innerText; btn.innerText = "已复制 ✅"; setTimeout(() => btn.innerText = old, 1500); }
function showContactUI() { showDialog({ title: "关于 & 联系", body: "联系邮箱: <span class='text-white'>Khee.huang@hotmail.com</span><br><br>提示: 如果喜欢这个工具，可以联系我进行打赏以支持后续开发。感谢支持！", confirmText: "好的", onConfirm: () => {} }); }
function confirmDeleteUI() { showDialog({ title: "确认删除", body: "确定要永久移除这个 Prompt 吗？此操作无法撤销。", confirmText: "确认删除", onConfirm: () => { prompts.splice(currentModalIndex, 1); render(); closeModal(); pushData(); } }); }
function resetConfig() { showDialog({ title: "注销确认", body: "确定要注销并清除本地同步配置吗？", confirmText: "确定注销", onConfirm: () => { localStorage.clear(); location.reload(); } }); }
function renameCategory(oldName) { showDialog({ title: "重命名分类", body: `正在修改分类: <span class='text-white'>${oldName}</span>`, showInput: { val: oldName }, confirmText: "保存修改", onConfirm: (newName) => { if (newName && newName.trim() !== "" && newName.trim() !== oldName) { prompts.forEach(p => { if ((p.category || "未分类") === oldName) p.category = newName.trim(); }); render(); pushData(); } } }); }
function showDialog({ title, body, showInput, confirmText, onConfirm }) { document.getElementById('dialog-header').innerText = title; document.getElementById('dialog-body').innerHTML = body; const inputWrapper = document.getElementById('dialog-input-wrapper'); const inputField = document.getElementById('dialog-input'); if (showInput) { inputWrapper.classList.remove('hidden'); inputField.value = showInput.val || ''; } else { inputWrapper.classList.add('hidden'); } const confirmBtn = document.getElementById('dialog-confirm-btn'); confirmBtn.onclick = () => { onConfirm(showInput ? inputField.value : null); closeDialog(); }; document.getElementById('dialog-backdrop').classList.remove('hidden'); }
function closeDialog() { document.getElementById('dialog-backdrop').classList.add('hidden'); }