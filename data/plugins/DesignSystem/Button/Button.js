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

        this.element = this._createDOM();
        this._attachEvents();
    }

    /**
     * Creates the DOM structure for the button
     * @returns {HTMLButtonElement}
     */
    _createDOM() {
        const button = document.createElement('button');
        button.className = `ds-button ds-button-${this.variant}`;
        
        if (this.disabled) {
            button.disabled = true;
        }

        const span = document.createElement('span');
        span.className = 'ds-button-label';
        span.textContent = this.label;

        button.appendChild(span);
        return button;
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

export default Button;