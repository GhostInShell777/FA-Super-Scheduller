// scripts/popup.js
// ── Константи ──
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MIN_SIZE_BYTES = 10 * 1024;
const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const formatSize = b => (b / 1024).toFixed(0) + " KB";

// Поточний ID для модалки редагування
let editingId = null;

// ─────────────────────────────────────────
//  ДОПОМІЖНІ: РЕЙТИНГ
// ─────────────────────────────────────────
const RATING_CLASS = { '0': 'rb-g', '2': 'rb-m', '1': 'rb-a' };
const RATING_LABEL = { '0': 'General', '2': 'Mature', '1': 'Adult' };
const BADGE_RATING = { '0': 'badge-g', '2': 'badge-m', '1': 'badge-a' };

function setupRatingGroup(groupId, radioName) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.rating-btn').forEach(b => {
                b.className = 'rating-btn';
            });
            const radio = btn.querySelector('input');
            radio.checked = true;
            btn.classList.add(RATING_CLASS[radio.value] || 'rb-g');
        });
    });
    // дефолт — General
    const first = group.querySelector('.rating-btn');
    if (first) first.click();
}

function getRatingValue(radioName) {
    const r = document.querySelector(`input[name="${radioName}"]:checked`);
    return r ? r.value : '0';
}

function setRatingValue(groupId, radioName, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const btn = group.querySelector(`input[value="${value}"]`)?.closest('.rating-btn');
    if (btn) btn.click();
}

// ─────────────────────────────────────────
//  ЛІЧИЛЬНИКИ СИМВОЛІВ
// ─────────────────────────────────────────
function setupCounter(inputId, counterId, max) {
    const el = document.getElementById(inputId);
    const cnt = document.getElementById(counterId);
    if (!el || !cnt) return;
    const update = () => {
        const len = el.value.length;
        cnt.textContent = `${len}/${max}`;
        cnt.className = 'char-counter' +
            (len > max ? ' over' : len > max * 0.9 ? ' warn' : '');
        el.classList.toggle('err', len > max);
    };
    el.addEventListener('input', update);
    update();
}

// ─────────────────────────────────────────
//  ПОПЕРЕДЖЕННЯ
// ─────────────────────────────────────────
function showWarning(msg, isCritical = false) {
    const area = document.getElementById('warningArea');
    if (!area) { if (isCritical) alert(msg); return; }
    const div = document.createElement('div');
    div.className = 'warn-item';
    div.style.cssText = isCritical
        ? 'border:2px solid #e04444;background:#3a1a1a;color:#fff;font-weight:600'
        : 'border:1px solid #e04444;background:#2e2020;color:#e04444';
    div.innerHTML = isCritical ? `❗ SILLY CREATURE ALERT ❗<br>${msg}` : `⚠️ ${msg}`;
    area.prepend(div);
    setTimeout(() => div.remove(), 7000);
    if (isCritical) alert(`STOP RIGHT THERE!\n\n${msg}`);
}

// ─────────────────────────────────────────
//  ВАЛІДАЦІЯ ФАЙЛУ
// ─────────────────────────────────────────
async function validateFile(file, existingQueue) {
    if (!ALLOWED_TYPES.includes(file.type)) {
        showWarning(`"${file.name}" — не картинка! Дозволено JPG, PNG, GIF, WebP.`, true);
        return null;
    }
    if (file.size === 0) {
        showWarning(`Файл "${file.name}" порожній!`, true);
        return null;
    }
    if (file.size < MIN_SIZE_BYTES) {
        showWarning(`"${file.name}" задто малий (${file.size}б). Мінімум ${formatSize(MIN_SIZE_BYTES)}.`, true);
        return null;
    }
    if (file.size > MAX_SIZE_BYTES) {
        showWarning(`"${file.name}" завеликий. Макс. ${formatSize(MAX_SIZE_BYTES)}.`, true);
        return null;
    }
    const corrupt = await new Promise(res => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); res(false); };
        img.onerror = () => { URL.revokeObjectURL(url); res(true); };
        img.src = url;
    });
    if (corrupt) { showWarning(`"${file.name}": пошкоджений файл.`, true); return null; }

    const hash = Array.from(new Uint8Array(
        await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
    )).map(b => b.toString(16).padStart(2, '0')).join('');

    if (existingQueue.some(i => i.hash === hash)) {
        showWarning(`"${file.name}" вже є у черзі.`);
        return null;
    }
    return hash;
}

