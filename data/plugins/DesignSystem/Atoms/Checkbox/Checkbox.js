const CHECKBOX_HTML_URL = new URL('./Checkbox.html', import.meta.url);
const CHECKBOX_CSS_URL = new URL('./Checkbox.css', import.meta.url);
const CHECKBOX_CSS_LINK_ID = 'ds-checkbox-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(CHECKBOX_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = CHECKBOX_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = CHECKBOX_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(CHECKBOX_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load checkbox template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let checkboxTemplateHtml = '<label class="ds-checkbox-wrap"><input type="checkbox" class="ds-checkbox" /><span class="ds-checkbox-label"></span></label>';

try {
    checkboxTemplateHtml = await loadTemplateHtml();
} catch {
    // Keep fallback.
}

class Checkbox {
    constructor(options = {}) {
        this.label = options.label || '';
        this.checked = !!options.checked;
        this.onChange = options.onChange || null;
        this.variant = options.variant || 'default';
        this.element = this.createDOM();
        this.attachEvents();
    }

    createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(checkboxTemplateHtml).trim();
        const root = template.content.firstElementChild;
        const input = root.querySelector('.ds-checkbox');
        const label = root.querySelector('.ds-checkbox-label');

        root.classList.add(`ds-checkbox-${this.variant}`);
        input.checked = this.checked;
        label.textContent = this.label;
        return root;
    }

    attachEvents() {
        const input = this.element.querySelector('.ds-checkbox');
        if (this.onChange) {
            input.addEventListener('change', (event) => this.onChange(event));
        }
    }
}

function template(options = {}) {
    const label = options.label || '';
    return `<label class="ds-checkbox-wrap"><input type="checkbox" class="ds-checkbox" /><span class="ds-checkbox-label">${label}</span></label>`;
}

const logic = Checkbox;

export default Checkbox;
export { logic, template };
