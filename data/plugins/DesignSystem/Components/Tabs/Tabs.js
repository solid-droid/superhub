const TABS_HTML_URL = new URL('./Tabs.html', import.meta.url);
const TABS_CSS_URL = new URL('./Tabs.css', import.meta.url);
const TABS_CSS_LINK_ID = 'ds-tabs-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(TABS_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = TABS_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = TABS_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(TABS_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load tabs template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let tabsTemplateHtml = '<div class="ds-tabs ds-tabs-underline"><div class="ds-tabs-nav"></div><div class="ds-tabs-content"></div></div>';

try {
    tabsTemplateHtml = await loadTemplateHtml();
} catch {
    // Keep fallback.
}

class Tabs {
    constructor(options = {}) {
        this.items = Array.isArray(options.items) ? options.items : [];
        this.variant = options.variant || 'underline';
        this.active = options.active || 0;
        this.element = this.createDOM();
    }

    createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(tabsTemplateHtml).trim();
        const root = template.content.firstElementChild;
        const nav = root.querySelector('.ds-tabs-nav');
        const content = root.querySelector('.ds-tabs-content');

        root.className = `ds-tabs ds-tabs-${this.variant}`;

        this.items.forEach((item, index) => {
            const btn = document.createElement('button');
            btn.className = 'ds-tabs-btn';
            btn.textContent = item.label || `Tab ${index + 1}`;
            btn.addEventListener('click', () => {
                this.active = index;
                this.renderContent(content, item.content || '');
            });
            nav.appendChild(btn);
        });

        this.renderContent(content, this.items[this.active]?.content || '');
        return root;
    }

    renderContent(container, content) {
        container.innerHTML = String(content || '');
    }
}

function template() {
    return '<div class="ds-tabs ds-tabs-underline"><div class="ds-tabs-nav"></div><div class="ds-tabs-content"></div></div>';
}

const logic = Tabs;

export default Tabs;
export { logic, template };
