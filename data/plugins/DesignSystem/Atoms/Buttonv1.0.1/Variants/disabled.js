class DisabledButton extends Button {
    /**
     * Create a new DisabledButton widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, disabled: true });
    }
}

export { DisabledButton };
