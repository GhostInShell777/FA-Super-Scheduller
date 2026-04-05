// background.js — FA Super Scheduler PRO
// Роль: будильник + усі захисти

const MIN_GAP_MS = 40000;  // примусовий мінімум між завантаженнями (40 сек)
const MAX_ATTEMPTS = 5;      // макс. спроб для одного файлу
const RETRY_DELAY = 180000; // затримка після помилки (3 хв)

// ─────────────────────────────────────────
//  БУДИЛЬНИКИ
// ─────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("checkQueue", { periodInMinutes: 0.5 });
    chrome.alarms.create("checkSchedule", { periodInMinutes: 0.25 });
    console.log("FA Scheduler: Будильники активовано!");
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create("checkQueue", { periodInMinutes: 0.5 });
    chrome.alarms.create("checkSchedule", { periodInMinutes: 0.25 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkQueue") processQueue();
    if (alarm.name === "checkSchedule") checkScheduledStart();
});

// ─────────────────────────────────────────
//  ПЕРЕВІРКА ЗАПЛАНОВАНОГО СТАРТУ
//  (background слідкує навіть коли popup закритий)
// ─────────────────────────────────────────
async function checkScheduledStart() {
    const { scheduledStart, isRunning, queue = [] } =
        await chrome.storage.local.get(['scheduledStart', 'isRunning', 'queue']);

    if (!scheduledStart || isRunning || queue.length === 0) return;
    if (Date.now() < scheduledStart) return;

    console.log("📅 Запланований час настав! Запускаємо чергу...");

    const gapMs = 45000;
    const now = Date.now();
    queue[0].scheduledTime = now + 2000;
    queue[0].attempts = queue[0].attempts || 0;
    for (let i = 1; i < queue.length; i++) {
        queue[i].scheduledTime = queue[i - 1].scheduledTime + Math.max(gapMs, MIN_GAP_MS);
        queue[i].attempts = queue[i].attempts || 0;
    }

    await chrome.storage.local.set({ queue, isRunning: true, scheduledStart: null });

    chrome.notifications.create("scheduled-start", {
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "FA Super Scheduler",
        message: "📅 Запланований старт! Черга запущена автоматично."
    });
}

