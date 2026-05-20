const TOAST_HTML_URL = new URL('./Toast.html', import.meta.url);
const TOAST_CSS_URL = new URL('./Toast.css', import.meta.url);
const TOAST_CSS_LINK_ID = 'ds-toast-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(TOAST_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = TOAST_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = TOAST_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(TOAST_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load toast template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let toastTemplateHtml = '<div class="ds-toast ds-toast-info"><span class="ds-toast-text">Toast</span></div>';

try {
    toastTemplateHtml = await loadTemplateHtml();
} catch {
    // Keep fallback.
}

class Toast {
    constructor(options = {}) {
        this.message = options.message || 'Toast';
        this.variant = options.variant || 'info';
        this.timeout = options.timeout || 2500;
        this.element = this.createDOM();
    }

    createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(toastTemplateHtml).trim();
        const root = template.content.firstElementChild;
        root.className = `ds-toast ds-toast-${this.variant}`;
        const textEl = root.querySelector('.ds-toast-text');
        textEl.textContent = this.message;
        return root;
    }

    open(parent = document.body) {
        parent.appendChild(this.element);
        setTimeout(() => this.close(), this.timeout);
    }

    close() {
        this.element.remove();
    }
}

function template(options = {}) {
    const message = options.message || 'Toast';
    const variant = options.variant || 'info';
    return `<div class="ds-toast ds-toast-${variant}"><span class="ds-toast-text">${message}</span></div>`;
}

const logic = Toast;

export default Toast;
export { logic, template };
