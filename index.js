import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    parseVariantsValue,
    validatePluginMetadataV2,
    resolveSelectedVariants,
    stitchFileWithVariants,
    VariantResolutionError,
} from './lib/plugin-runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGINS_DIR = path.join(__dirname, 'data', 'plugins');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const MIME_TYPES = {
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Ensure plugins directory exists
async function ensurePluginsDir() {
    try {
        await fs.access(PLUGINS_DIR);
    } catch {
        await fs.mkdir(PLUGINS_DIR, { recursive: true });
    }
}

// Sort versions (SemVer descending: 10.0.0 > 2.0.0)
function sortVersionsDescending(versions) {
    return versions.sort((a, b) => {
        const pa = a.replace('.json', '').split('.').map(Number);
        const pb = b.replace('.json', '').split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na !== nb) return nb - na; // Descending
        }
        return 0;
    });
}

function isVersionMetadataFile(name) {
    return typeof name === 'string' && name.toLowerCase().endsWith('.json');
}

// Validate slug to prevent Path Traversal
function isValidSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug);
}

function makeSlug(name) {
    return String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}


async function findPluginDirsBySlug(slug) {
    async function directoryContainsSlugMetadata(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || !isVersionMetadataFile(entry.name)) {
                continue;
            }

            try {
                const filePath = path.join(dirPath, entry.name);
                const raw = await fs.readFile(filePath, 'utf-8');
                const metadata = JSON.parse(raw);
                if (metadata?.slug === slug) {
                    return true;
                }
            } catch {
                // Ignore malformed metadata files during lookup.
            }
        }

        return false;
    }

    async function walk(currentDir) {
        const items = await fs.readdir(currentDir, { withFileTypes: true });
        const matches = [];

        for (const item of items) {
            if (!item.isDirectory()) {
                continue;
            }

            const dirPath = path.join(currentDir, item.name);
            if (item.name === slug || makeSlug(item.name) === slug || await directoryContainsSlugMetadata(dirPath)) {
                matches.push(dirPath);
            }

            const nested = await walk(dirPath);
            if (nested.length > 0) {
                matches.push(...nested);
            }
        }

        return matches;
    }


    return walk(PLUGINS_DIR);
}

async function sortPluginDirsByHighestVersionDesc(pluginDirPaths) {
    const scored = [];

    for (const pluginDirPath of pluginDirPaths) {
        const versions = (await fs.readdir(pluginDirPath)).filter(isVersionMetadataFile);
        if (versions.length === 0) {
            continue;
        }

        const highest = sortVersionsDescending([...versions])[0].replace('.json', '');
        scored.push({ pluginDirPath, highest });
    }

    scored.sort((a, b) => b.highest.localeCompare(a.highest, undefined, { numeric: true, sensitivity: 'base' }));
    return scored.map((x) => x.pluginDirPath);
}

async function collectPluginMetadataFiles(rootDir) {
    const collected = [];

    async function walk(currentDir) {
        const items = await fs.readdir(currentDir, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(currentDir, item.name);
            if (item.isDirectory()) {
                await walk(itemPath);
                continue;
            }

            if (item.isFile() && isVersionMetadataFile(item.name)) {
                collected.push({
                    filePath: itemPath,
                    pluginDirPath: currentDir,
                });
            }
        }
    }

    await walk(rootDir);
    return collected;
}

async function loadHighestValidMetadataFromPluginDir(pluginDirPath) {
    const versions = (await fs.readdir(pluginDirPath)).filter(isVersionMetadataFile);
    const sortedVersions = sortVersionsDescending([...versions]);

    for (const versionFile of sortedVersions) {
        try {
            const raw = await fs.readFile(path.join(pluginDirPath, versionFile), 'utf-8');
            const parsed = JSON.parse(raw);
            const validationErrors = validatePluginMetadataV2(parsed);
            if (validationErrors.length === 0) {
                return parsed;
            }
        } catch {
            // Skip malformed metadata files.
        }
    }

    return null;
}

function buildAssetUrl(pluginDirPath, relativePath, querySuffix = '') {
    const normalized = String(relativePath || '').replace(/^\/+/, '');
    return `/plugin-assets/${path.relative(PLUGINS_DIR, pluginDirPath).replace(/\\/g, '/')}/${normalized}${querySuffix}`;
}

