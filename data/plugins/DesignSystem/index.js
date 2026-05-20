const catalog = {
    atoms: ['button', 'input', 'card', 'badge', 'checkbox', 'toggle'],
    components: ['form', 'popup', 'tabs', 'toast'],
    themes: ['theme'],
};

function logic() {
    return {
        getCatalog() {
            return catalog;
        },
    };
}

function template() {
    return '<div class="ds-design-system-root"></div>';
}

export default logic;
export { logic, template };