// ─────────────────────────────────────────
//  ЗБІР НАЛАШТУВАНЬ ФОРМИ (вкладка "Додати")
// ─────────────────────────────────────────
function collectForm() {
    const titleVal = (document.getElementById('commonTitle')?.value || '').trim();
    if (titleVal.length > 60) { showWarning('Назва > 60 символів!', true); return null; }

    const tagsRaw = (document.getElementById('commonTags')?.value || '').trim();
    if (tagsRaw.length > 500) { showWarning('Keywords > 500 символів!', true); return null; }

    const genderTags = Array.from(document.querySelectorAll('.g-check:checked')).map(c => c.value);
    const allTags = [...tagsRaw.split(/\s+/).filter(Boolean), ...genderTags].join(' ');

    const wordCount = allTags.split(/\s+/).filter(Boolean).length;
    if (wordCount < 3) { showWarning('FA вимагає мінімум 3 keywords!', true); return null; }

    const descVal = (document.getElementById('commonDesc')?.value || '').trim();
    if (descVal.length > 65000) { showWarning('Опис > 65000 символів!', true); return null; }

    const rating = getRatingValue('rating');
    if (!document.querySelector('input[name="rating"]:checked')) {
        showWarning('Вибери рейтинг!', true); return null;
    }

    return {
        title: titleVal,
        description: descVal,
        tags: allTags,
        category: document.getElementById('commonCat')?.value || '1',
        theme: document.getElementById('commonTheme')?.value || '1',
        species: document.getElementById('commonSpecies')?.value || '1',
        rating,
        folder: (document.getElementById('commonFolder')?.value || '').trim(),
        scraps: document.getElementById('optScraps')?.checked ? '1' : '0',
        lockComments: document.getElementById('optLockComments')?.checked ? '1' : '0',
    };
}

// ─────────────────────────────────────────
//  МІНІАТЮРА З BASE64
// ─────────────────────────────────────────
function makeThumb(fileData) {
    if (!fileData) return `<div class="q-thumb-wrap"><span class="q-thumb-placeholder">🖼️</span></div>`;
    return `<div class="q-thumb-wrap"><img class="q-thumb" src="${fileData}" loading="lazy"></div>`;
}

