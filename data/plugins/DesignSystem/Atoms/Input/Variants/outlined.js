class OutlinedInput extends Input {
    /**
     * Create a new OutlinedInput widget
     * @param {Object} options 
     */
    constructor(options = {}) {
        super({ ...options, variant: 'outlined' });
    }
}

export { OutlinedInput };
