class TertiaryButton extends Button {
    /**
     * Create a new TertiaryButton widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, variant: 'tertiary' });
    }
}

export { TertiaryButton };
