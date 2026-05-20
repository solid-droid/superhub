const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const slugify = require('slugify');

const app = express();
app.use(cors());
app.use(express.json());

const PLUGINS_DIR = path.join(__dirname, 'data', 'plugins');

// Serve plugin assets directly so clients can dynamic-import local modules.
app.use('/plugin-assets', express.static(PLUGINS_DIR));

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
    return slugify(name || '', { lower: true, strict: true });
}

async function findPluginDirBySlug(slug) {
    async function walk(currentDir) {
        const items = await fs.readdir(currentDir, { withFileTypes: true });

        for (const item of items) {
            if (!item.isDirectory()) {
                continue;
            }

            const dirPath = path.join(currentDir, item.name);
            if (item.name === slug || makeSlug(item.name) === slug) {
                return dirPath;
            }

            const nested = await walk(dirPath);
            if (nested) {
                return nested;
            }
        }

        return null;
    }

    return walk(PLUGINS_DIR);
}

function normalizeMetadata(raw, slug, pluginDirPath, req) {
    const normalized = { ...raw };

    if (!normalized.slug) {
        normalized.slug = slug;
    }

    const files = Array.isArray(normalized.Files) ? normalized.Files : [];
    const firstLocalJs = files.find((f) => {
        if (!f || typeof f.path !== 'string') {
            return false;
        }
        return (f.type || 'local') === 'local' && f.path.toLowerCase().endsWith('.js');
    });

    const entryFromLegacy = firstLocalJs
        ? `/plugin-assets/${path.relative(PLUGINS_DIR, pluginDirPath).replace(/\\\\/g, '/')}/${firstLocalJs.path.replace(/^\/+/, '')}`
        : null;

    const entryFromMain = typeof normalized.main === 'string' && normalized.main.toLowerCase().endsWith('.js')
        ? `/plugin-assets/${path.relative(PLUGINS_DIR, pluginDirPath).replace(/\\\\/g, '/')}/${normalized.main.replace(/^\/+/, '')}`
        : null;

    if (!normalized.entry && !normalized.module && !normalized.url && !normalized.path) {
        normalized.entry = entryFromLegacy || entryFromMain || null;
    }

    if (normalized.entry && typeof normalized.entry === 'string' && !/^https?:\/\//i.test(normalized.entry)) {
        normalized.entry = normalized.entry.startsWith('/')
            ? normalized.entry
            : `/plugin-assets/${normalized.entry.replace(/^\/+/, '')}`;
    }

    if (normalized.widgets && Array.isArray(normalized.widgets)) {
        normalized.widgets = normalized.widgets.map((widget) => {
            if (!widget || !widget.meta || typeof widget.meta !== 'string') {
                return widget;
            }

            const metaPath = widget.meta.replace(/^\/+/, '');
            return {
                ...widget,
                meta: `/plugin-assets/${path.relative(PLUGINS_DIR, pluginDirPath).replace(/\\\\/g, '/')}/${metaPath}`,
            };
        });
    }

    normalized._links = {
        self: `${req.protocol}://${req.get('host')}/plugins/${slug}${normalized.version ? `/${normalized.version}` : ''}`,
    };

    return normalized;
}

// ==========================================
// ROUTES
// ==========================================

