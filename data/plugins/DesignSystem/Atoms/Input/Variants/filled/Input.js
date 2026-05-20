class FilledTextInput extends TextInput {
    /**
     * Create a new FilledInput widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, variant: 'filled' });
    }
}

export { FilledTextInput };
