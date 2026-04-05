// scripts/content.js
console.log("FA Super Scheduler PRO: content.js завантажено на", window.location.href);

// 1. Слухач повідомлень від background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "uploadItem") {
        console.log("📨 Отримано завдання на upload:", message.item.title);
        uploadToFA(message.item)
            .then(result => sendResponse(result))
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }
});

// 2. Допоміжні функції
function collectHiddenFields(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const fields = {};
    doc.querySelectorAll('input[type="hidden"]').forEach(input => {
        if (input.name) fields[input.name] = input.value;
    });
    return fields;
}

// 3. Основна функція Upload
async function uploadToFA(item) {
    console.group(`🚀 Upload: ${item.title}`);
    try {
        // Перетворюємо Base64 у Blob
        const blobRes = await fetch(item.fileData);
        const fileBlob = await blobRes.blob();
        console.log(`📦 Розмір файлу: ${(fileBlob.size / 1024).toFixed(2)} KB`);
        if (fileBlob.size === 0) throw new Error("Файл порожній!");

        // КРОК 1: Отримуємо ключі сесії
        console.log("1️⃣ Отримання токенів...");
        const res0 = await fetch('https://www.furaffinity.net/submit/', { credentials: 'include' });
        const html1 = await res0.text();
        const fields1 = collectHiddenFields(html1);
        if (!fields1.key) throw new Error("Не знайдено KEY. Можливо, ви не авторизовані?");

        // КРОК 2: Завантаження файлу
        console.log("2️⃣ Відправка файлу на сервер...");
        const form1 = new FormData();
        for (const [key, value] of Object.entries(fields1)) form1.append(key, value);
        form1.set('part', '2');
        form1.set('submission_type', 'submission');
        form1.append('submission', fileBlob, item.fileName || "image.jpg");

        const res1 = await fetch('https://www.furaffinity.net/submit/upload/', {
            method: 'POST', body: form1, credentials: 'include'
        });
        const html2 = await res1.text();
        if (!html2.toLowerCase().includes('finalize')) {
            throw new Error("FA не прийняв файл (немає переходу до Finalize)");
        }

        // КРОК 3: Фіналізація з усіма метаданими
        console.log("3️⃣ Публікація метаданих...");
        const fields2 = collectHiddenFields(html2);
        const params = new URLSearchParams();

        // Технічні поля від FA
        for (const [name, value] of Object.entries(fields2)) params.append(name, value);

        // ── Основні метадані ──
        params.set('title', item.title || "Untitled");
        params.set('message', item.description || "Uploaded with FA Super Scheduler");
        params.set('keywords', (item.tags || "art drawing ferret").trim());

        // ── Класифікація ──
        // Рейтинг: 0=General, 2=Mature, 1=Adult (точні значення з FA)
        params.set('rating', item.rating ?? '0');
        params.set('cat', item.category || '1');   // Категорія
        params.set('atype', item.theme || '1');   // Тема
        params.set('species', item.species || '1');   // Вид
        params.set('gender', '0');                    // Gender іде через keywords, не окреме поле

        // ── Опції ──
        if (item.scraps === '1') params.set('scrap', '1');
        if (item.lockComments === '1') params.set('lock_comments', '1');

        // ── Папка ──
        if (item.folder && item.folder.trim()) {
            params.set('create_folder_name', item.folder.trim());
        }

        // Фіналізуємо кнопку
        params.set('submit', 'Publish');
        params.set('finalize', 'Finalize ');

        // Невелика затримка перед фіналізацією
        await new Promise(r => setTimeout(r, 1500));

        const res2 = await fetch('https://www.furaffinity.net/submit/finalize/', {
            method: 'POST',
            body: params,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://www.furaffinity.net/submit/upload/'
            }
        });

        if (res2.url.includes('/view/')) {
            console.log("🏆 Опубліковано:", res2.url);
            return { success: true, url: res2.url };
        } else {
            const finalText = await res2.text();
            const doc = new DOMParser().parseFromString(finalText, 'text/html');
            const errBox = doc.querySelector('.error, .notice-message, .section-header');
            throw new Error(errBox ? errBox.innerText.trim() : "Помилка при збереженні");
        }

    } catch (e) {
        console.error("❌ Помилка:", e.message);
        return { success: false, error: e.message };
    } finally {
        console.groupEnd();
    }
}

// 4. UI-інжекція на сторінку FA (без змін)
const observer = new MutationObserver((mutations, obs) => {
    const mainForm = document.querySelector('form[action*="/submit/upload/"]');
    if (mainForm) { injectQueueUI(mainForm); obs.disconnect(); }
});
observer.observe(document.body, { childList: true, subtree: true });

function injectQueueUI(mainForm) {
    if (document.getElementById('fa-scheduler-container')) return;
    const container = document.createElement('div');
    container.id = "fa-scheduler-container";
    container.style.cssText = "border:3px solid #ffab52; padding:15px; background:#2e3e4f; color:white; margin:20px 0; border-radius:8px;";
    container.innerHTML = `
        <h3 style="color:#ffab52; margin-top:0;">🚀 FA Scheduler — Активні завдання</h3>
        <div id="fa-queue-manager"></div>
        <button id="fa-clear-queue" style="margin-top:10px; padding:8px 15px; background:#cc3333; color:white; border:none; cursor:pointer; border-radius:4px;">🗑 Видалити все</button>
    `;
    mainForm.parentNode.insertBefore(container, mainForm);
    mainForm.style.display = "none";
    document.getElementById('fa-clear-queue').onclick = async () => {
        if (confirm("Видалити всю чергу?")) await chrome.storage.local.set({ queue: [] });
    };
    chrome.storage.onChanged.addListener(changes => {
        if (changes.queue) renderQueue(changes.queue.newValue || []);
    });
    chrome.storage.local.get(["queue"], data => renderQueue(data.queue || []));
}

function renderQueue(queue) {
    const manager = document.getElementById('fa-queue-manager');
    if (!manager) return;
    const ratingLabel = { '0': 'G', '2': 'M', '1': 'A' };
    manager.innerHTML = queue.length === 0
        ? '<p style="color:#aaa;">Черга порожня.</p>'
        : queue.map((item, i) => `
            <div style="border:1px solid #4e5e6f; padding:8px; margin-bottom:5px; border-radius:4px; background:#23313f; display:flex; justify-content:space-between;">
                <span>${i + 1}. <b>${item.title}</b>
                    <small style="color:#888;">
                        ⏰ ${new Date(item.scheduledTime).toLocaleTimeString()}
                        · [${ratingLabel[item.rating] || 'G'}]
                        ${item.scraps === '1' ? '· scraps' : ''}
                    </small>
                </span>
            </div>
        `).join('');
}