import fs from 'fs/promises';
import path from 'path';
import {
    isPathInside,
    jsonResponse,
    textResponse,
    withCors,
} from '../helpers.js';

async function serveStaticFile(filePath, mimeTypes, corsHeaders) {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
        return null;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new Response(file, {
        status: 200,
        headers: withCors(corsHeaders, {
            'Content-Type': contentType,
        }),
    });
}

async function handlePluginAssets({
    url,
    pluginsDir,
    mimeTypes,
    corsHeaders,
    resolveSelectedVariants,
    stitchFileWithVariants,
    VariantResolutionError,
}) {
    const relativePath = url.pathname.replace(/^\/plugin-assets\//, '');
    const resolvedPath = path.resolve(pluginsDir, relativePath);

    if (!isPathInside(pluginsDir, resolvedPath, path)) {
        return jsonResponse(corsHeaders, { error: 'Access Denied' }, 403);
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const variantsParam = url.searchParams.get('variants');
    const variantPolicy = String(url.searchParams.get('variantPolicy') || 'last-write-wins');

    if (variantsParam && ['.js', '.css', '.html'].includes(ext)) {
        try {
            await fs.access(resolvedPath);
            const selectedVariants = resolveSelectedVariants(null, variantsParam, { variantPolicy });
            const stitched = await stitchFileWithVariants(resolvedPath, path.dirname(resolvedPath), ext, selectedVariants);
            return textResponse(corsHeaders, stitched, 200, {
                'Content-Type': mimeTypes[ext] || 'text/plain; charset=utf-8',
            });
        } catch (error) {
            if (error instanceof VariantResolutionError) {
                return jsonResponse(corsHeaders, { error: error.message }, 400);
            }
        }
    }

    const response = await serveStaticFile(resolvedPath, mimeTypes, corsHeaders);
    if (!response) {
        return jsonResponse(corsHeaders, { error: 'Asset not found' }, 404);
    }

    return response;
}

async function handlePluginAssetBySlug({
    url,
    slug,
    assetPath,
    isValidSlug,
    findPluginDirsBySlug,
    sortPluginDirsByHighestVersionDesc,
    loadHighestValidMetadataFromPluginDir,
    validatePluginMetadataV2,
    resolveSelectedVariants,
    stitchFileWithVariants,
    VariantResolutionError,
    pluginsDir,
    mimeTypes,
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

        const relativeAssetPath = String(assetPath || '').replace(/^\/+/, '');
        const sortedPluginDirs = await sortPluginDirsByHighestVersionDesc(pluginDirPaths);

        for (const pluginDirPath of sortedPluginDirs) {
            const resolvedPath = path.resolve(pluginDirPath, relativeAssetPath);
            const resolvedPluginRoot = path.resolve(pluginDirPath);

            if (!isPathInside(resolvedPluginRoot, resolvedPath, path)) {
                continue;
            }

            try {
                await fs.access(resolvedPath);
                const ext = path.extname(resolvedPath).toLowerCase();
                const variantsParam = url.searchParams.get('variants');

                if (variantsParam && ['.js', '.css', '.html'].includes(ext)) {
                    const pluginMetadata = await loadHighestValidMetadataFromPluginDir(pluginDirPath, validatePluginMetadataV2);
                    const variantPolicy = String(url.searchParams.get('variantPolicy') || pluginMetadata?.variants?.conflictPolicy || 'last-write-wins');
                    const selectedVariants = resolveSelectedVariants(pluginMetadata, variantsParam, { variantPolicy });
                    const stitched = await stitchFileWithVariants(resolvedPath, path.dirname(resolvedPath), ext, selectedVariants);
                    return textResponse(corsHeaders, stitched, 200, {
                        'Content-Type': mimeTypes[ext] || 'text/plain; charset=utf-8',
                    });
                }

                const response = await serveStaticFile(resolvedPath, mimeTypes, corsHeaders);
                if (response) {
                    return response;
                }
            } catch (error) {
                if (error instanceof VariantResolutionError) {
                    throw error;
                }
                // Try next candidate directory.
            }
        }

        return jsonResponse(corsHeaders, { error: 'Asset not found' }, 404);
    } catch (error) {
        if (error instanceof VariantResolutionError) {
            return jsonResponse(corsHeaders, { error: error.message }, 400);
        }
        console.error('Error serving plugin asset:', error);
        return jsonResponse(corsHeaders, { error: 'Internal server error' }, 500);
    }
}

export {
    serveStaticFile,
    handlePluginAssets,
    handlePluginAssetBySlug,
};
