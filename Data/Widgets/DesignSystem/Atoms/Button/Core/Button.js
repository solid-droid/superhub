async function loadTextAsset(fileName) {
	const assetUrl = new URL(fileName, import.meta.url).toString();
	const response = await fetch(assetUrl);
	if (!response.ok) {
		throw new Error(`Failed to load ${fileName} for Atom.button.`);
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

const TEMPLATE = await loadTextAsset('Button.html');
ensureCssLoaded('button.css');

function toElement(target) {
	if (!target) {
		return null;
	}

	if (target.jquery && target[0]) {
		return target[0];
	}

	return target;
}

function createButtonFromTemplate(templateHtml, options = {}) {
	const wrapper = document.createElement('div');
	wrapper.innerHTML = String(templateHtml || '').trim();
	const button = wrapper.firstElementChild;
	if (!button) {
		throw new Error('Atom.button template is invalid.');
	}

	const labelEl = button.querySelector('.ds-btn__label');
	if (labelEl) {
		labelEl.textContent = options.label || 'Button';
	}

	if (typeof options.onClick === 'function') {
		button.addEventListener('click', options.onClick);
	}

	return button;
}

function mountButton(host, button) {
	host.appendChild(button);
	return button;
}

function render(target, options = {}, _resolveDependency) {
	const host = toElement(target);
	if (!host) {
		throw new Error('Atom.button render target is missing.');
	}

	const button = createButtonFromTemplate(TEMPLATE, options);
	return mountButton(host, button);
}

export const logic = {
	toElement,
	createButtonFromTemplate,
	mountButton,
	render,
};

export const template = TEMPLATE;

export default logic;
