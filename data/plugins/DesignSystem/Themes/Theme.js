const THEME_FILES = {
    dark: new URL('./dark.css', import.meta.url).toString(),
    light: new URL('./light.css', import.meta.url).toString(),
    'high-contrast': new URL('./high-contrast.css', import.meta.url).toString(),
    retro: new URL('./retro.css', import.meta.url).toString(),
    glass: new URL('./glass.css', import.meta.url).toString(),
    modern: new URL('./modern.css', import.meta.url).toString(),
    minimal: new URL('./minimal.css', import.meta.url).toString(),
    neobrutalist: new URL('./neobrutalist.css', import.meta.url).toString()
};

function ensureThemesLoaded() {
    Object.entries(THEME_FILES).forEach(([name, url]) => {
        const linkId = `ds-theme-${name}`;
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = url;
            document.head.appendChild(link);
        }
    });
}

ensureThemesLoaded();

class ThemeManager {
    constructor(targetElement = null) {
        // Fallback to document.body if targetElement is null
        this.target = targetElement;
        this.currentBase = 'dark';
        this.currentStyles = ['modern'];

        this.apply(this.currentBase, this.currentStyles);
    }

    _getTarget() {
        if (this.target) {
            return typeof this.target === 'string' ? document.querySelector(this.target) : this.target;
        }
        // Fall back to document.body, but if inside a frame/container, apply there.
        return document.body;
    }

    /**
     * Set the color theme base
     * @param {'light'|'dark'} baseTheme 
     */
    setBaseTheme(baseTheme) {
        const el = this._getTarget();
        if (!el) return;

        const baseThemes = ['dark', 'light', 'high-contrast'];
        this.currentBase = baseThemes.includes(baseTheme) ? baseTheme : 'dark';
        
        el.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast');
        el.classList.add(`theme-${this.currentBase}`);

        // Set global body background styles based on design tokens
        el.style.backgroundColor = 'var(--ds-bg-color)';
        el.style.color = 'var(--ds-text-color)';
    }

    /**
     * Set the shape/effects styling modifier
     * @param {'retro'|'glass'|'modern'} aestheticStyle 
     */
    setAestheticStyle(aestheticStyle) {
        const el = this._getTarget();
        if (!el) return;

        const styles = ['retro', 'glass', 'modern', 'minimal', 'neobrutalist'];
        styles.forEach(s => el.classList.remove(`style-${s}`));

        const styleList = Array.isArray(aestheticStyle)
            ? aestheticStyle
            : [aestheticStyle];

        this.currentStyles = [];
        styleList.forEach((styleToken) => {
            if (styles.includes(styleToken)) {
                this.currentStyles.push(styleToken);
                el.classList.add(`style-${styleToken}`);
            }
        });

        if (this.currentStyles.length === 0) {
            this.currentStyles = ['modern'];
            el.classList.add('style-modern');
        }
    }

    /**
     * Apply both base theme and aesthetic style
     * @param {'light'|'dark'} baseTheme 
     * @param {'retro'|'glass'|'modern'} aestheticStyle 
     */
    apply(baseTheme, aestheticStyle) {
        this.setBaseTheme(baseTheme);
        this.setAestheticStyle(aestheticStyle);
    }
}

// Single instance by default
const Theme = new ThemeManager();
const logic = ThemeManager;
function template() {
    return '';
}
export default Theme;
export { ThemeManager, logic, template };