// ─────────────────────────────────────────
//  РЕНДЕР ЧЕРГИ
// ─────────────────────────────────────────
async function renderQueue() {
    const { queue = [], isRunning = false } = await chrome.storage.local.get(['queue', 'isRunning']);
    const list = document.getElementById('queueList');
    if (!list) return;

    // Badge на вкладці
    const badge = document.getElementById('queueBadge');
    if (badge) {
        badge.textContent = queue.length;
        badge.style.display = queue.length > 0 ? 'inline-block' : 'none';
    }

    // Статус у header
    const statusEl = document.getElementById('headerStatus');
    if (statusEl) {
        if (isRunning) {
            statusEl.textContent = '▶ Запущено';
            statusEl.className = 'header-status status-running';
        } else {
            statusEl.textContent = '⏸ Idle';
            statusEl.className = 'header-status status-idle';
        }
    }

    // Кнопки Start/Stop
    const btnStart = document.getElementById('btnStart');
    const btnStop = document.getElementById('btnStop');
    if (btnStart && btnStop) {
        btnStart.style.display = isRunning ? 'none' : '';
        btnStop.style.display = isRunning ? '' : 'none';
        btnStart.disabled = queue.length === 0;
    }

    // Заголовок черги
    const qTitle = document.getElementById('queueTitle');
    if (qTitle) qTitle.textContent = `Черга (${queue.length})`;

    if (queue.length === 0) {
        list.innerHTML = '<div class="empty-hint">🌙 Черга порожня. Додай файли у вкладці "Додати".</div>';
        return;
    }

    list.innerHTML = queue.map((item, i) => {
        const rClass = BADGE_RATING[item.rating] || 'badge-g';
        const rLabel = RATING_LABEL[item.rating] || 'G';
        const timeStr = item.scheduledTime
            ? new Date(item.scheduledTime).toLocaleTimeString()
            : '—';
        const isNext = isRunning && i === 0;

        return `
        <div class="q-item${isNext ? ' style="border-color:var(--warn)"' : ''}" data-id="${item.id}">
            <span class="q-num">${i + 1}</span>
            ${makeThumb(item.fileData)}
            <div class="q-info">
                <div class="q-title" title="${item.title || 'Untitled'}">${item.title || 'Untitled'}</div>
                <div class="q-meta">⏰ ${timeStr} · ${item.fileName || ''}</div>
                <div class="q-badges">
                    <span class="badge ${rClass}">${rLabel}</span>
                    ${item.scraps === '1' ? '<span class="badge badge-s">Scraps</span>' : ''}
                    ${item.folder ? `<span class="badge badge-f">📁 ${item.folder}</span>` : ''}
                    ${isNext ? '<span class="badge badge-t">⏭ NEXT</span>' : ''}
                </div>
            </div>
            <div class="q-actions">
                <button class="btn-icon edit-btn" title="Редагувати" data-id="${item.id}">✏️</button>
                <button class="btn-icon del del-btn" title="Видалити" data-id="${item.id}">✕</button>
            </div>
        </div>`;
    }).join('');

    // Обробники кнопок
    list.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id, queue));
    });
    list.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseFloat(btn.dataset.id);
            const { queue: q = [] } = await chrome.storage.local.get(['queue']);
            await chrome.storage.local.set({ queue: q.filter(i => i.id !== id) });
            renderQueue();
        });
    });
}

// ─────────────────────────────────────────
//  ЗАПУСТИТИ / ЗУПИНИТИ / ПЛАНУВАЛЬНИК
// ─────────────────────────────────────────
let countdownInterval = null;
const MIN_GAP = 40000; // мінімальна примусова пауза між файлами (40 сек)

async function startQueue() {
    const { queue = [] } = await chrome.storage.local.get(['queue']);
    if (queue.length === 0) return;

    const gapMs = Math.max(
        parseInt(document.getElementById('uploadGap')?.value || '45000', 10),
        MIN_GAP
    );

    const now = Date.now();
    queue[0].scheduledTime = now + 2000;
    for (let i = 1; i < queue.length; i++) {
        queue[i].scheduledTime = queue[i - 1].scheduledTime + gapMs;
        queue[i].attempts = queue[i].attempts || 0; // ініціалізуємо лічильник спроб
    }
    queue[0].attempts = queue[0].attempts || 0;

    await chrome.storage.local.set({ queue, isRunning: true, scheduledStart: null });
    updateSchedulerUI(null);
    renderQueue();
}

async function stopQueue() {
    await chrome.storage.local.set({ isRunning: false, isUploading: false });
    clearInterval(countdownInterval);
    renderQueue();
}

