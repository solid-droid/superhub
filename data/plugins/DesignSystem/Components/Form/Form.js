const FORM_HTML_URL = new URL('./Form.html', import.meta.url);
const FORM_CSS_URL = new URL('./Form.css', import.meta.url);
const FORM_CSS_LINK_ID = 'ds-form-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(FORM_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = FORM_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FORM_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(FORM_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load form template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let formTemplateHtml = '<form class="ds-form"><div class="ds-form-fields"></div><div class="ds-form-actions"></div></form>';

try {
    formTemplateHtml = await loadTemplateHtml();
} catch (error) {
    console.warn('Form plugin: using fallback inline template.', error);
}

class Form {
    /**
     * Create a new Form component
     * @param {Object} options 
     * @param {Array} options.fields - Array of field configs: { id, label, type, placeholder, value, required }
     * @param {string} options.submitLabel - Submit button text (default: 'Submit')
     * @param {string} options.cancelLabel - Cancel button text (default: '')
     * @param {Function} options.onSubmit - Callback function when submitted: onSubmit(values)
     * @param {Function} options.onCancel - Callback function when cancelled
     */
    constructor(options = {}) {
        this.fieldsConfig = options.fields || [];
        this.submitLabel = options.submitLabel || 'Submit';
        this.cancelLabel = options.cancelLabel || '';
        this.variant = options.variant || 'default';
        this.onSubmit = options.onSubmit || null;
        this.onCancel = options.onCancel || null;

        this.inputs = {};
        this.element = this._createDOM();
        this._attachEvents();
    }

    _createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(formTemplateHtml || '').trim();
        const form = template.content.firstElementChild;
        form.classList.add(`ds-form-${this.variant}`);

        const fieldsContainer = form.querySelector('.ds-form-fields');
        const actionsContainer = form.querySelector('.ds-form-actions');

        const getPlugins = window.CHAMBER?.getPlugins || (() => ({}));
        
        // Dynamic Input resolution
        const InputImpl = getPlugins().input?.implementation;
        const InputClass = InputImpl ? (InputImpl.default || InputImpl) : null;

        // Dynamic Button resolution
        const ButtonImpl = getPlugins().button?.implementation;
        const ButtonClass = ButtonImpl ? (ButtonImpl.default || ButtonImpl) : null;

        // Render Fields
        this.fieldsConfig.forEach(cfg => {
            if (InputClass) {
                const inputInstance = new InputClass({
                    label: cfg.label + (cfg.required ? ' *' : ''),
                    placeholder: cfg.placeholder || '',
                    type: cfg.type || 'text',
                    value: cfg.value || '',
                    attrs: { id: `form-field-${cfg.id}`, name: cfg.id }
                });
                this.inputs[cfg.id] = inputInstance;
                fieldsContainer.appendChild(inputInstance.element);
            } else {
                // HTML fallback
                const grp = document.createElement('div');
                grp.className = 'ds-input-container';
                grp.innerHTML = `
                    <label class="ds-input-label" for="form-field-${cfg.id}">${cfg.label}${cfg.required ? ' *' : ''}</label>
                    <input class="ds-input" id="form-field-${cfg.id}" name="${cfg.id}" type="${cfg.type || 'text'}" placeholder="${cfg.placeholder || ''}" value="${cfg.value || ''}" />
                `;
                fieldsContainer.appendChild(grp);
            }
        });

        // Add Error Message Holder
        const errorEl = document.createElement('div');
        errorEl.className = 'ds-form-error-msg';
        errorEl.style.display = 'none';
        fieldsContainer.appendChild(errorEl);

        // Render Buttons
        if (ButtonClass) {
            if (this.cancelLabel) {
                const cancelBtn = new ButtonClass({
                    label: this.cancelLabel,
                    variant: 'secondary',
                    type: 'button',
                    onClick: (e) => {
                        e.preventDefault();
                        if (this.onCancel) this.onCancel();
                    }
                });
                actionsContainer.appendChild(cancelBtn.element);
            }

            const submitBtn = new ButtonClass({
                label: this.submitLabel,
                variant: 'primary',
                type: 'submit'
            });
            actionsContainer.appendChild(submitBtn.element);
        } else {
            // HTML fallback
            if (this.cancelLabel) {
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.textContent = this.cancelLabel;
                cancelBtn.className = 'ds-button ds-button-secondary';
                cancelBtn.addEventListener('click', () => { if (this.onCancel) this.onCancel(); });
                actionsContainer.appendChild(cancelBtn);
            }
            const submitBtn = document.createElement('button');
            submitBtn.type = 'submit';
            submitBtn.textContent = this.submitLabel;
            submitBtn.className = 'ds-button';
            actionsContainer.appendChild(submitBtn);
        }

        return form;
    }

    _attachEvents() {
        this.element.addEventListener('submit', (e) => {
            e.preventDefault();
            this.clearError();

            const values = this.getValues();
            const errors = [];

            // Simple Validation
            this.fieldsConfig.forEach(cfg => {
                if (cfg.required && !String(values[cfg.id] || '').trim()) {
                    errors.push(`${cfg.label} is required.`);
                }
            });

            if (errors.length > 0) {
                this.showError(errors.join(' '));
                return;
            }

            if (this.onSubmit) {
                this.onSubmit(values);
            }
        });
    }

    getValues() {
        const values = {};
        this.fieldsConfig.forEach(cfg => {
            const inputInst = this.inputs[cfg.id];
            if (inputInst) {
                values[cfg.id] = inputInst.getValue();
            } else {
                const el = this.element.querySelector(`#form-field-${cfg.id}`);
                values[cfg.id] = el ? el.value : '';
            }
        });
        return values;
    }

    showError(message) {
        const errorEl = this.element.querySelector('.ds-form-error-msg');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    clearError() {
        const errorEl = this.element.querySelector('.ds-form-error-msg');
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
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

function template() {
    return '<form class="ds-form ds-form-default"><div class="ds-form-fields"></div><div class="ds-form-actions"></div></form>';
}

const logic = Form;

export default Form;
export { logic, template };
