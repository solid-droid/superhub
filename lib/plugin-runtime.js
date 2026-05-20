import fs from 'fs/promises';
import path from 'path';

class VariantResolutionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'VariantResolutionError';
    }
}

function parseVariantsValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
}

function validatePluginMetadataV2(metadata) {
    const errors = [];

    if (!metadata || typeof metadata !== 'object') {
        return ['Plugin metadata must be an object.'];
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
        errors.push('name is required and must be a string.');
    }

    if (!metadata.version || typeof metadata.version !== 'string') {
        errors.push('version is required and must be a string.');
    }

    if (!metadata.slug || typeof metadata.slug !== 'string') {
        errors.push('slug is required and must be a string.');
    }

    if (!metadata.category || typeof metadata.category !== 'string') {
        errors.push('category is required and must be a string.');
    }

    if (!metadata.exports || typeof metadata.exports !== 'object') {
        errors.push('exports is required and must be an object.');
        return errors;
    }

    const logicPath = metadata.exports?.logic?.path;
    if (!logicPath || typeof logicPath !== 'string') {
        errors.push('exports.logic.path is required and must be a string.');
    }

    if (metadata.exports.template && typeof metadata.exports.template !== 'object') {
        errors.push('exports.template must be an object when provided.');
    }

    if (metadata.exports.template && typeof metadata.exports.template.path !== 'string') {
        errors.push('exports.template.path must be a string when template export is provided.');
    }

    if (metadata.exports.styles && !Array.isArray(metadata.exports.styles)) {
        errors.push('exports.styles must be an array when provided.');
    }

    if (metadata.variants && typeof metadata.variants !== 'object') {
        errors.push('variants must be an object when provided.');
    }

    return errors;
}

function dedupeKeepLast(values) {
    const seen = new Set();
    const output = [];

    for (let i = values.length - 1; i >= 0; i -= 1) {
        const value = values[i];
        if (seen.has(value)) {
            continue;
        }
        seen.add(value);
        output.push(value);
    }

    return output.reverse();
}

function buildGroupLookup(variantGroups) {
    const lookup = new Map();
    if (!variantGroups || typeof variantGroups !== 'object') {
        return lookup;
    }

    for (const [groupName, variants] of Object.entries(variantGroups)) {
        const cleaned = parseVariantsValue(variants);
        for (const variant of cleaned) {
            lookup.set(variant, groupName);
        }
    }

    return lookup;
}

function resolveWithLastWriteWins(selected, groupLookup) {
    const grouped = new Map();
    const output = [];

    for (const variant of selected) {
        const group = groupLookup.get(variant);
        if (!group) {
            output.push(variant);
            continue;
        }

        grouped.set(group, variant);
    }

    return dedupeKeepLast([...output, ...grouped.values()]);
}

function resolveWithStrictPolicy(selected, groupLookup) {
    const grouped = new Map();

    for (const variant of selected) {
        const group = groupLookup.get(variant);
        if (!group) {
            continue;
        }

        const existing = grouped.get(group) || [];
        existing.push(variant);
        grouped.set(group, existing);
    }

    for (const [group, variants] of grouped.entries()) {
        if (variants.length > 1) {
            throw new VariantResolutionError(`Strict variant policy conflict in group "${group}": ${variants.join(', ')}`);
        }
    }

    return dedupeKeepLast(selected);
}

function resolveWithPluginResolver(selected, groupLookup, resolverConfig = {}) {
    const groupPriority = parseVariantsValue(resolverConfig.order);
    const selectedByGroup = new Map();
    const ungrouped = [];

    for (const variant of selected) {
        const group = groupLookup.get(variant);
        if (!group) {
            ungrouped.push(variant);
            continue;
        }

        const existing = selectedByGroup.get(group) || [];
        existing.push(variant);
        selectedByGroup.set(group, existing);
    }

    const resolvedGroups = [];
    for (const [group, variants] of selectedByGroup.entries()) {
        if (variants.length <= 1) {
            resolvedGroups.push(variants[0]);
            continue;
        }

        const ordered = variants.slice().sort((a, b) => {
            const ia = groupPriority.indexOf(a);
            const ib = groupPriority.indexOf(b);

            const rankA = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
            const rankB = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
            if (rankA !== rankB) {
                return rankA - rankB;
            }

            return variants.indexOf(b) - variants.indexOf(a);
        });

        resolvedGroups.push(ordered[0]);
    }

    return dedupeKeepLast([...ungrouped, ...resolvedGroups]);
}

function resolveSelectedVariants(metadata, requestedVariants, options = {}) {
    const defaultVariants = parseVariantsValue(metadata?.variants?.defaults || metadata?.variants?.default || []);
    const availableVariants = parseVariantsValue(metadata?.variants?.available || []);
    const requested = parseVariantsValue(requestedVariants);
    const selectedBase = requested.length > 0 ? requested : defaultVariants;

    const filteredSelected = availableVariants.length > 0
        ? selectedBase.filter((variant) => availableVariants.includes(variant))
        : selectedBase;

    const variantPolicy = String(options.variantPolicy || metadata?.variants?.conflictPolicy || 'last-write-wins');
    const groupLookup = buildGroupLookup(metadata?.variants?.groups);

    if (variantPolicy === 'strict') {
        return resolveWithStrictPolicy(filteredSelected, groupLookup);
    }

    if (variantPolicy === 'resolver') {
        return resolveWithPluginResolver(filteredSelected, groupLookup, metadata?.variants?.resolver || {});
    }

    return resolveWithLastWriteWins(filteredSelected, groupLookup);
}

async function stitchFileWithVariants(resolvedPath, baseDir, ext, variants) {
    const variantList = parseVariantsValue(variants);
    const uniqueVariants = dedupeKeepLast(variantList);
    const baseName = path.basename(resolvedPath);
    let content = await fs.readFile(resolvedPath, 'utf-8');

    let variantsDir = path.join(baseDir, 'Variants');
    try {
        await fs.access(variantsDir);
    } catch {
        variantsDir = path.join(baseDir, 'Varients');
    }

    let variantsDirExists = false;
    try {
        await fs.access(variantsDir);
        variantsDirExists = true;
    } catch {
        variantsDirExists = false;
    }

    if (!variantsDirExists) {
        return content;
    }

    for (const variant of uniqueVariants) {
        const candidateFiles = [
            path.join(variantsDir, variant, baseName),
            path.join(variantsDir, variant, `${variant}${ext}`),
            path.join(variantsDir, `${variant}${ext}`),
        ];

        let variantContent = null;
        for (const candidateFile of candidateFiles) {
            try {
                await fs.access(candidateFile);
                variantContent = await fs.readFile(candidateFile, 'utf-8');
                break;
            } catch {
                // Continue to next candidate path.
            }
        }

        if (!variantContent) {
            // Ignore missing variant files.
            continue;
        }

        if (ext === '.css') {
            content += `\n\n/* Variant: ${variant} */\n${variantContent}`;
        } else if (ext === '.html') {
            content += `\n\n<!-- Variant: ${variant} -->\n${variantContent}`;
        } else if (ext === '.js') {
            content += `\n\n/* Variant: ${variant} */\n${variantContent}`;
        }
    }

    return content;
}

export {
    VariantResolutionError,
    parseVariantsValue,
    validatePluginMetadataV2,
    resolveSelectedVariants,
    stitchFileWithVariants,
};