// ─────────────────────────────────────────
//  ГОЛОВНА ФУНКЦІЯ ОБРОБКИ ЧЕРГИ
// ─────────────────────────────────────────
async function processQueue() {
    const data = await chrome.storage.local.get(["queue", "isUploading", "isRunning"]);

    // ── Базові перевірки ──
    if (!data.isRunning) return;
    if (data.isUploading) return;
    if (!data.queue?.length) return;

    const item = data.queue[0];
    if (Date.now() < item.scheduledTime) return;

    // ── Перевірка з'єднання ──
    const online = await checkOnline();
    if (!online) {
        console.warn("⚠️ Відсутній інтернет. Пауза.");
        await chrome.storage.local.set({ isRunning: false });
        chrome.notifications.create("offline-warning", {
            type: "basic", iconUrl: "icons/icon16.png",
            title: "FA Super Scheduler",
            message: "⚠️ Інтернет відсутній. Черга на паузі — відновіть вручну."
        });
        return;
    }

    // ── Перевірка авторизації ──
    const authed = await checkFAAuth();
    if (!authed) {
        console.warn("🔐 Не авторизовано на FA!");
        await chrome.storage.local.set({ isRunning: false });
        chrome.notifications.create("auth-warning", {
            type: "basic", iconUrl: "icons/icon16.png",
            title: "FA Super Scheduler",
            message: "🔐 Не авторизовано на FurAffinity! Черга зупинена."
        });
        return;
    }

    // ── Ліміт спроб ──
    if ((item.attempts || 0) >= MAX_ATTEMPTS) {
        console.error(`❌ "${item.title}" — ${MAX_ATTEMPTS} помилок. Пропускаємо.`);
        const newQueue = data.queue.slice(1);

        if (newQueue.length === 0) {
            await chrome.storage.local.set({ queue: [], isRunning: false });
        } else {
            const minNext = Date.now() + MIN_GAP_MS;
            if (newQueue[0].scheduledTime < minNext) newQueue[0].scheduledTime = minNext;
            await chrome.storage.local.set({ queue: newQueue });
        }

        chrome.notifications.create({
            type: "basic", iconUrl: "icons/icon16.png",
            title: "FA Super Scheduler",
            message: `❌ Пропущено (5 помилок): ${item.title}`
        });
        return;
    }

    // ── Шукаємо вкладку FA ──
    console.log("⏰ Час! Шукаємо вкладку FA...");
    const tabs = await chrome.tabs.query({
        url: "https://www.furaffinity.net/*",
        status: "complete"
    });

    if (tabs.length === 0) {
        chrome.notifications.create("no-tab-warning", {
            type: "basic", iconUrl: "icons/icon16.png",
            title: "FA Super Scheduler",
            message: "⚠️ Відкрийте FurAffinity! Черга чекає."
        });
        return;
    }

    const submitTab = tabs.find(t => t.url.includes('/submit/')) || tabs[0];
    await chrome.storage.local.set({ isUploading: true });

    try {
        const response = await chrome.tabs.sendMessage(submitTab.id, {
            action: "uploadItem",
            item: item
        });

        if (response?.success) {
            console.log("🏆 Опубліковано:", item.title, "→", response.url);

            // ── Видаляємо Base64 після успіху (звільняємо пам'ять) ──
            let newQueue = data.queue.slice(1);
            // item.fileData вже не потрібен, але він у об'єкті який ми вже зрізали

            if (newQueue.length === 0) {
                await chrome.storage.local.set({ queue: [], isRunning: false });
                chrome.notifications.create("queue-done", {
                    type: "basic", iconUrl: "icons/icon48.png",
                    title: "FA Super Scheduler ✅",
                    message: "Черга завершена! Всі файли опубліковано. 🎉"
                });
                return;
            }

            // ── Примусова пауза між файлами (захист від бану FA) ──
            const now = Date.now();
            const minNext = now + MIN_GAP_MS;
            if (newQueue[0].scheduledTime < minNext) {
                newQueue[0].scheduledTime = minNext;
            }

            await chrome.storage.local.set({ queue: newQueue });

            chrome.notifications.create({
                type: "basic", iconUrl: "icons/icon16.png",
                title: "FA Super Scheduler",
                message: `✅ Опубліковано: ${item.title}`
            });

        } else {
            // ── Невдача → збільшуємо лічильник спроб ──
            const attempts = (item.attempts || 0) + 1;
            console.warn(`⚠️ Спроба ${attempts}/${MAX_ATTEMPTS}:`, response?.error);
            data.queue[0].attempts = attempts;
            data.queue[0].scheduledTime = Date.now() + RETRY_DELAY;
            await chrome.storage.local.set({ queue: data.queue });
        }

    } catch (e) {
        const attempts = (item.attempts || 0) + 1;
        console.error(`🛑 Помилка зв'язку (спроба ${attempts}):`, e.message);
        data.queue[0].attempts = attempts;
        data.queue[0].scheduledTime = Date.now() + 120000;
        await chrome.storage.local.set({ queue: data.queue });
    } finally {
        await chrome.storage.local.set({ isUploading: false });
        console.log("🏁 isUploading скинуто.");
    }
}

// ─────────────────────────────────────────
//  ДОПОМІЖНІ: ПЕРЕВІРКИ
// ─────────────────────────────────────────

// Перевірка інтернету — HEAD-запит до FA
async function checkOnline() {
    try {
        const r = await fetch('https://www.furaffinity.net/favicon.ico', {
            method: 'HEAD', cache: 'no-store'
        });
        return r.ok || r.status < 500;
    } catch {
        return false;
    }
}

// Перевірка авторизації — наявність key на /submit/
async function checkFAAuth() {
    try {
        const r = await fetch('https://www.furaffinity.net/submit/', { credentials: 'include' });
        const html = await r.text();
        return html.includes('name="key"') || html.includes('logout');
    } catch {
        return false;
    }
}