// ── Підтвердити запланований час ──
async function confirmSchedule() {
    let target = 0;
    const dtInput = document.getElementById('scheduleDateTime');

    // ПЕРЕВІРКА: чи використовуємо ми один інпут datetime-local чи два окремі?
    if (dtInput && dtInput.value) {
        target = new Date(dtInput.value).getTime();
    } else {
        const dInput = document.getElementById('schedDate');
        const tInput = document.getElementById('schedTime');
        if (dInput?.value && tInput?.value) {
            target = new Date(`${dInput.value}T${tInput.value}:00`).getTime();
        }
    }

    if (!target) {
        alert('Виберіть дату та час!');
        return;
    }

    if (target <= Date.now()) {
        alert('Вибраний час вже минув! Виберіть час у майбутньому.');
        return;
    }

    const diffDays = (target - Date.now()) / 86400000;
    if (diffDays > 1) {
        const ok = confirm(
            `⚠️ Ти плануєш старт на ${diffDays.toFixed(1)} дн. вперед.\n\n` +
            `Якщо комп'ютер засне або браузер закриється — розклад може не спрацювати.\n\n` +
            `Продовжити?`
        );
        if (!ok) return;
    }

    const { queue = [] } = await chrome.storage.local.get(['queue']);
    if (queue.length === 0) { alert('Черга порожня!'); return; }

    await chrome.storage.local.set({ scheduledStart: target });
    updateSchedulerUI(target);
}

// ── Скасувати розклад ──
async function cancelSchedule() {
    await chrome.storage.local.set({ scheduledStart: null });
    updateSchedulerUI(null);
}

