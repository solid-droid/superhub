const INPUT_HTML_URL = new URL('./Input.html', import.meta.url);
const INPUT_CSS_URL = new URL('./Input.css', import.meta.url);
const INPUT_CSS_LINK_ID = 'ds-input-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(INPUT_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = INPUT_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = INPUT_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(INPUT_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load input template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let inputTemplateHtml = '<div class="ds-input-container"><label class="ds-input-label"></label><input class="ds-input" /></div>';

try {
    inputTemplateHtml = await loadTemplateHtml();
} catch (error) {
    console.warn('TextInput plugin: using fallback inline template.', error);
}

class TextInput {
    /**
    * Create a new TextInput widget
     * @param {Object} options 
     * @param {string} options.label - Label text for input
     * @param {string} options.placeholder - Placeholder text
     * @param {string} options.value - Initial input value
     * @param {string} options.type - 'text', 'password', 'number', 'email' etc.
     * @param {string} options.variant - 'outlined' or 'filled'
    * @param {boolean} options.disabled - Whether the input is disabled
     * @param {Function} options.onChange - Change/input event handler
     */
    constructor(options = {}) {
        this.label = options.label || '';
        this.placeholder = options.placeholder || '';
        this.value = options.value || '';
        this.type = options.type || 'text';
        this.variant = options.variant || 'outlined';
        this.disabled = !!options.disabled;
        this.onChange = options.onChange || null;
        this.className = options.className || '';
        this.attrs = options.attrs || {};

        this.element = this._createDOM();
        this._attachEvents();
    }

    _createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(inputTemplateHtml || '').trim();
        const container = template.content.firstElementChild;

        const labelEl = container.querySelector('.ds-input-label');
        if (labelEl) {
            if (this.label) {
                labelEl.textContent = this.label;
            } else {
                labelEl.style.display = 'none';
            }
        }

        const inputEl = container.querySelector('.ds-input');
        if (inputEl) {
            inputEl.type = this.type;
            inputEl.placeholder = this.placeholder;
            inputEl.value = this.value;
            if (this.disabled) {
                inputEl.disabled = true;
            }
            
            inputEl.className = this._buildInputClassName();
            
            Object.entries(this.attrs).forEach(([key, val]) => {
                inputEl.setAttribute(key, String(val));
            });
        }

        return container;
    }

    _buildInputClassName() {
        const extra = String(this.className || '').trim();
        return `ds-input ds-input-${this.variant}${extra ? ` ${extra}` : ''}`;
    }

    _attachEvents() {
        const inputEl = this.element.querySelector('.ds-input');
        if (inputEl && this.onChange) {
            inputEl.addEventListener('input', (e) => {
                this.value = e.target.value;
                this.onChange(e);
            });
        }
    }

    getValue() {
        const inputEl = this.element.querySelector('.ds-input');
        return inputEl ? inputEl.value : this.value;
    }

    setValue(newValue) {
        this.value = newValue;
        const inputEl = this.element.querySelector('.ds-input');
        if (inputEl) {
            inputEl.value = newValue;
        }
    }

    setDisabled(isDisabled) {
        this.disabled = !!isDisabled;
        const inputEl = this.element.querySelector('.ds-input');
        if (inputEl) {
            inputEl.disabled = this.disabled;
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
    const label = options.label || '';
    const placeholder = options.placeholder || '';
    const variant = options.variant || 'outlined';
    return `<div class="ds-input-container"><label class="ds-input-label">${label}</label><input class="ds-input ds-input-${variant}" placeholder="${placeholder}" /></div>`;
}

const logic = TextInput;

export default TextInput;
export { logic, template };
