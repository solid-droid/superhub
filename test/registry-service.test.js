import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RegistryService } from "../Services/RegistryService.js";

describe("RegistryService verifyLocalRegistry", () => {
  let tempRoot;
  let dataDir;
  let registryDir;
  let metaFile;
  let service;

  const meta = {
    name: "Button",
    version: "1.0.0",
    slug: "widget>design-system>Atom.button",
    description: "Button component",
    baseURL: "Data/Widgets/DesignSystem/Atoms/Button/Core",
    files: [{ url: "${baseURL}/button.js", entry: true }]
  };

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "superhub-registry-test-"));
    dataDir = path.join(tempRoot, "Data");
    registryDir = path.join(tempRoot, "registry");
    const targetDir = path.join(dataDir, "Widgets", "DesignSystem", "Atoms", "Button", "Core");
    await mkdir(targetDir, { recursive: true });

    metaFile = path.join(targetDir, "meta.json");
    await writeFile(metaFile, JSON.stringify(meta, null, 2), "utf-8");

    service = new RegistryService({
      projectRoot: tempRoot,
      dataDir,
      registryDir
    });

    await service.init();
  });

  afterEach(async () => {
    service.close();
    try {
      await rm(tempRoot, { recursive: true, force: true });
    } catch {
      // Windows can hold sqlite sidecar file handles briefly; ignore cleanup races in tests.
    }
  });

  it("creates sqlite file and hydrates local meta", async () => {
    const summary = await service.verifyLocalRegistry();

    const dbFile = path.join(registryDir, "registry.sqlite3");
    const dbBuffer = await readFile(dbFile);

    expect(dbBuffer.byteLength).toBeGreaterThan(0);
    expect(summary.scannedCount).toBe(1);
    expect(summary.insertedCount).toBe(1);
    expect(summary.invalidTotal).toBe(0);

    const entry = service.getBySlugVersion(meta.slug, meta.version);
    expect(entry).not.toBeNull();
    expect(entry.meta.name).toBe("Button");
  });

  it("marks deleted local meta as invalid and revalidates when restored", async () => {
    await service.verifyLocalRegistry();

    await unlink(metaFile);
    const afterDelete = await service.verifyLocalRegistry();
    expect(afterDelete.markedInvalidCount).toBe(1);
    expect(afterDelete.invalidTotal).toBe(1);

    await writeFile(metaFile, JSON.stringify(meta, null, 2), "utf-8");
    const afterRestore = await service.verifyLocalRegistry();
    expect(afterRestore.revalidatedCount).toBe(1);
    expect(afterRestore.invalidTotal).toBe(0);
  });
});