// ── Оновити UI планувальника ──
function updateSchedulerUI(target) {
    const statusEl = document.getElementById('schedulerStatus');
    const countEl = document.getElementById('schedulerCountdown');
    const cancelBtn = document.getElementById('btnCancelSchedule');
    const schedBtn = document.getElementById('btnSchedule');

    clearInterval(countdownInterval);

    if (!target) {
        if (statusEl) statusEl.textContent = 'не заплановано';
        if (countEl) countEl.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (schedBtn) schedBtn.style.display = '';
        return;
    }

    if (statusEl) statusEl.textContent = `⏳ ${new Date(target).toLocaleString('uk-UA')}`;
    if (countEl) countEl.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = '';
    if (schedBtn) schedBtn.style.display = 'none';

    const tick = () => {
        const diff = target - Date.now();
        if (!countEl) return;
        if (diff <= 0) {
            clearInterval(countdownInterval);
            countEl.textContent = '🚀 Запускаємо...';
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        countEl.textContent =
            `⏱ До старту: ${h}г ${String(m).padStart(2, '0')}хв ${String(s).padStart(2, '0')}с`;
    };
    tick();
    countdownInterval = setInterval(tick, 1000);
}

// ── Перевірка запланованого старту (викликається popup'ом раз на секунду) ──
let schedulePoller = null;
function startSchedulePoller() {
    if (schedulePoller) return;
    schedulePoller = setInterval(async () => {
        const { scheduledStart, isRunning, queue = [] } = await chrome.storage.local.get(['scheduledStart', 'isRunning', 'queue']);
        if (scheduledStart && !isRunning && Date.now() >= scheduledStart && queue.length > 0) {
            await chrome.storage.local.set({ scheduledStart: null });
            updateSchedulerUI(null);
            await startQueue();
        }
    }, 1000);
}

// ─────────────────────────────────────────
//  МОДАЛКА РЕДАГУВАННЯ
// ─────────────────────────────────────────
function openEditModal(idStr, queue) {
    editingId = parseFloat(idStr);
    const item = queue.find(i => i.id === editingId);
    if (!item) return;

    // Заголовок модалки
    document.getElementById('modalTitle').textContent = `✏️ ${item.title || 'Без назви'}`;

    // Заповнюємо поля
    document.getElementById('mTitle').value = item.title || '';
    document.getElementById('mDesc').value = item.description || '';
    document.getElementById('mTags').value = item.tags || '';
    document.getElementById('mCat').value = item.category || '1';
    document.getElementById('mTheme').value = item.theme || '1';
    document.getElementById('mSpecies').value = item.species || '1';
    document.getElementById('mFolder').value = item.folder || '';
    document.getElementById('mScraps').checked = item.scraps === '1';
    document.getElementById('mLockComments').checked = item.lockComments === '1';

    // Оновлюємо лічильники
    ['mTitle', 'mDesc', 'mTags'].forEach(id => {
        document.getElementById(id).dispatchEvent(new Event('input'));
    });

    // Рейтинг
    setRatingValue('mRatingGroup', 'mrating', item.rating || '0');

    // Відкриваємо
    document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
    editingId = null;
}

async function saveEdit() {
    if (editingId === null) return;

    const titleVal = (document.getElementById('mTitle')?.value || '').trim();
    if (titleVal.length > 60) { alert('Назва > 60 символів!'); return; }

    const tagsVal = (document.getElementById('mTags')?.value || '').trim();
    if (tagsVal.length > 500) { alert('Keywords > 500 символів!'); return; }
    if (tagsVal.split(/\s+/).filter(Boolean).length < 3) { alert('Мінімум 3 keywords!'); return; }

    const descVal = (document.getElementById('mDesc')?.value || '').trim();
    if (descVal.length > 65000) { alert('Опис > 65000 символів!'); return; }

    const { queue = [] } = await chrome.storage.local.get(['queue']);
    const idx = queue.findIndex(i => i.id === editingId);
    if (idx === -1) { closeEditModal(); return; }

    queue[idx] = {
        ...queue[idx],
        title: titleVal,
        description: descVal,
        tags: tagsVal,
        category: document.getElementById('mCat')?.value || '1',
        theme: document.getElementById('mTheme')?.value || '1',
        species: document.getElementById('mSpecies')?.value || '1',
        rating: getRatingValue('mrating'),
        folder: (document.getElementById('mFolder')?.value || '').trim(),
        scraps: document.getElementById('mScraps')?.checked ? '1' : '0',
        lockComments: document.getElementById('mLockComments')?.checked ? '1' : '0',
    };

    await chrome.storage.local.set({ queue });
    closeEditModal();
    renderQueue();
}

// ─────────────────────────────────────────
//  ВКЛАДКИ
// ─────────────────────────────────────────
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${tab}`)?.classList.add('active');
            if (tab === 'queue') renderQueue();
        });
    });
}

// ─────────────────────────────────────────
//  ПІДПИС (підтягується з налаштувань)
// ─────────────────────────────────────────
const SIGNATURE_TEXT = '\n\n---\nUploaded via FA Super Scheduler: https://github.com/GhostInShell777/FA-Super-Scheduller';

async function buildDescription(rawDesc) {
    const { appendSig = true } = await chrome.storage.sync.get('appendSig');
    return appendSig ? (rawDesc || '') + SIGNATURE_TEXT : (rawDesc || '');
}

// ─────────────────────────────────────────
//  МОВА — позначення активної кнопки
// ─────────────────────────────────────────
function markPopupLang(lang) {
    document.querySelectorAll('.popup-lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
    });
}

// ─────────────────────────────────────────
//  ІНІЦІАЛІЗАЦІЯ
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // ── i18n ──
    const lang = await i18n.init();
    markPopupLang(lang);

    // Перемикачі мови у header
    document.querySelectorAll('.popup-lang-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const l = btn.dataset.lang;
            await i18n.switchLang(l);
            markPopupLang(l);
        });
    });

    // Кнопка відкрити Options
    document.getElementById('btnOpenOptions')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    setupTabs();
    setupRatingGroup('ratingGroup', 'rating');
    setupRatingGroup('mRatingGroup', 'mrating');

    // Лічильники — основна форма
    setupCounter('commonTitle', 'titleCounter', 60);
    setupCounter('commonDesc', 'descCounter', 65000);
    setupCounter('commonTags', 'tagsCounter', 500);

    // Лічильники — модалка
    setupCounter('mTitle', 'mTitleCounter', 60);
    setupCounter('mDesc', 'mDescCounter', 65000);
    setupCounter('mTags', 'mTagsCounter', 500);

    // File input → показ кількості
    document.getElementById('fileInput')?.addEventListener('change', e => {
        const n = e.target.files.length;
        document.getElementById('fileCount').textContent =
            n > 0 ? `✅ ${i18n.t('warn_added')} ${n}` : '';
    });

    // ── "Додати до черги" ──
    document.getElementById('addToQueue')?.addEventListener('click', async () => {
        const fileInput = document.getElementById('fileInput');
        if (!fileInput?.files.length) { showWarning(i18n.t('warn_no_files')); return; }

        const settings = collectForm();
        if (!settings) return;

        // Додаємо підпис до опису (один раз при збереженні в чергу)
        settings.description = await buildDescription(settings.description);

        const files = Array.from(fileInput.files);
        const { queue = [] } = await chrome.storage.local.get(['queue']);
        const { minGapSec = 45 } = await chrome.storage.sync.get('minGapSec');
        const gapMs = Math.max(
            parseInt(document.getElementById('uploadGap')?.value || '45000', 10),
            minGapSec * 1000
        );

        let added = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const hash = await validateFile(file, queue);
            if (!hash) continue;

            const base64 = await new Promise(res => {
                const reader = new FileReader();
                reader.onload = e => res(e.target.result);
                reader.readAsDataURL(file);
            });

            // scheduledTime = 0 поки черга не запущена
            // Після "Запустити" background.js отримає реальний час
            const placeholderTime = queue.length > 0
                ? queue[queue.length - 1].scheduledTime + gapMs
                : 0;

            const title = files.length > 1
                ? `${settings.title || 'Untitled'} #${i + 1}`
                : (settings.title || 'Untitled');

            queue.push({
                id: Date.now() + Math.random(),
                hash,
                title,
                fileData: base64,
                fileName: file.name,
                scheduledTime: placeholderTime,
                description: settings.description,
                tags: settings.tags,
                category: settings.category,
                theme: settings.theme,
                species: settings.species,
                rating: settings.rating,
                folder: settings.folder,
                scraps: settings.scraps,
                lockComments: settings.lockComments,
            });
            added++;
        }

        await chrome.storage.local.set({ queue });
        fileInput.value = '';
        document.getElementById('fileCount').textContent = '';

        if (added > 0) {
            showWarning(`✅ Додано ${added} файл${added > 4 ? 'ів' : added > 1 ? 'и' : ''}! Перейди у "Черга" → "Запустити".`);
            // Оновлюємо badge
            renderQueueBadge(queue.length);
        }
    });

    // ── Старт / Стоп ──
    document.getElementById('btnStart')?.addEventListener('click', startQueue);
    document.getElementById('btnStop')?.addEventListener('click', stopQueue);

    // ── Планувальник ──
    document.getElementById('btnSchedule')?.addEventListener('click', confirmSchedule);
    document.getElementById('btnCancelSchedule')?.addEventListener('click', cancelSchedule);

    // Встановлюємо мінімальний час для інпутів (якщо вони є)
    const dtInput = document.getElementById('scheduleDateTime');
    const dInput = document.getElementById('schedDate');
    if (dtInput) {
        dtInput.min = new Date(Date.now() + 60000).toISOString().slice(0, 16);
    }
    if (dInput) {
        dInput.min = new Date().toISOString().split('T')[0];
    }

    // Відновлюємо стан планувальника після відкриття попапу
    chrome.storage.local.get(['scheduledStart'], ({ scheduledStart }) => {
        if (scheduledStart && scheduledStart > Date.now()) {
            updateSchedulerUI(scheduledStart);
        }
    });

    // ── Очистити все ──
    document.getElementById('btnClear')?.addEventListener('click', async () => {
        if (confirm('Видалити ВСЮ чергу?')) {
            await chrome.storage.local.set({ queue: [], isRunning: false, isUploading: false });
            renderQueue();
        }
    });

    // ── Модалка ──
    document.getElementById('modalClose')?.addEventListener('click', closeEditModal);
    document.getElementById('modalCancel')?.addEventListener('click', closeEditModal);
    document.getElementById('modalSave')?.addEventListener('click', saveEdit);
    document.getElementById('editModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeEditModal();
    });

    // Початковий рендер
    renderQueue();
    startSchedulePoller();

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.queue || changes.isRunning) renderQueue();
    });
});

function renderQueueBadge(count) {
    const badge = document.getElementById('queueBadge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}