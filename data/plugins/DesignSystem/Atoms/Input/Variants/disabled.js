class DisabledInput extends Input {
    /**
     * Create a new DisabledInput widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, disabled: true });
    }
}

export { DisabledInput };
