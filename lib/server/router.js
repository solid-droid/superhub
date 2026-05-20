import { withCors, jsonResponse } from './helpers.js';
import { handlePluginAssets, handlePluginAssetBySlug } from './handlers/assets.js';
import {
    handleCreatePluginMetadata,
    handleGetPlugins,
    handleGetPluginMetadata,
} from './handlers/plugins.js';

function createFetchHandler(deps) {
    return async function fetchHandler(request) {
        const url = new URL(request.url);
        const { pathname } = url;

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: withCors(deps.corsHeaders),
            });
        }

        if (request.method === 'GET' && pathname.startsWith('/plugin-assets/')) {
            return handlePluginAssets({
                url,
                pluginsDir: deps.pluginsDir,
                mimeTypes: deps.mimeTypes,
                corsHeaders: deps.corsHeaders,
                resolveSelectedVariants: deps.resolveSelectedVariants,
                stitchFileWithVariants: deps.stitchFileWithVariants,
                VariantResolutionError: deps.VariantResolutionError,
            });
        }

        if (request.method === 'POST' && pathname === '/plugins') {
            return handleCreatePluginMetadata({
                request,
                pluginsDir: deps.pluginsDir,
                makeSlug: deps.makeSlug,
                validatePluginMetadataV2: deps.validatePluginMetadataV2,
                corsHeaders: deps.corsHeaders,
            });
        }

        if (request.method === 'GET' && pathname === '/plugins') {
            return handleGetPlugins({
                url,
                request,
                pluginsDir: deps.pluginsDir,
                ensurePluginsDir: deps.ensurePluginsDir,
                collectPluginMetadataFiles: deps.collectPluginMetadataFiles,
                validatePluginMetadataV2: deps.validatePluginMetadataV2,
                normalizeMetadata: deps.normalizeMetadata,
                parseVariantsValue: deps.parseVariantsValue,
                resolveSelectedVariants: deps.resolveSelectedVariants,
                VariantResolutionError: deps.VariantResolutionError,
                corsHeaders: deps.corsHeaders,
            });
        }

        const pluginAssetMatch = pathname.match(/^\/plugins\/([^/]+)\/assets\/(.+)$/);
        if (request.method === 'GET' && pluginAssetMatch) {
            const [, slug, assetPath] = pluginAssetMatch;
            return handlePluginAssetBySlug({
                url,
                slug,
                assetPath,
                isValidSlug: deps.isValidSlug,
                findPluginDirsBySlug: deps.findPluginDirsBySlug,
                sortPluginDirsByHighestVersionDesc: deps.sortPluginDirsByHighestVersionDesc,
                loadHighestValidMetadataFromPluginDir: deps.loadHighestValidMetadataFromPluginDir,
                validatePluginMetadataV2: deps.validatePluginMetadataV2,
                resolveSelectedVariants: deps.resolveSelectedVariants,
                stitchFileWithVariants: deps.stitchFileWithVariants,
                VariantResolutionError: deps.VariantResolutionError,
                pluginsDir: deps.pluginsDir,
                mimeTypes: deps.mimeTypes,
                corsHeaders: deps.corsHeaders,
            });
        }

        const pluginMetadataMatch = pathname.match(/^\/plugins\/([^/]+)(?:\/([^/]+))?$/);
        if (request.method === 'GET' && pluginMetadataMatch) {
            const [, slug, version] = pluginMetadataMatch;
            return handleGetPluginMetadata({
                url,
                request,
                slug,
                version,
                pluginsDir: deps.pluginsDir,
                isValidSlug: deps.isValidSlug,
                findPluginDirsBySlug: deps.findPluginDirsBySlug,
                validatePluginMetadataV2: deps.validatePluginMetadataV2,
                normalizeMetadata: deps.normalizeMetadata,
                parseVariantsValue: deps.parseVariantsValue,
                resolveSelectedVariants: deps.resolveSelectedVariants,
                VariantResolutionError: deps.VariantResolutionError,
                corsHeaders: deps.corsHeaders,
            });
        }

        return jsonResponse(deps.corsHeaders, { error: 'Not Found' }, 404);
    };
}

export { createFetchHandler };
