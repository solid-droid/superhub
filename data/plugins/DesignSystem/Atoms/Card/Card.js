const CARD_HTML_URL = new URL('./Card.html', import.meta.url);
const CARD_CSS_URL = new URL('./Card.css', import.meta.url);
const CARD_CSS_LINK_ID = 'ds-card-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(CARD_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = CARD_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = CARD_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(CARD_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load card template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let cardTemplateHtml = '<div class="ds-card"><div class="ds-card-header"><h3 class="ds-card-title"></h3></div><div class="ds-card-body"></div><div class="ds-card-footer"></div></div>';

try {
    cardTemplateHtml = await loadTemplateHtml();
} catch (error) {
    console.warn('Card plugin: using fallback inline template.', error);
}

class Card {
    /**
     * Create a new Card widget
     * @param {Object} options 
     * @param {string} options.title - Header title text
     * @param {HTMLElement|string|HTMLElement[]} options.content - Body content
     * @param {HTMLElement|string|HTMLElement[]} options.footer - Footer content
     * @param {string} options.className - Additional CSS classes
     */
    constructor(options = {}) {
        this.title = options.title || '';
        this.content = options.content || '';
        this.footer = options.footer || '';
        this.variant = options.variant || 'elevated';
        this.className = options.className || '';

        this.element = this._createDOM();
    }

    _createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(cardTemplateHtml || '').trim();
        const card = template.content.firstElementChild;

        card.className = `ds-card ds-card-${this.variant}${this.className ? ` ${this.className}` : ''}`;

        const headerEl = card.querySelector('.ds-card-header');
        const titleEl = card.querySelector('.ds-card-title');
        if (titleEl && this.title) {
            titleEl.textContent = this.title;
        } else if (headerEl) {
            headerEl.style.display = 'none';
        }

        const bodyEl = card.querySelector('.ds-card-body');
        if (bodyEl && this.content) {
            this._appendContent(bodyEl, this.content);
        }

        const footerEl = card.querySelector('.ds-card-footer');
        if (footerEl && this.footer) {
            this._appendContent(footerEl, this.footer);
        } else if (footerEl) {
            footerEl.style.display = 'none';
        }

        return card;
    }

    _appendContent(container, content) {
        container.innerHTML = '';
        if (content instanceof HTMLElement) {
            container.appendChild(content);
        } else if (Array.isArray(content)) {
            content.forEach(item => {
                if (item instanceof HTMLElement) {
                    container.appendChild(item);
                } else {
                    container.appendChild(document.createTextNode(String(item)));
                }
            });
        } else if (typeof content === 'string') {
            container.innerHTML = content;
        }
    }

    setContent(newContent) {
        this.content = newContent;
        const bodyEl = this.element.querySelector('.ds-card-body');
        if (bodyEl) {
            this._appendContent(bodyEl, newContent);
        }
    }

    setTitle(newTitle) {
        this.title = newTitle;
        const titleEl = this.element.querySelector('.ds-card-title');
        const headerEl = this.element.querySelector('.ds-card-header');
        if (titleEl) {
            titleEl.textContent = newTitle;
            if (headerEl) {
                headerEl.style.display = newTitle ? '' : 'none';
            }
        }
    }

    mount(parent) {
        let container = parent;
        if (typeof parent === 'string') {
            container = document.querySelector(parent);
        }
        if (container instanceof HTMLElement) {
            container.appendChild(this.element);
        }
    }

    unmount() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

function template(options = {}) {
    const title = options.title || '';
    const content = options.content || '';
    const footer = options.footer || '';
    const variant = options.variant || 'elevated';
    return `<div class="ds-card ds-card-${variant}"><div class="ds-card-header"><h3 class="ds-card-title">${title}</h3></div><div class="ds-card-body">${content}</div><div class="ds-card-footer">${footer}</div></div>`;
}

const logic = Card;

export default Card;
export { logic, template };
