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

// --- 精准移动端 Handle 拖拽逻辑 ---
function bindTouchEvents(card, index) {
    const handle = card.querySelector('.drag-handle');
    
    handle.ontouchstart = (e) => {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        clearTimeout(touchTimer);
        draggedItemIndex = null;

        touchTimer = setTimeout(() => {
            draggedItemIndex = index;
            card.classList.add('mobile-dragging');
            if (navigator.vibrate) navigator.vibrate(50);
        }, 400); 
    };

    handle.ontouchmove = (e) => {
        if (draggedItemIndex === null) return;
        e.preventDefault(); 
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        card.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

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
                const toIdx = prompts.findIndex(p => p.title === target.querySelector('h3').innerText);
                handleMove(draggedItemIndex, toIdx, isBefore);
            } else { render(); }
        }
        draggedItemIndex = null;
        card.classList.remove('mobile-dragging');
        card.style.transform = "";
        clearDropIndicators();
    };
}

function getTouchTarget(x, y) {
    const elementUnder = document.elementFromPoint(x, y);
    return elementUnder ? elementUnder.closest('.title-card') : null;
}

// --- 桌面端 Drag 逻辑 ---
function bindDragEvents(card, index) {
    const handle = card.querySelector('.drag-handle');
    handle.draggable = true;
    handle.ondragstart = (e) => { draggedItemIndex = index; setTimeout(() => card.classList.add('dragging'), 0); };
    card.ondragend = () => { card.classList.remove('dragging'); clearDropIndicators(); };
    card.ondragover = (e) => {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        clearDropIndicators();
        if (window.innerWidth > 640) card.classList.add(e.clientX < rect.left + rect.width / 2 ? 'drop-target-left' : 'drop-target-right');
        else card.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-target-above' : 'drop-target-below');
    };
    card.ondrop = (e) => {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        const isBefore = (window.innerWidth > 640) ? (e.clientX < rect.left + rect.width / 2) : (e.clientY < rect.top + rect.height / 2);
        handleMove(draggedItemIndex, index, isBefore);
    };
}

// --- UI 渲染 ---
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
            card.innerHTML = `<div class="cursor-pointer overflow-hidden mb-4" onclick="openViewModal(${realIdx})"><h3 class="font-black text-zinc-100 group-hover:text-[#ff9900] text-lg leading-tight truncate transition-colors">${p.title}</h3></div><div class="flex justify-between items-center mt-auto"><span class="text-[9px] font-black text-zinc-700 uppercase tracking-widest">点击查看标题</span><div class="drag-handle text-zinc-800 group-hover:text-[#ff9900]"><svg width="20" height="20" fill="currentColor" style="pointer-events: none;"><circle cx="6" cy="6" r="1.5"/><circle cx="14" cy="6" r="1.5"/><circle cx="6" cy="14" r="1.5"/><circle cx="14" cy="14" r="1.5"/></svg></div></div>`;
            if (filter === "") { bindDragEvents(card, realIdx); bindTouchEvents(card, realIdx); }
            grid.appendChild(card);
        });
        els.list.appendChild(section);
    });
    document.getElementById('empty-state').classList.toggle('hidden', hasVisible);
}

