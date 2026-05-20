import {
    parseVariantsValue,
    validatePluginMetadataV2,
    resolveSelectedVariants,
    stitchFileWithVariants,
    VariantResolutionError,
} from './lib/plugin-runtime.js';
import { CORS_HEADERS, MIME_TYPES, PLUGINS_DIR, PORT } from './lib/server/constants.js';
import { createFetchHandler } from './lib/server/router.js';
import {
    ensurePluginsDir,
    findPluginDirsBySlug,
    sortPluginDirsByHighestVersionDesc,
    collectPluginMetadataFiles,
    loadHighestValidMetadataFromPluginDir,
} from './lib/server/repository.js';
import {
    isValidSlug,
    makeSlug,
} from './lib/server/helpers.js';
import { normalizeMetadata } from './lib/server/metadata.js';

await ensurePluginsDir(PLUGINS_DIR);

const fetchHandler = createFetchHandler({
    corsHeaders: CORS_HEADERS,
    mimeTypes: MIME_TYPES,
    pluginsDir: PLUGINS_DIR,
    ensurePluginsDir,
    findPluginDirsBySlug,
    sortPluginDirsByHighestVersionDesc,
    collectPluginMetadataFiles,
    loadHighestValidMetadataFromPluginDir,
    isValidSlug,
    makeSlug,
    normalizeMetadata,
    parseVariantsValue,
    validatePluginMetadataV2,
    resolveSelectedVariants,
    stitchFileWithVariants,
    VariantResolutionError,
});

const server = Bun.serve({
    port: PORT,
    fetch: fetchHandler,
    error(error) {
        console.error('Fatal Server Error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json; charset=utf-8',
            },
        });
    },
});

console.log(`Plugin Registry Server is listening on ${server.url.origin}`);
console.log('Press Ctrl+C to stop the server.');