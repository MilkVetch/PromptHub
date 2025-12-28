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

// --- 移动端拖拽算法优化 ---
function bindTouchEvents(el, index) {
    el.ontouchstart = (e) => {
        // 仅在单指触摸时处理
        if (e.touches.length > 1) return;
        
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        // 重置状态
        clearTimeout(touchTimer);
        draggedItemIndex = null;

        touchTimer = setTimeout(() => {
            draggedItemIndex = index;
            el.classList.add('mobile-dragging');
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600); // 长按阈值
    };

    el.ontouchmove = (e) => {
        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - touchStartX);
        const moveY = Math.abs(touch.clientY - touchStartY);

        // 核心优化：如果还没有进入“拖拽模式”
        if (draggedItemIndex === null) {
            // 如果移动距离超过 10px，判定为用户在滚动屏幕，取消长按定时器
            if (moveX > 10 || moveY > 10) {
                clearTimeout(touchTimer);
            }
            return; // 允许浏览器原生滚动
        }

        // 已经进入拖拽模式，接管控制权
        e.preventDefault(); 

        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

        // 检测落点
        const target = getTouchTarget(touch.clientX, touch.clientY);
        clearDropIndicators();
        if (target && target !== el) {
            const rect = target.getBoundingClientRect();
            target.classList.add(touch.clientY < rect.top + rect.height / 2 ? 'drop-target-above' : 'drop-target-below');
        }
    };

    el.ontouchend = (e) => {
        clearTimeout(touchTimer);
        
        if (draggedItemIndex !== null) {
            const touch = e.changedTouches[0];
            const target = getTouchTarget(touch.clientX, touch.clientY);

            if (target && target !== el) {
                const rect = target.getBoundingClientRect();
                const isBefore = touch.clientY < rect.top + rect.height / 2;
                const targetTitle = target.querySelector('h3').innerText;
                const toIdx = prompts.findIndex(p => p.title === targetTitle);
                handleMove(draggedItemIndex, toIdx, isBefore);
            } else {
                render(); // 重置
            }
        }

        // 清理
        draggedItemIndex = null;
        el.classList.remove('mobile-dragging');
        el.style.transform = "";
        clearDropIndicators();
    };
}

function getTouchTarget(x, y) {
    // 寻找手指下的 .title-card，由于 mobile-dragging 类已设置 pointer-events: none，
    // elementFromPoint 会自动跳过正在拖拽的卡片，找到它下方的卡片。
    const elementUnder = document.elementFromPoint(x, y);
    return elementUnder ? elementUnder.closest('.title-card') : null;
}

// --- 其余功能逻辑（Fetch/Render/Modal/Search等保持不变） ---
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

function clearDropIndicators() { document.querySelectorAll('.title-card').forEach(c => c.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-left', 'drop-target-right')); }

async function handleMove(fromIdx, toIdx, isBefore) {
    if (fromIdx === toIdx || fromIdx === -1) return;
    const source = prompts[fromIdx];
    const target = prompts[toIdx];
    if ((source.category || "未分类") !== (target.category || "未分类")) source.category = target.category || "未分类";
    prompts.splice(fromIdx, 1);
    const newTargetIdx = prompts.indexOf(target);
    prompts.splice(isBefore ? newTargetIdx : newTargetIdx + 1, 0, source);
    render(); await pushData();
}

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
        section.innerHTML = `<div class="category-header"><span class="text-[#ff9900] font-black tracking-widest text-sm uppercase">${cat}</span><button onclick="renameCategory('${cat}')" class="btn-edit-cat">重命名</button><span class="text-zinc-800 text-[10px] font-black ml-auto">${catItems.length} ITEMS</span></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-grid"></div>`;
        const grid = section.querySelector('.list-grid');
        catItems.forEach(p => {
            const realIdx = prompts.indexOf(p);
            const card = document.createElement('div');
            card.className = 'title-card bg-[#111] p-7 rounded-[1.5rem] border border-zinc-900 shadow-lg flex flex-col justify-between group';
            if (filter === "") { card.draggable = true; bindDragEvents(card, realIdx); bindTouchEvents(card, realIdx); }
            card.innerHTML = `<div class="cursor-pointer overflow-hidden mb-4" onclick="openViewModal(${realIdx})"><h3 class="font-black text-zinc-100 group-hover:text-[#ff9900] text-lg leading-tight truncate transition-colors">${p.title}</h3></div><div class="flex justify-between items-center mt-auto"><span class="text-[9px] font-black text-zinc-700 uppercase tracking-widest">长按整张卡片即可拖动</span><div class="text-zinc-800 group-hover:text-[#ff9900]"><svg width="20" height="20" fill="currentColor"><circle cx="6" cy="6" r="1.5"/><circle cx="14" cy="6" r="1.5"/><circle cx="6" cy="14" r="1.5"/><circle cx="14" cy="14" r="1.5"/></svg></div></div>`;
            grid.appendChild(card);
        });
        els.list.appendChild(section);
    });
    document.getElementById('empty-state').classList.toggle('hidden', hasVisible);
}

// 辅助方法（配置保存、数据拉取等）
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