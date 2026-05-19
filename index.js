const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const slugify = require('slugify');

const app = express();
app.use(cors());
app.use(express.json());

const PLUGINS_DIR = path.join(__dirname, 'data', 'plugins');

// Ensure plugins directory exists
async function ensurePluginsDir() {
    try {
        await fs.access(PLUGINS_DIR);
    } catch {
        await fs.mkdir(PLUGINS_DIR, { recursive: true });
    }
}

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
        
        try {
            await fs.access(pluginDirPath);
        } catch {
            await fs.mkdir(pluginDirPath, { recursive: true });
        }

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
                    // Simple sort to get "latest" (lexicographical for now, can be improved for semver)
                    versions.sort((a, b) => b.localeCompare(a));
                    const latestVersionFile = versions[0];
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
app.get('/plugins/:slug/:version?', async (req, res) => {
    try {
        const { slug, version } = req.params;
        const pluginDirPath = path.join(PLUGINS_DIR, slug);

        try {
            await fs.access(pluginDirPath);
        } catch {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        let fileToRead = '';

        if (version) {
            fileToRead = `${version}.json`;
        } else {
            // Find latest version if not specified
            const versions = await fs.readdir(pluginDirPath);
            if (versions.length === 0) {
                return res.status(404).json({ error: 'No versions found for this plugin' });
            }
            versions.sort((a, b) => b.localeCompare(a));
            fileToRead = versions[0];
        }

        const filePath = path.join(pluginDirPath, fileToRead);

        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: 'Plugin version not found' });
        }

        const metadataRaw = await fs.readFile(filePath, 'utf-8');
        res.json(JSON.parse(metadataRaw));

    } catch (error) {
        console.error('Error fetching plugin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3001;

ensurePluginsDir().then(() => {
    app.listen(PORT, () => {
        console.log(`Plugin Registry Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize server:', err);
});
