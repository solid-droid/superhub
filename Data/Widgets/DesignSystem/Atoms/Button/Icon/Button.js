const CORE_BUTTON_REF = 'widget>design-system>Atom.button@1.0.0';

async function loadTextAsset(fileName) {
	const assetUrl = new URL(fileName, import.meta.url).toString();
	const response = await fetch(assetUrl);
	if (!response.ok) {
		throw new Error(`Failed to load ${fileName} for Atom.button.icon.`);
	}

	return response.text();
}

function ensureCssLoaded(fileName) {
	const href = new URL(fileName, import.meta.url).toString();
	const existing = document.querySelector(`link[href="${href}"]`);
	if (existing) {
		return;
	}

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = href;
	link.dataset.widgetStyle = href;
	document.head.appendChild(link);
}

function resolveCoreLogic(resolveDependency) {
	if (typeof resolveDependency !== 'function') {
		return null;
	}

	const dependency = resolveDependency(CORE_BUTTON_REF);
	if (!dependency) {
		return null;
	}

	return dependency.logic
		|| dependency?.plugin?.exports?.logic
		|| dependency?.plugin?.implementation
		|| null;
}

const TEMPLATE = await loadTextAsset('Button.html');
ensureCssLoaded('Button.css');

function render(target, options = {}, resolveDependency) {
	const core = resolveCoreLogic(resolveDependency);
	if (!core || typeof core.toElement !== 'function' || typeof core.createButtonFromTemplate !== 'function' || typeof core.mountButton !== 'function') {
		return null;
	}

	const host = core.toElement(target);
	if (!host) {
		throw new Error('Atom.button.icon render target is missing.');
	}

	const button = core.createButtonFromTemplate(TEMPLATE, options);

	const label = options.label || 'Icon Button';
	const icon = options.icon || '★';
	button.setAttribute('aria-label', label);
	button.querySelector('.ds-btn__icon').textContent = icon;

	return core.mountButton(host, button);
}

export const logic = {
	render,
};

export const template = TEMPLATE;

export default logic;
