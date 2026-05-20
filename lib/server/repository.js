import fs from 'fs/promises';
import path from 'path';
import {
    isVersionMetadataFile,
    makeSlug,
    sortVersionsDescending,
} from './helpers.js';

async function ensurePluginsDir(pluginsDir) {
    try {
        await fs.access(pluginsDir);
    } catch {
        await fs.mkdir(pluginsDir, { recursive: true });
    }
}

async function findPluginDirsBySlug(pluginsDir, slug) {
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

    return walk(pluginsDir);
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

async function loadHighestValidMetadataFromPluginDir(pluginDirPath, validatePluginMetadataV2) {
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

export {
    ensurePluginsDir,
    findPluginDirsBySlug,
    sortPluginDirsByHighestVersionDesc,
    collectPluginMetadataFiles,
    loadHighestValidMetadataFromPluginDir,
};
