// scripts/i18n.js
// Легкий локалізатор: завантажує _locales/{lang}/messages.json
// і підставляє тексти за атрибутами data-i18n у DOM.

window.i18n = (() => {
    let _dict = {};
    let _lang = 'uk';

    async function load(lang) {
        try {
            const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
            const resp = await fetch(url);
            _dict = await resp.json();
            _lang = lang;
        } catch (e) {
            console.warn('i18n: не вдалося завантажити', lang, e);
        }
    }

    function t(key) {
        return _dict[key]?.message ?? key;
    }

    function applyToDOM(root = document) {
        // data-i18n — замінює повністю весь textContent (лише якщо немає дочірніх елементів)
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = t(key);
            // Якщо є дочірні ЕЛЕМЕНТИ (не просто текстові вузли) — не чіпаємо
            if (el.children.length === 0) {
                el.textContent = val;
            }
        });

        // data-i18n-html — замінює тільки перший текстовий вузол, дочірні елементи не чіпає
        // Використовується для кнопок типу "📋 Черга <span badge>2</span>"
        root.querySelectorAll('[data-i18n-prefix]').forEach(el => {
            const key = el.getAttribute('data-i18n-prefix');
            const val = t(key);
            // Знаходимо перший текстовий вузол і замінюємо тільки його
            for (const node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    node.textContent = val + ' ';
                    break;
                }
            }
        });

        // data-i18n-placeholder
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
        });

        // data-i18n-title
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.getAttribute('data-i18n-title'));
        });
    }

    async function init() {
        const { uiLang = 'uk' } = await chrome.storage.sync.get('uiLang');
        await load(uiLang);
        applyToDOM();
        return _lang;
    }

    async function switchLang(lang) {
        await load(lang);
        await chrome.storage.sync.set({ uiLang: lang });
        applyToDOM();
        return lang;
    }

    return { init, load, switchLang, t, applyToDOM };
})();