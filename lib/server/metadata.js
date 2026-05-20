import path from 'path';

function buildAssetUrl(pluginsDir, pluginDirPath, relativePath, querySuffix = '') {
    const normalized = String(relativePath || '').replace(/^\/+/, '');
    return `/plugin-assets/${path.relative(pluginsDir, pluginDirPath).replace(/\\/g, '/')}/${normalized}${querySuffix}`;
}

function normalizeMetadata({
    raw,
    slug,
    pluginDirPath,
    pluginsDir,
    requestContext,
    parseVariantsValue,
    resolveSelectedVariants,
}) {
    const normalized = { ...raw };

    if (!normalized.slug) {
        normalized.slug = slug;
    }

    const queryVariants = parseVariantsValue(requestContext.query.variants);
    const variantPolicy = String(requestContext.query.variantPolicy || normalized.variants?.conflictPolicy || 'last-write-wins');
    const resolvedVariants = resolveSelectedVariants(normalized, queryVariants, { variantPolicy });
    const variantQuery = resolvedVariants.join(',');
    const querySuffix = variantQuery ? `?variants=${encodeURIComponent(variantQuery)}` : '';

    const logicPath = normalized.exports?.logic?.path;
    const templatePath = normalized.exports?.template?.path;
    const styleEntries = Array.isArray(normalized.exports?.styles) ? normalized.exports.styles : [];

    const logicUrl = logicPath ? buildAssetUrl(pluginsDir, pluginDirPath, logicPath, querySuffix) : null;
    const templateUrl = templatePath ? buildAssetUrl(pluginsDir, pluginDirPath, templatePath, querySuffix) : null;
    const styleUrls = styleEntries
        .filter((style) => style && typeof style.path === 'string')
        .map((style) => ({
            ...style,
            url: buildAssetUrl(pluginsDir, pluginDirPath, style.path, querySuffix),
        }));

    normalized.entry = logicUrl;
    normalized.selectedVariants = resolvedVariants;
    normalized.variantPolicy = variantPolicy;
    normalized.exports = {
        ...normalized.exports,
        logic: {
            ...(normalized.exports?.logic || {}),
            url: logicUrl,
        },
        template: normalized.exports?.template
            ? {
                ...normalized.exports.template,
                url: templateUrl,
            }
            : null,
        styles: styleUrls,
    };

    if (normalized.widgets && Array.isArray(normalized.widgets)) {
        normalized.widgets = normalized.widgets.map((widget) => {
            if (!widget || !widget.meta || typeof widget.meta !== 'string') {
                return widget;
            }

            const metaPath = widget.meta.replace(/^\/+/, '');
            return {
                ...widget,
                meta: `/plugin-assets/${path.relative(pluginsDir, pluginDirPath).replace(/\\/g, '/')}/${metaPath}`,
            };
        });
    }

    normalized._links = {
        self: `${requestContext.origin}/plugins/${slug}${normalized.version ? `/${normalized.version}` : ''}`,
    };

    return normalized;
}

export {
    buildAssetUrl,
    normalizeMetadata,
};
