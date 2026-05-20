const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const slugify = require('slugify');

const app = express();
app.use(cors());
app.use(express.json());

const PLUGINS_DIR = path.join(__dirname, 'data', 'plugins');

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

// Validate slug to prevent Path Traversal
function isValidSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug);
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

        const slug = slugify(metadata.name, { lower: true, strict: true });
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
                const versions = await fs.readdir(pluginDirPath);
                
                if (versions.length > 0) {
                    const sortedVersions = sortVersionsDescending(versions);
                    const latestVersionFile = sortedVersions[0];
                    const metadataRaw = await fs.readFile(path.join(pluginDirPath, latestVersionFile), 'utf-8');
                    plugins.push(JSON.parse(metadataRaw));
                }
            }
        }

        res.json(plugins);
    } catch (error) {
        console.error('Error fetching plugins:', error);
        res.status(500).json({ error: 'Internal server error' });
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

        const pluginDirPath = path.join(PLUGINS_DIR, slug);

        try {
            await fs.access(pluginDirPath);
        } catch {
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
            return res.json(JSON.parse(metadataRaw));
        } else {
            // Return all versions if not specified
            const versions = await fs.readdir(pluginDirPath);
            if (versions.length === 0) {
                return res.status(404).json({ error: 'No versions found for this plugin' });
            }
            
            const allVersions = [];
            for (const file of versions) {
                const filePath = path.join(pluginDirPath, file);
                const metadataRaw = await fs.readFile(filePath, 'utf-8');
                allVersions.push(JSON.parse(metadataRaw));
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