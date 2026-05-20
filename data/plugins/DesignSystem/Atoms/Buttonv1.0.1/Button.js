const BUTTON_HTML_URL = new URL('./Button.html', import.meta.url);
const BUTTON_CSS_URL = new URL('./Button.css', import.meta.url);
const BUTTON_CSS_LINK_ID = 'ds-button-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(BUTTON_CSS_LINK_ID)) {
        return;
    }

    const link = document.createElement('link');
    link.id = BUTTON_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = BUTTON_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(BUTTON_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load button template: ${response.status}`);
    }

    return response.text();
}

ensureCssLoaded();

let buttonTemplateHtml = '<button class="ds-button"><span class="ds-button-label">Button</span></button>';

try {
    buttonTemplateHtml = await loadTemplateHtml();
} catch (error) {
    console.warn('Button plugin: using fallback inline template because Button.html failed to load.', error);
}

class Button {
    /**
     * Create a new Button widget
     * @param {Object} options 
     * @param {string} options.label - The text label for the button
     * @param {string} options.variant - 'primary' or 'secondary'
     * @param {boolean} options.disabled - Whether the button is disabled
     * @param {Function} options.onClick - Click event handler
     */
    constructor(options = {}) {
        this.label = options.label || 'Button';
        this.variant = options.variant || 'primary';
        this.disabled = !!options.disabled;
        this.onClick = options.onClick || null;
        this.type = options.type || 'button';
        this.className = options.className || '';
        this.attrs = options.attrs || {};

        this.element = this._createDOM();
        this._attachEvents();
    }

    /**
     * Creates the DOM structure for the button
     * @returns {HTMLButtonElement}
     */
    _createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(buttonTemplateHtml || '').trim();

        const rootNode = template.content.firstElementChild;
        const button = rootNode instanceof HTMLButtonElement
            ? rootNode
            : document.createElement('button');

        button.className = this._buildClassName();
        button.type = this.type;
        
        if (this.disabled) {
            button.disabled = true;
        }

        Object.entries(this.attrs).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                button.setAttribute(key, String(value));
            }
        });

        let span = button.querySelector('.ds-button-label');
        if (!span) {
            span = document.createElement('span');
            span.className = 'ds-button-label';
            button.appendChild(span);
        }

        span.textContent = this.label;
        return button;
    }

    _buildClassName() {
        const extra = String(this.className || '').trim();
        return `ds-button ds-button-${this.variant}${extra ? ` ${extra}` : ''}`;
    }

    /**
     * Attaches event listeners
     */
    _attachEvents() {
        if (this.onClick) {
            this.element.addEventListener('click', (e) => {
                if (!this.disabled) {
                    this.onClick(e);
                }
            });
        }
    }

    /**
     * Updates the button's label
     * @param {string} newLabel 
     */
    setLabel(newLabel) {
        this.label = newLabel;
        const span = this.element.querySelector('.ds-button-label');
        if (span) {
            span.textContent = this.label;
        }
    }

    /**
     * Updates the button's disabled state
     * @param {boolean} isDisabled 
     */
    setDisabled(isDisabled) {
        this.disabled = !!isDisabled;
        this.element.disabled = this.disabled;
    }

    /**
     * Updates the button variant and refreshes classes
     * @param {string} variant
     */
    setVariant(variant) {
        this.variant = variant || 'primary';
        this.element.className = this._buildClassName();
    }

    /**
     * Replaces click handler
     * @param {Function | null} handler
     */
    setOnClick(handler) {
        this.onClick = typeof handler === 'function' ? handler : null;
    }

    /**
     * Mounts the button to a parent container
     * @param {HTMLElement|string} parent - The DOM element or selector string
     */
    mount(parent) {
        let container = parent;
        if (typeof parent === 'string') {
            container = document.querySelector(parent);
        }
        
        if (container instanceof HTMLElement) {
            container.appendChild(this.element);
        } else {
            console.error('Button: Invalid mount target.');
        }
    }

    /**
     * Removes the button from the DOM
     */
    unmount() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

function template(options = {}) {
    const label = options.label || 'Button';
    const variant = options.variant || 'primary';
    return `<button class="ds-button ds-button-${variant}" type="button"><span class="ds-button-label">${label}</span></button>`;
}

const logic = Button;

export default Button;
export { logic, template };