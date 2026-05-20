const TOGGLE_HTML_URL = new URL('./Toggle.html', import.meta.url);
const TOGGLE_CSS_URL = new URL('./Toggle.css', import.meta.url);
const TOGGLE_CSS_LINK_ID = 'ds-toggle-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(TOGGLE_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = TOGGLE_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = TOGGLE_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(TOGGLE_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load toggle template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let toggleTemplateHtml = '<label class="ds-toggle"><input class="ds-toggle-input" type="checkbox" /><span class="ds-toggle-track"></span></label>';

try {
    toggleTemplateHtml = await loadTemplateHtml();
} catch {
    // Keep fallback.
}

class Toggle {
    constructor(options = {}) {
        this.checked = !!options.checked;
        this.onChange = options.onChange || null;
        this.variant = options.variant || 'default';
        this.element = this.createDOM();
        this.attachEvents();
    }

    createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(toggleTemplateHtml).trim();
        const root = template.content.firstElementChild;
        const input = root.querySelector('.ds-toggle-input');

        root.classList.add(`ds-toggle-${this.variant}`);
        input.checked = this.checked;
        return root;
    }

    attachEvents() {
        const input = this.element.querySelector('.ds-toggle-input');
        if (this.onChange) {
            input.addEventListener('change', (event) => this.onChange(event));
        }
    }
}

function template() {
    return '<label class="ds-toggle"><input class="ds-toggle-input" type="checkbox" /><span class="ds-toggle-track"></span></label>';
}

const logic = Toggle;

export default Toggle;
export { logic, template };