// --- 其余业务逻辑（已包含 whitespace-pre-wrap 修复） ---
async function handleMove(f, t, b) { if (f === t || f === -1) return; const s = prompts[f]; const tar = prompts[t]; if ((s.category || "未分类") !== (tar.category || "未分类")) s.category = tar.category || "未分类"; prompts.splice(f, 1); const nt = prompts.indexOf(tar); prompts.splice(b ? nt : nt + 1, 0, s); render(); await pushData(); }
function clearDropIndicators() { document.querySelectorAll('.title-card').forEach(c => c.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-left', 'drop-target-right')); }
async function saveConfig() { config = { token: document.getElementById('gh-token').value.trim(), gistId: document.getElementById('gist-id').value.trim() }; localStorage.setItem('gist_config', JSON.stringify(config)); await fetchData(); els.config.classList.add('hidden'); }
async function fetchData() { if (!config.token || !config.gistId) return; updateStatus('同步中...', true); try { const res = await fetch(`https://api.github.com/gists/${config.gistId}`, { headers: { 'Authorization': `token ${config.token}` } }); const data = await res.json(); prompts = JSON.parse(data.files['prompts.json'].content); render(); updateStatus('同步成功'); } catch (e) { updateStatus('获取失败'); } }
async function pushData() { if (!config.token) return; updateStatus('正在保存...', true); try { const res = await fetch(config.gistId ? `https://api.github.com/gists/${config.gistId}` : `https://api.github.com/gists`, { method: config.gistId ? 'PATCH' : 'POST', headers: { 'Authorization': `token ${config.token}` }, body: JSON.stringify({ files: { "prompts.json": { content: JSON.stringify(prompts, null, 2) } } }) }); const data = await res.json(); if (!config.gistId) { config.gistId = data.id; localStorage.setItem('gist_config', JSON.stringify(config)); document.getElementById('gist-id').value = data.id; } updateStatus('云端已更新'); } catch (e) { updateStatus('保存失败'); } }
function updateStatus(m, s = false) { els.status.classList.remove('hidden'); els.status.innerText = m; if (!s) setTimeout(() => els.status.classList.add('hidden'), 2500); }
function toggleConfig(e) { e.stopPropagation(); els.config.classList.toggle('hidden'); }
function closeModal() { showModal(false); }
function showModal(s) { els.modal.classList.toggle('hidden', !s); document.body.style.overflow = s ? 'hidden' : ''; }
function showModalMode(m) { const isV = (m === 'view'); document.getElementById('view-mode-content').classList.toggle('hidden', !isV); document.getElementById('view-actions').classList.toggle('hidden', !isV); document.getElementById('edit-mode-form').classList.toggle('hidden', isV); document.getElementById('edit-actions').classList.toggle('hidden', isV); }
function openCreateModal() { currentModalIndex = -1; document.getElementById('p-title').value = ""; document.getElementById('p-content').value = ""; document.getElementById('p-category').value = ""; document.getElementById('modal-title').innerText = "新建 PROMPT"; document.getElementById('modal-category-badge').innerText = "NEW"; showModalMode('edit'); showModal(true); }
function openViewModal(i) { currentModalIndex = i; const p = prompts[i]; document.getElementById('modal-title').innerText = p.title; document.getElementById('modal-content-html').innerHTML = marked.parse(p.content); document.getElementById('modal-category-badge').innerText = p.category || "未分类"; showModalMode('view'); showModal(true); }
function switchToEditMode() { const p = prompts[currentModalIndex]; document.getElementById('p-title').value = p.title; document.getElementById('p-content').value = p.content; document.getElementById('p-category').value = p.category || ""; showModalMode('edit'); }
async function handleSave() { const t = document.getElementById('p-title').value.trim(); const c = document.getElementById('p-content').value.trim(); const cat = document.getElementById('p-category').value.trim() || "未分类"; if (!t || !c) return; if (currentModalIndex === -1) prompts.push({ title: t, content: c, category: cat }); else prompts[currentModalIndex] = { title: t, content: c, category: cat }; render(); closeModal(); await pushData(); }
function handleSearch() { render(els.search.value.toLowerCase()); }
function copyFromModal(b) { navigator.clipboard.writeText(prompts[currentModalIndex].content); const o = b.innerText; b.innerText = "已复制 ✅"; setTimeout(() => b.innerText = o, 1500); }
function showContactUI() { showDialog({ title: "关于 & 联系", body: "联系邮箱: <span class='text-white'>Khee.huang@hotmail.com</span><br><br>提示: 如果喜欢这个工具，可以联系我进行打赏以支持后续开发。感谢支持！", confirmText: "好的", onConfirm: () => {} }); }
function confirmDeleteUI() { showDialog({ title: "确认删除", body: "确定要永久移除这个 Prompt 吗？此操作无法撤销。", confirmText: "确认删除", onConfirm: () => { prompts.splice(currentModalIndex, 1); render(); closeModal(); pushData(); } }); }
function resetConfig() { showDialog({ title: "注销确认", body: "确定要注销并清除本地同步配置吗？", confirmText: "确定注销", onConfirm: () => { localStorage.clear(); location.reload(); } }); }
function renameCategory(o) { showDialog({ title: "重命名分类", body: `正在修改分类: <span class='text-white'>${o}</span>`, showInput: { val: o }, confirmText: "保存修改", onConfirm: (n) => { if (n && n.trim() !== "" && n.trim() !== o) { prompts.forEach(p => { if ((p.category || "未分类") === o) p.category = n.trim(); }); render(); pushData(); } } }); }
function showDialog({ title, body, showInput, confirmText, onConfirm }) { document.getElementById('dialog-header').innerText = title; document.getElementById('dialog-body').innerHTML = body; const iW = document.getElementById('dialog-input-wrapper'); const iF = document.getElementById('dialog-input'); if (showInput) { iW.classList.remove('hidden'); iF.value = showInput.val || ''; } else { iW.classList.add('hidden'); } document.getElementById('dialog-confirm-btn').onclick = () => { onConfirm(showInput ? iF.value : null); closeDialog(); }; document.getElementById('dialog-backdrop').classList.remove('hidden'); }
function closeDialog() { document.getElementById('dialog-backdrop').classList.add('hidden'); }