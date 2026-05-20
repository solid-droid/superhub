const POPUP_HTML_URL = new URL('./Popup.html', import.meta.url);
const POPUP_CSS_URL = new URL('./Popup.css', import.meta.url);
const POPUP_CSS_LINK_ID = 'ds-popup-plugin-css';

function ensureCssLoaded() {
    if (document.getElementById(POPUP_CSS_LINK_ID)) {
        return;
    }
    const link = document.createElement('link');
    link.id = POPUP_CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = POPUP_CSS_URL.toString();
    document.head.appendChild(link);
}

async function loadTemplateHtml() {
    const response = await fetch(POPUP_HTML_URL.toString());
    if (!response.ok) {
        throw new Error(`Failed to load popup template: ${response.status}`);
    }
    return response.text();
}

ensureCssLoaded();

let popupTemplateHtml = '<div class="ds-popup-overlay"></div>';

try {
    popupTemplateHtml = await loadTemplateHtml();
} catch (error) {
    console.warn('Popup plugin: using fallback inline template.', error);
}

class Popup {
    /**
     * Create a new Popup window (Component)
     * @param {Object} options 
     * @param {string} options.title - The title text
     * @param {HTMLElement|string} options.content - The body content
     * @param {HTMLElement|string} options.footer - The footer content
     * @param {Function} options.onClose - Event callback when closed
     */
    constructor(options = {}) {
        this.title = options.title || 'Popup';
        this.content = options.content || '';
        this.footer = options.footer || '';
        this.variant = options.variant || 'default';
        this.onClose = options.onClose || null;

        this.overlay = this._createDOM();
        this.isMaximized = false;
        this.isMinimized = false;
        
        this._attachEvents();
        this._makeDraggable();
    }

    _createDOM() {
        const template = document.createElement('template');
        template.innerHTML = String(popupTemplateHtml || '').trim();
        const overlay = template.content.firstElementChild;

        // Try to load Card dependency from global plugin system
        const getPlugins = window.CHAMBER?.getPlugins || (() => ({}));
        const CardImpl = getPlugins().card?.implementation;
        const CardClass = CardImpl ? (CardImpl.default || CardImpl) : null;

        let popupBox;
        if (CardClass) {
            // Instantiate dynamic Card dependency
            const cardInstance = new CardClass({
                title: this.title,
                content: this.content,
                footer: this.footer,
                className: 'ds-popup-window'
            });
            popupBox = cardInstance.element;
            popupBox.classList.add(`ds-popup-${this.variant}`);
        } else {
            // Fallback DOM if Card dependency is missing
            popupBox = document.createElement('div');
            popupBox.className = 'ds-popup-window ds-card';
            popupBox.classList.add(`ds-popup-${this.variant}`);
            
            const header = document.createElement('div');
            header.className = 'ds-card-header';
            header.innerHTML = `<h3 class="ds-card-title">${this.title}</h3>`;
            popupBox.appendChild(header);

            const body = document.createElement('div');
            body.className = 'ds-card-body';
            if (this.content instanceof HTMLElement) {
                body.appendChild(this.content);
            } else {
                body.innerHTML = this.content;
            }
            popupBox.appendChild(body);
        }

        // Add control buttons to header
        const header = popupBox.querySelector('.ds-card-header');
        if (header) {
            header.classList.add('ds-popup-header');
            
            const controls = document.createElement('div');
            controls.className = 'ds-popup-controls';
            controls.innerHTML = `
                <button class="ds-popup-control-btn ds-popup-btn-min" title="Minimize">—</button>
                <button class="ds-popup-control-btn ds-popup-btn-max" title="Maximize">🗖</button>
                <button class="ds-popup-control-btn ds-popup-btn-close" title="Close">×</button>
            `;
            header.appendChild(controls);
        }

        overlay.appendChild(popupBox);
        return overlay;
    }

    _attachEvents() {
        const popupBox = this.overlay.querySelector('.ds-popup-window');
        const minBtn = this.overlay.querySelector('.ds-popup-btn-min');
        const maxBtn = this.overlay.querySelector('.ds-popup-btn-max');
        const closeBtn = this.overlay.querySelector('.ds-popup-btn-close');

        if (minBtn) {
            minBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });
        }
        if (maxBtn) {
            maxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMaximize();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        // Clicking outside overlay (optional behavior - closed by default if target is overlay)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay && !this.isMinimized) {
                this.close();
            }
        });
    }

    _makeDraggable() {
        const popupBox = this.overlay.querySelector('.ds-popup-window');
        const header = this.overlay.querySelector('.ds-card-header');
        if (!header || !popupBox) return;

        let startX = 0, startY = 0, initialX = 0, initialY = 0;
        let isDragging = false;

        const onMouseDown = (e) => {
            // Ignore if clicked on control buttons
            if (e.target.closest('.ds-popup-controls')) return;
            if (this.isMaximized) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Get computed transform position or set styles
            const style = window.getComputedStyle(popupBox);
            const matrix = new DOMMatrix(style.transform);
            initialX = matrix.m41;
            initialY = matrix.m42;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            popupBox.style.transform = `translate(${initialX + dx}px, ${initialY + dy}px)`;
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        header.style.cursor = 'move';
        header.addEventListener('mousedown', onMouseDown);
    }

    toggleMinimize() {
        const popupBox = this.overlay.querySelector('.ds-popup-window');
        const bodyEl = this.overlay.querySelector('.ds-card-body');
        const footerEl = this.overlay.querySelector('.ds-card-footer');
        
        if (!popupBox) return;

        this.isMinimized = !this.isMinimized;
        if (this.isMinimized) {
            popupBox.classList.add('ds-popup-minimized');
            this.overlay.classList.add('ds-overlay-minimized');
            if (bodyEl) bodyEl.style.display = 'none';
            if (footerEl) footerEl.style.display = 'none';
            popupBox.style.transform = 'none';
        } else {
            popupBox.classList.remove('ds-popup-minimized');
            this.overlay.classList.remove('ds-overlay-minimized');
            if (bodyEl) bodyEl.style.display = '';
            if (footerEl) footerEl.style.display = '';
        }
    }

    toggleMaximize() {
        const popupBox = this.overlay.querySelector('.ds-popup-window');
        if (!popupBox || this.isMinimized) return;

        this.isMaximized = !this.isMaximized;
        if (this.isMaximized) {
            popupBox.classList.add('ds-popup-maximized');
            popupBox.style.transform = 'none';
        } else {
            popupBox.classList.remove('ds-popup-maximized');
        }
    }

    open() {
        document.body.appendChild(this.overlay);
        // Force reflow
        this.overlay.offsetHeight;
        this.overlay.classList.add('ds-popup-open');
    }

    close() {
        this.overlay.classList.remove('ds-popup-open');
        this.overlay.classList.add('ds-popup-closing');
        setTimeout(() => {
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            if (this.onClose) {
                this.onClose();
            }
        }, 300);
    }
}

function template() {
    return '<div class="ds-popup-overlay"><div class="ds-popup-window"></div></div>';
}

const logic = Popup;

export default Popup;
export { logic, template };
