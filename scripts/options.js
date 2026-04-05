// scripts/options.js

const SIGNATURE = '\n\n---\nUploaded via FA Super Scheduler: https://github.com/GhostInShell777/FA-Super-Scheduller';
const DEFAULT_SETTINGS = {
    uiLang:       'uk',
    appendSig:    true,
    minGapSec:    45,
    maxAttempts:  3,
};

// ─── ІНІЦІАЛІЗАЦІЯ ───
document.addEventListener('DOMContentLoaded', async () => {
    // Локалізація
    const lang = await i18n.init();
    markActiveLang(lang);

    // Завантажуємо налаштування
    const settings = await loadSettings();
    applySettingsToUI(settings);

    // ── Перемикачі мови (два: у header і у секції) ──
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const l = btn.dataset.lang;
            await i18n.switchLang(l);
            await chrome.storage.sync.set({ uiLang: l });
            markActiveLang(l);
        });
    });

    // ── Зберегти ──
    document.getElementById('btnSave')?.addEventListener('click', async () => {
        const settings = readSettingsFromUI();
        await chrome.storage.sync.set(settings);
        const status = document.getElementById('saveStatus');
        if (status) {
            status.textContent = i18n.t('opt_saved');
            setTimeout(() => status.textContent = '', 2500);
        }
    });

    // ── Очистити чергу ──
    document.getElementById('btnClearQueue')?.addEventListener('click', async () => {
        if (confirm(i18n.t('opt_confirm_clear_queue'))) {
            await chrome.storage.local.set({ queue: [], isRunning: false, isUploading: false });
            alert('✅ Queue cleared.');
        }
    });

    // ── Скинути всі дані ──
    document.getElementById('btnClearAll')?.addEventListener('click', async () => {
        if (confirm(i18n.t('opt_confirm_clear_all'))) {
            await chrome.storage.local.clear();
            await chrome.storage.sync.clear();
            await chrome.storage.sync.set(DEFAULT_SETTINGS);
            alert('✅ All data reset.');
            location.reload();
        }
    });
});

// ─── HELPERS ───
async function loadSettings() {
    const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
    return { ...DEFAULT_SETTINGS, ...stored };
}

function applySettingsToUI(s) {
    const sig = document.getElementById('optSignature');
    const gap = document.getElementById('optMinGap');
    const att = document.getElementById('optMaxAttempts');
    if (sig) sig.checked   = s.appendSig ?? true;
    if (gap) gap.value     = s.minGapSec ?? 45;
    if (att) att.value     = s.maxAttempts ?? 3;
}

function readSettingsFromUI() {
    const lang = document.querySelector('.lang-btn.active')?.dataset.lang || 'uk';
    const sig  = document.getElementById('optSignature')?.checked ?? true;
    const gap  = Math.max(40, parseInt(document.getElementById('optMinGap')?.value || '45', 10));
    const att  = Math.max(1, Math.min(10, parseInt(document.getElementById('optMaxAttempts')?.value || '3', 10)));
    return { uiLang: lang, appendSig: sig, minGapSec: gap, maxAttempts: att };
}

function markActiveLang(lang) {
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === lang);
    });
}
