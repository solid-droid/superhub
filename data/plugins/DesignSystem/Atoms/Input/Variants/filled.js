class FilledInput extends Input {
    /**
     * Create a new FilledInput widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, variant: 'filled' });
    }
}

export { FilledInput };
