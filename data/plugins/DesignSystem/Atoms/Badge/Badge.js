const BADGE_HTML_URL = new URL('./Badge.html', import.meta.url);
const BADGE_CSS_URL = new URL('./Badge.css', import.meta.url);
const BADGE_CSS_LINK_ID = 'ds-badge-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(BADGE_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = BADGE_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = BADGE_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(BADGE_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load badge template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let badgeTemplateHtml = '<span class="ds-badge ds-badge-neutral">Badge</span>';

try {
    badgeTemplateHtml = await loadTemplateHtml();
} catch {
    // Keep fallback inline template.
}

class Badge {
    constructor(options = {}) {
        this.label = options.label || 'Badge';
        this.variant = options.variant || 'neutral';
        this.element = this.createDOM();
    }

    createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(badgeTemplateHtml).trim();
        const el = template.content.firstElementChild || document.createElement('span');
        el.className = `ds-badge ds-badge-${this.variant}`;
        el.textContent = this.label;
        return el;
    }
}

function template(options = {}) {
    const label = options.label || 'Badge';
    const variant = options.variant || 'neutral';
    return `<span class="ds-badge ds-badge-${variant}">${label}</span>`;
}

const logic = Badge;

export default Badge;
export { logic, template };