// POST /plugins - Create a new plugin metadata
app.post('/plugins', async (req, res) => {
    try {
        const metadata = req.body;

        if (!metadata.name || !metadata.version) {
            return res.status(400).json({ error: 'Plugin name and version are required.' });
        }

        const slug = makeSlug(metadata.name);
        metadata.slug = slug;

        const pluginDirPath = path.join(PLUGINS_DIR, slug);
        
        // Ensure plugin-specific directory exists
        await fs.mkdir(pluginDirPath, { recursive: true });

        const versionFilePath = path.join(pluginDirPath, `${metadata.version}.json`);
        
        // Write the specific version metadata
        await fs.writeFile(versionFilePath, JSON.stringify(metadata, null, 2), 'utf-8');

        res.status(201).json({ message: 'Plugin metadata created successfully', slug, version: metadata.version });
    } catch (error) {
        console.error('Error creating plugin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /plugins - Get all metadata files (latest version of each plugin)
app.get('/plugins', async (req, res) => {
    try {
        await ensurePluginsDir();
        const plugins = [];
        
        const items = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });
        
        for (const item of items) {
            if (item.isDirectory()) {
                const pluginDirPath = path.join(PLUGINS_DIR, item.name);
                const versions = (await fs.readdir(pluginDirPath)).filter(isVersionMetadataFile);
                
                if (versions.length > 0) {
                    const sortedVersions = sortVersionsDescending(versions);
                    const latestVersionFile = sortedVersions[0];
                    const metadataRaw = await fs.readFile(path.join(pluginDirPath, latestVersionFile), 'utf-8');
                    const slug = makeSlug(item.name);
                    plugins.push(normalizeMetadata(JSON.parse(metadataRaw), slug, pluginDirPath, req));
                }
            }
        }

        res.json(plugins);
    } catch (error) {
        console.error('Error fetching plugins:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /plugins/:slug/assets/* - Serve plugin assets by slug
app.get('/plugins/:slug/assets/:assetPath(*)', async (req, res) => {
    try {
        const { slug, assetPath } = req.params;

        if (!isValidSlug(slug)) {
            return res.status(400).json({ error: 'Invalid plugin slug format' });
        }

        const pluginDirPath = await findPluginDirBySlug(slug);
        if (!pluginDirPath) {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        const relativeAssetPath = String(assetPath || '').replace(/^\/+/, '');
        const resolvedPath = path.resolve(pluginDirPath, relativeAssetPath);
        const resolvedPluginRoot = path.resolve(pluginDirPath);

        // Prevent path traversal
        if (!resolvedPath.startsWith(resolvedPluginRoot)) {
            return res.status(400).json({ error: 'Invalid asset path' });
        }

        try {
            await fs.access(resolvedPath);
        } catch {
            return res.status(404).json({ error: 'Asset not found' });
        }

        return res.sendFile(resolvedPath);
    } catch (error) {
        console.error('Error serving plugin asset:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /plugins/:slug/:version? - Get specific plugin metadata
app.get(['/plugins/:slug', '/plugins/:slug/:version'], async (req, res) => {
    try {
        const { slug, version } = req.params;

        // Security check
        if (!isValidSlug(slug)) {
            return res.status(400).json({ error: 'Invalid plugin slug format' });
        }

        const pluginDirPath = await findPluginDirBySlug(slug);

        if (!pluginDirPath) {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        if (version) {
            // Basic sanitization for version string (alphanumeric, dots, hyphens)
            if (!/^[a-zA-Z0-9.-]+$/.test(version)) {
                return res.status(400).json({ error: 'Invalid version format' });
            }
            const filePath = path.join(pluginDirPath, `${version}.json`);
            
            try {
                await fs.access(filePath);
            } catch {
                return res.status(404).json({ error: 'Plugin version not found' });
            }

            const metadataRaw = await fs.readFile(filePath, 'utf-8');
            const metadata = JSON.parse(metadataRaw);
            return res.json(normalizeMetadata(metadata, slug, pluginDirPath, req));
        } else {
            // Return all versions if not specified
            const versions = (await fs.readdir(pluginDirPath)).filter(isVersionMetadataFile);
            if (versions.length === 0) {
                return res.status(404).json({ error: 'No versions found for this plugin' });
            }
            
            const allVersions = [];
            for (const file of versions) {
                const filePath = path.join(pluginDirPath, file);
                const metadataRaw = await fs.readFile(filePath, 'utf-8');
                allVersions.push(normalizeMetadata(JSON.parse(metadataRaw), slug, pluginDirPath, req));
            }
            
            // Sort versions descending
            allVersions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }));
            return res.json(allVersions);
        }

    } catch (error) {
        console.error('Error fetching plugin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==========================================
// STARTUP
// ==========================================
const PORT = process.env.PORT || 3001;

ensurePluginsDir().then(() => {
    const server = app.listen(PORT, () => {
        console.log(`Plugin Registry Server is listening on http://localhost:${PORT}`);
        console.log(`Press Ctrl+C to stop the server.`);
    });
    
    // STRICT ERROR CATCHER: If the port is already in use, scream and crash loudly.
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
            console.error(`Another server is running in the background. Kill it first.\n`);
            process.exit(1);
        } else {
            console.error('\n❌ Fatal Server Error:', err);
        }
    });

    server.on('close', () => {
        console.log('Server process closed naturally.');
    });

}).catch(err => {
    console.error('Fatal Error: Failed to initialize server directory:', err);
});