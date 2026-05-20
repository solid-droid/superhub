class SecondaryButton extends Button {
    /**
     * Create a new SecondaryButton widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, variant: 'secondary' });
    }
}

export { SecondaryButton };
