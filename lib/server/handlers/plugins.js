import fs from 'fs/promises';
import path from 'path';
import {
    buildRequestContext,
    jsonResponse,
    isVersionMetadataFile,
} from '../helpers.js';

async function handleCreatePluginMetadata({
    request,
    pluginsDir,
    makeSlug,
    validatePluginMetadataV2,
    corsHeaders,
}) {
    try {
        const metadata = await request.json();

        if (!metadata?.name || !metadata?.version) {
            return jsonResponse(corsHeaders, { error: 'Plugin name and version are required.' }, 400);
        }

        const slug = makeSlug(metadata.name);
        metadata.slug = slug;

        const validationErrors = validatePluginMetadataV2(metadata);
        if (validationErrors.length > 0) {
            return jsonResponse(corsHeaders, {
                error: 'Invalid plugin metadata format.',
                details: validationErrors,
            }, 400);
        }

        const pluginDirPath = path.join(pluginsDir, slug);
        await fs.mkdir(pluginDirPath, { recursive: true });

        const versionFilePath = path.join(pluginDirPath, `${metadata.version}.json`);
        await fs.writeFile(versionFilePath, JSON.stringify(metadata, null, 2), 'utf-8');

        return jsonResponse(corsHeaders, { message: 'Plugin metadata created successfully', slug, version: metadata.version }, 201);
    } catch (error) {
        console.error('Error creating plugin:', error);
        return jsonResponse(corsHeaders, { error: 'Internal server error' }, 500);
    }
}

async function handleGetPlugins({
    url,
    request,
    pluginsDir,
    ensurePluginsDir,
    collectPluginMetadataFiles,
    validatePluginMetadataV2,
    normalizeMetadata,
    parseVariantsValue,
    resolveSelectedVariants,
    VariantResolutionError,
    corsHeaders,
}) {
    try {
        await ensurePluginsDir(pluginsDir);
        const metadataFiles = await collectPluginMetadataFiles(pluginsDir);
        const latestBySlug = new Map();

        for (const item of metadataFiles) {
            try {
                const metadataRaw = await fs.readFile(item.filePath, 'utf-8');
                const parsed = JSON.parse(metadataRaw);
                const validationErrors = validatePluginMetadataV2(parsed);
                if (validationErrors.length > 0) {
                    console.warn(`Skipping invalid metadata in ${item.filePath}:`, validationErrors);
                    continue;
                }

                const slug = parsed.slug;
                const existing = latestBySlug.get(slug);
                if (!existing || parsed.version.localeCompare(existing.version, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
                    latestBySlug.set(slug, {
                        version: parsed.version,
                        metadata: parsed,
                        pluginDirPath: item.pluginDirPath,
                    });
                }
            } catch (error) {
                console.warn(`Skipping malformed plugin metadata file ${item.filePath}:`, error.message);
            }
        }

        const requestContext = buildRequestContext(url, request);
        const plugins = Array.from(latestBySlug.values()).map((entry) => normalizeMetadata({
            raw: entry.metadata,
            slug: entry.metadata.slug,
            pluginDirPath: entry.pluginDirPath,
            pluginsDir,
            requestContext,
            parseVariantsValue,
            resolveSelectedVariants,
        }));

        plugins.sort((a, b) => String(a.slug || '').localeCompare(String(b.slug || '')));
        return jsonResponse(corsHeaders, plugins);
    } catch (error) {
        if (error instanceof VariantResolutionError) {
            return jsonResponse(corsHeaders, { error: error.message }, 400);
        }
        console.error('Error fetching plugin:', error);
        return jsonResponse(corsHeaders, { error: 'Internal server error' }, 500);
    }
}

async function handleGetPluginMetadata({
    url,
    request,
    slug,
    version,
    pluginsDir,
    isValidSlug,
    findPluginDirsBySlug,
    validatePluginMetadataV2,
    normalizeMetadata,
    parseVariantsValue,
    resolveSelectedVariants,
    VariantResolutionError,
    corsHeaders,
}) {
    try {
        if (!isValidSlug(slug)) {
            return jsonResponse(corsHeaders, { error: 'Invalid plugin slug format' }, 400);
        }

        const pluginDirPaths = await findPluginDirsBySlug(pluginsDir, slug);
        if (!pluginDirPaths || pluginDirPaths.length === 0) {
            return jsonResponse(corsHeaders, { error: 'Plugin not found' }, 404);
        }

        const requestContext = buildRequestContext(url, request);

        if (version) {
            if (!/^[a-zA-Z0-9.-]+$/.test(version)) {
                return jsonResponse(corsHeaders, { error: 'Invalid version format' }, 400);
            }

            for (const pluginDirPath of pluginDirPaths) {
                const filePath = path.join(pluginDirPath, `${version}.json`);

                try {
                    await fs.access(filePath);
                } catch {
                    continue;
                }

                const metadataRaw = await fs.readFile(filePath, 'utf-8');
                const metadata = JSON.parse(metadataRaw);
                const validationErrors = validatePluginMetadataV2(metadata);
                if (validationErrors.length > 0) {
                    return jsonResponse(corsHeaders, {
                        error: 'Plugin metadata is invalid.',
                        details: validationErrors,
                    }, 422);
                }

                return jsonResponse(corsHeaders, normalizeMetadata({
                    raw: metadata,
                    slug,
                    pluginDirPath,
                    pluginsDir,
                    requestContext,
                    parseVariantsValue,
                    resolveSelectedVariants,
                }));
            }

            return jsonResponse(corsHeaders, { error: 'Plugin version not found' }, 404);
        }

        const allVersions = [];
        for (const pluginDirPath of pluginDirPaths) {
            const versions = (await fs.readdir(pluginDirPath)).filter(isVersionMetadataFile);

            for (const file of versions) {
                const filePath = path.join(pluginDirPath, file);
                const metadataRaw = await fs.readFile(filePath, 'utf-8');
                const parsed = JSON.parse(metadataRaw);
                const validationErrors = validatePluginMetadataV2(parsed);
                if (validationErrors.length > 0) {
                    console.warn(`Skipping invalid metadata in ${file}:`, validationErrors);
                    continue;
                }

                allVersions.push(normalizeMetadata({
                    raw: parsed,
                    slug,
                    pluginDirPath,
                    pluginsDir,
                    requestContext,
                    parseVariantsValue,
                    resolveSelectedVariants,
                }));
            }
        }

        if (allVersions.length === 0) {
            return jsonResponse(corsHeaders, { error: 'No versions found for this plugin' }, 404);
        }

        allVersions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }));
        return jsonResponse(corsHeaders, allVersions);
    } catch (error) {
        if (error instanceof VariantResolutionError) {
            return jsonResponse(corsHeaders, { error: error.message }, 400);
        }
        console.error('Error fetching plugins:', error);
        return jsonResponse(corsHeaders, { error: 'Internal server error' }, 500);
    }
}

export {
    handleCreatePluginMetadata,
    handleGetPlugins,
    handleGetPluginMetadata,
};
