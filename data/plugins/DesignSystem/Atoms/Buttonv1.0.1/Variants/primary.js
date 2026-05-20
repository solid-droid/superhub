class PrimaryButton extends Button {
    /**
     * Create a new PrimaryButton widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, variant: 'primary' });
    }
}

export { PrimaryButton };
