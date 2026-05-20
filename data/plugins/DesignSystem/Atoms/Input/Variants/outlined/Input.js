class OutlinedTextInput extends TextInput {
    /**
     * Create a new OutlinedInput widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, variant: 'outlined' });
    }
}

export { OutlinedTextInput };
