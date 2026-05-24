import { Database } from "bun:sqlite";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

function nowIso() {
  return new Date().toISOString();
}

function keyOf(slug, version) {
  return `${slug}@${version}`;
}

function inferTypeAndFamily(slug) {
  const parts = String(slug || "").split(">").filter(Boolean);
  return {
    pluginType: parts[0] || null,
    family: parts[1] || null
  };
}

function normalizeMetaRow(row) {
  const meta = JSON.parse(row.meta_json);
  return {
    slug: row.slug,
    version: row.version,
    sourceType: row.source_type,
    sourcePath: row.source_path,
    invalid: Boolean(row.invalid_flag),
    pluginType: row.plugin_type,
    family: row.family,
    firstSeenAt: row.first_seen_at,
    lastVerifiedAt: row.last_verified_at,
    updatedAt: row.updated_at,
    meta
  };
}

async function findMetaFilesRecursive(rootDir) {
  const found = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase() === "meta.json") {
        found.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return found;
}

export class RegistryService {
  constructor({ projectRoot, dataDir, registryDir }) {
    this.projectRoot = projectRoot;
    this.dataDir = dataDir;
    this.registryDir = registryDir;
    this.dbFile = path.join(registryDir, "registry.sqlite3");
    this.db = null;
  }

  async init() {
    await mkdir(this.registryDir, { recursive: true });
    this.db = new Database(this.dbFile, { create: true, strict: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registry_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        version TEXT NOT NULL,
        name TEXT,
        description TEXT,
        plugin_type TEXT,
        family TEXT,
        source_type TEXT NOT NULL,
        source_path TEXT,
        invalid_flag INTEGER NOT NULL DEFAULT 0,
        meta_json TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_verified_at TEXT,
        updated_at TEXT NOT NULL,
        deleted_local_at TEXT,
        UNIQUE(slug, version)
      );
    `);

    this.db.exec("CREATE INDEX IF NOT EXISTS idx_registry_slug ON registry_entries(slug);");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_registry_invalid ON registry_entries(invalid_flag);");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_registry_source ON registry_entries(source_type);");
  }

  close() {
    if (this.db) {
      this.db.close(false);
      this.db = null;
    }
  }

  async discoverLocalMeta() {
    const files = await findMetaFilesRecursive(this.dataDir);
    const entries = [];
    const errors = [];

    for (const filePath of files) {
      try {
        const raw = await readFile(filePath, "utf-8");
        const meta = JSON.parse(raw);
        if (!meta?.slug || !meta?.version) {
          errors.push({ filePath, error: "missing slug or version" });
          continue;
        }

        const relativePath = path.relative(this.projectRoot, filePath).replaceAll("\\", "/");
        entries.push({ filePath: relativePath, meta });
      } catch (error) {
        errors.push({ filePath, error: error.message });
      }
    }

    return { entries, errors };
  }

  upsertMeta({ meta, sourceType, sourcePath = null, lastVerifiedAt = null }) {
    const stamp = nowIso();
    const { pluginType, family } = inferTypeAndFamily(meta.slug);

    this.db
      .prepare(
        `
        INSERT INTO registry_entries (
          slug, version, name, description, plugin_type, family,
          source_type, source_path, invalid_flag, meta_json,
          first_seen_at, last_verified_at, updated_at, deleted_local_at
        ) VALUES (
          @slug, @version, @name, @description, @pluginType, @family,
          @sourceType, @sourcePath, 0, @metaJson,
          @firstSeenAt, @lastVerifiedAt, @updatedAt, NULL
        )
        ON CONFLICT(slug, version) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          plugin_type = excluded.plugin_type,
          family = excluded.family,
          source_type = excluded.source_type,
          source_path = excluded.source_path,
          invalid_flag = 0,
          meta_json = excluded.meta_json,
          last_verified_at = excluded.last_verified_at,
          updated_at = excluded.updated_at,
          deleted_local_at = NULL
        `
      )
      .run({
        slug: meta.slug,
        version: meta.version,
        name: meta.name || null,
        description: meta.description || null,
        pluginType,
        family,
        sourceType,
        sourcePath,
        metaJson: JSON.stringify(meta),
        firstSeenAt: stamp,
        lastVerifiedAt,
        updatedAt: stamp
      });
  }

  hasEntry(slug, version) {
    const row = this.db
      .prepare("SELECT 1 AS has_entry FROM registry_entries WHERE slug = ? AND version = ? LIMIT 1")
      .get(slug, version);
    return Boolean(row?.has_entry);
  }

  listMeta({ includeInvalid = false } = {}) {
    const query = includeInvalid
      ? "SELECT * FROM registry_entries"
      : "SELECT * FROM registry_entries WHERE invalid_flag = 0";

    const rows = this.db.prepare(query).all();
    return rows.map(normalizeMetaRow);
  }

  getBySlug(slug, { includeInvalid = false } = {}) {
    const query = includeInvalid
      ? "SELECT * FROM registry_entries WHERE slug = ? ORDER BY version DESC"
      : "SELECT * FROM registry_entries WHERE slug = ? AND invalid_flag = 0 ORDER BY version DESC";

    const rows = this.db.prepare(query).all(slug);
    return rows.map(normalizeMetaRow);
  }

  getBySlugVersion(slug, version, { includeInvalid = false } = {}) {
    const query = includeInvalid
      ? "SELECT * FROM registry_entries WHERE slug = ? AND version = ? LIMIT 1"
      : "SELECT * FROM registry_entries WHERE slug = ? AND version = ? AND invalid_flag = 0 LIMIT 1";

    const row = this.db.prepare(query).get(slug, version);
    return row ? normalizeMetaRow(row) : null;
  }

  countInvalidLocal() {
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM registry_entries WHERE source_type = 'local' AND invalid_flag = 1")
      .get();
    return Number(row?.c || 0);
  }

  markMissingLocalAsInvalid(foundKeys) {
    const existingLocal = this.db
      .prepare("SELECT slug, version, invalid_flag FROM registry_entries WHERE source_type = 'local'")
      .all();

    let markedInvalidCount = 0;
    for (const row of existingLocal) {
      const key = keyOf(row.slug, row.version);
      if (!foundKeys.has(key) && !row.invalid_flag) {
        this.db
          .prepare(
            "UPDATE registry_entries SET invalid_flag = 1, deleted_local_at = ?, updated_at = ? WHERE slug = ? AND version = ?"
          )
          .run(nowIso(), nowIso(), row.slug, row.version);
        markedInvalidCount += 1;
      }
    }

    return markedInvalidCount;
  }

  async verifyLocalRegistry() {
    const discovery = await this.discoverLocalMeta();
    const foundKeys = new Set();

    let insertedCount = 0;
    let updatedCount = 0;
    let revalidatedCount = 0;

    for (const entry of discovery.entries) {
      const { slug, version } = entry.meta;
      const key = keyOf(slug, version);
      foundKeys.add(key);

      const existing = this.db
        .prepare("SELECT invalid_flag FROM registry_entries WHERE slug = ? AND version = ? LIMIT 1")
        .get(slug, version);

      if (!existing) {
        insertedCount += 1;
      } else {
        updatedCount += 1;
        if (existing.invalid_flag) {
          revalidatedCount += 1;
        }
      }

      this.upsertMeta({
        meta: entry.meta,
        sourceType: "local",
        sourcePath: entry.filePath,
        lastVerifiedAt: nowIso()
      });
    }

    const markedInvalidCount = this.markMissingLocalAsInvalid(foundKeys);

    return {
      scannedCount: discovery.entries.length,
      parseErrors: discovery.errors,
      insertedCount,
      updatedCount,
      markedInvalidCount,
      revalidatedCount,
      invalidTotal: this.countInvalidLocal()
    };
  }
}