function normalizeMetadata(raw, slug, pluginDirPath, requestContext) {
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

    const logicUrl = logicPath ? buildAssetUrl(pluginDirPath, logicPath, querySuffix) : null;
    const templateUrl = templatePath ? buildAssetUrl(pluginDirPath, templatePath, querySuffix) : null;
    const styleUrls = styleEntries
        .filter((style) => style && typeof style.path === 'string')
        .map((style) => ({
            ...style,
            url: buildAssetUrl(pluginDirPath, style.path, querySuffix),
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
                meta: `/plugin-assets/${path.relative(PLUGINS_DIR, pluginDirPath).replace(/\\/g, '/')}/${metaPath}`,
            };
        });
    }

    normalized._links = {
        self: `${requestContext.origin}/plugins/${slug}${normalized.version ? `/${normalized.version}` : ''}`,
    };

    return normalized;
}

function withCors(headers = {}) {
    return {
        ...CORS_HEADERS,
        ...headers,
    };
}

function jsonResponse(payload, status = 200, headers = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: withCors({
            'Content-Type': 'application/json; charset=utf-8',
            ...headers,
        }),
    });
}

function textResponse(payload, status = 200, headers = {}) {
    return new Response(payload, {
        status,
        headers: withCors(headers),
    });
}

function isPathInside(rootPath, targetPath) {
    const relative = path.relative(rootPath, targetPath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function buildRequestContext(url, request) {
    const host = request.headers.get('host') || url.host;
    return {
        origin: `${url.protocol}//${host}`,
        query: {
            variants: url.searchParams.get('variants') || undefined,
            variantPolicy: url.searchParams.get('variantPolicy') || undefined,
        },
    };
}

async function serveStaticFile(filePath) {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
        return null;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    return new Response(file, {
        status: 200,
        headers: withCors({
            'Content-Type': contentType,
        }),
    });
}

async function handlePluginAssets(url) {
    const relativePath = url.pathname.replace(/^\/plugin-assets\//, '');
    const resolvedPath = path.resolve(PLUGINS_DIR, relativePath);
    if (!isPathInside(PLUGINS_DIR, resolvedPath)) {
        return jsonResponse({ error: 'Access Denied' }, 403);
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const variantsParam = url.searchParams.get('variants');
    const variantPolicy = String(url.searchParams.get('variantPolicy') || 'last-write-wins');

    if (variantsParam && ['.js', '.css', '.html'].includes(ext)) {
        try {
            await fs.access(resolvedPath);
            const selectedVariants = resolveSelectedVariants(null, variantsParam, { variantPolicy });
            const stitched = await stitchFileWithVariants(resolvedPath, path.dirname(resolvedPath), ext, selectedVariants);
            return textResponse(stitched, 200, {
                'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8',
            });
        } catch (error) {
            if (error instanceof VariantResolutionError) {
                return jsonResponse({ error: error.message }, 400);
            }
        }
    }

    const response = await serveStaticFile(resolvedPath);
    if (!response) {
        return jsonResponse({ error: 'Asset not found' }, 404);
    }
    return response;
}

async function handleCreatePluginMetadata(request) {
    try {
        const metadata = await request.json();

        if (!metadata?.name || !metadata?.version) {
            return jsonResponse({ error: 'Plugin name and version are required.' }, 400);
        }

        const slug = makeSlug(metadata.name);
        metadata.slug = slug;

        const validationErrors = validatePluginMetadataV2(metadata);
        if (validationErrors.length > 0) {
            return jsonResponse({
                error: 'Invalid plugin metadata format.',
                details: validationErrors,
            }, 400);
        }

        const pluginDirPath = path.join(PLUGINS_DIR, slug);
        await fs.mkdir(pluginDirPath, { recursive: true });

        const versionFilePath = path.join(pluginDirPath, `${metadata.version}.json`);
        await fs.writeFile(versionFilePath, JSON.stringify(metadata, null, 2), 'utf-8');

        return jsonResponse({ message: 'Plugin metadata created successfully', slug, version: metadata.version }, 201);
    } catch (error) {
        console.error('Error creating plugin:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

async function handleGetPlugins(url, request) {
    try {
        await ensurePluginsDir();
        const metadataFiles = await collectPluginMetadataFiles(PLUGINS_DIR);
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
        const plugins = Array.from(latestBySlug.values()).map((entry) =>
            normalizeMetadata(entry.metadata, entry.metadata.slug, entry.pluginDirPath, requestContext)
        );

        plugins.sort((a, b) => String(a.slug || '').localeCompare(String(b.slug || '')));
        return jsonResponse(plugins);
    } catch (error) {
        if (error instanceof VariantResolutionError) {
            return jsonResponse({ error: error.message }, 400);
        }
        console.error('Error fetching plugin:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

async function handlePluginAssetBySlug(url, request, slug, assetPath) {
    try {
        if (!isValidSlug(slug)) {
            return jsonResponse({ error: 'Invalid plugin slug format' }, 400);
        }

        const pluginDirPaths = await findPluginDirsBySlug(slug);
        if (!pluginDirPaths || pluginDirPaths.length === 0) {
            return jsonResponse({ error: 'Plugin not found' }, 404);
        }

        const relativeAssetPath = String(assetPath || '').replace(/^\/+/, '');
        const sortedPluginDirs = await sortPluginDirsByHighestVersionDesc(pluginDirPaths);

        for (const pluginDirPath of sortedPluginDirs) {
            const resolvedPath = path.resolve(pluginDirPath, relativeAssetPath);
            const resolvedPluginRoot = path.resolve(pluginDirPath);

            if (!isPathInside(resolvedPluginRoot, resolvedPath)) {
                continue;
            }

            try {
                await fs.access(resolvedPath);
                const ext = path.extname(resolvedPath).toLowerCase();
                const variantsParam = url.searchParams.get('variants');

                if (variantsParam && ['.js', '.css', '.html'].includes(ext)) {
                    const pluginMetadata = await loadHighestValidMetadataFromPluginDir(pluginDirPath);
                    const variantPolicy = String(url.searchParams.get('variantPolicy') || pluginMetadata?.variants?.conflictPolicy || 'last-write-wins');
                    const selectedVariants = resolveSelectedVariants(pluginMetadata, variantsParam, { variantPolicy });
                    const stitched = await stitchFileWithVariants(resolvedPath, path.dirname(resolvedPath), ext, selectedVariants);
                    return textResponse(stitched, 200, {
                        'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8',
                    });
                }

                const response = await serveStaticFile(resolvedPath);
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

        return jsonResponse({ error: 'Asset not found' }, 404);
    } catch (error) {
        if (error instanceof VariantResolutionError) {
            return jsonResponse({ error: error.message }, 400);
        }
        console.error('Error serving plugin asset:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

async function handleGetPluginMetadata(url, request, slug, version) {
    try {
        if (!isValidSlug(slug)) {
            return jsonResponse({ error: 'Invalid plugin slug format' }, 400);
        }

        const pluginDirPaths = await findPluginDirsBySlug(slug);
        if (!pluginDirPaths || pluginDirPaths.length === 0) {
            return jsonResponse({ error: 'Plugin not found' }, 404);
        }

        const requestContext = buildRequestContext(url, request);

        if (version) {
            if (!/^[a-zA-Z0-9.-]+$/.test(version)) {
                return jsonResponse({ error: 'Invalid version format' }, 400);
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
                    return jsonResponse({
                        error: 'Plugin metadata is invalid.',
                        details: validationErrors,
                    }, 422);
                }

                return jsonResponse(normalizeMetadata(metadata, slug, pluginDirPath, requestContext));
            }

            return jsonResponse({ error: 'Plugin version not found' }, 404);
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
                allVersions.push(normalizeMetadata(parsed, slug, pluginDirPath, requestContext));
            }
        }

        if (allVersions.length === 0) {
            return jsonResponse({ error: 'No versions found for this plugin' }, 404);
        }

        allVersions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }));
        return jsonResponse(allVersions);
    } catch (error) {
        if (error instanceof VariantResolutionError) {
            return jsonResponse({ error: error.message }, 400);
        }
        console.error('Error fetching plugins:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

// ==========================================
// STARTUP
// ==========================================
const PORT = Number(process.env.PORT || 3001);

await ensurePluginsDir();

const server = Bun.serve({
    port: PORT,
    async fetch(request) {
        const url = new URL(request.url);
        const { pathname } = url;

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: withCors(),
            });
        }

        if (request.method === 'GET' && pathname.startsWith('/plugin-assets/')) {
            return handlePluginAssets(url);
        }

        if (request.method === 'POST' && pathname === '/plugins') {
            return handleCreatePluginMetadata(request);
        }

        if (request.method === 'GET' && pathname === '/plugins') {
            return handleGetPlugins(url, request);
        }

        const pluginAssetMatch = pathname.match(/^\/plugins\/([^/]+)\/assets\/(.+)$/);
        if (request.method === 'GET' && pluginAssetMatch) {
            const [, slug, assetPath] = pluginAssetMatch;
            return handlePluginAssetBySlug(url, request, slug, assetPath);
        }

        const pluginMetadataMatch = pathname.match(/^\/plugins\/([^/]+)(?:\/([^/]+))?$/);
        if (request.method === 'GET' && pluginMetadataMatch) {
            const [, slug, version] = pluginMetadataMatch;
            return handleGetPluginMetadata(url, request, slug, version);
        }

        return jsonResponse({ error: 'Not Found' }, 404);
    },
    error(error) {
        console.error('Fatal Server Error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    },
});

console.log(`Plugin Registry Server is listening on ${server.url.origin}`);
console.log('Press Ctrl+C to stop the server.');