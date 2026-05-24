import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleRequest } from "../Router.js";
import { RegistryService } from "../Services/RegistryService.js";

describe("Route integration", () => {
  let tempRoot;
  let dataDir;
  let registryDir;
  let metaPath;
  let registry;
  let context;

  const slug = "widget>design-system>Atom.demo";
  const version = "1.0.0";

  async function call(method, pathname, body) {
    const request = new Request(`http://localhost${pathname}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    return handleRequest(request, context);
  }

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "superhub-routes-test-"));
    dataDir = path.join(tempRoot, "Data");
    registryDir = path.join(tempRoot, "registry");

    const pluginDir = path.join(dataDir, "Widgets", "DesignSystem", "Atoms", "Demo", "Core");
    await mkdir(pluginDir, { recursive: true });

    const meta = {
      name: "Demo",
      version,
      slug,
      description: "Demo component",
      baseURL: "Data/Widgets/DesignSystem/Atoms/Demo/Core",
      files: [
        { url: "${baseURL}/demo.js", entry: true },
        { url: "${baseURL}/demo.css" },
        { url: "${baseURL}/demo.html" }
      ]
    };

    metaPath = path.join(pluginDir, "meta.json");
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    await writeFile(
      path.join(pluginDir, "demo.js"),
      "// sample\nfunction add(a, b) {\n  return a + b;\n}\n",
      "utf-8"
    );
    await writeFile(
      path.join(pluginDir, "demo.css"),
      "/* sample */\n.btn {\n  color: red;\n}\n",
      "utf-8"
    );
    await writeFile(
      path.join(pluginDir, "demo.html"),
      "<div>\n  <span> hello </span>\n</div>",
      "utf-8"
    );

    registry = new RegistryService({
      projectRoot: tempRoot,
      dataDir,
      registryDir
    });

    await registry.init();
    await registry.verifyLocalRegistry();

    context = {
      projectRoot: tempRoot,
      services: {
        registry
      }
    };
  });

  afterEach(async () => {
    registry.close();
    try {
      await rm(tempRoot, { recursive: true, force: true });
    } catch {
      // Ignore transient Windows file lock races.
    }
  });

  it("serves /meta and /meta/:slug", async () => {
    const listResponse = await call("GET", "/meta");
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.total).toBeGreaterThanOrEqual(1);

    const slugResponse = await call("GET", `/meta/${encodeURIComponent(slug)}`);
    expect(slugResponse.status).toBe(200);
    const slugBody = await slugResponse.json();
    expect(slugBody.data[0].slug).toBe(slug);
  });

  it("serves homepage on root path", async () => {
    const response = await call("GET", "/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html.includes("SuperHub is running")).toBe(true);
    expect(html.includes("API List")).toBe(true);
    expect(html.includes("Meta Explorer")).toBe(true);
    expect(html.includes("Widget Playground")).toBe(false);
  });

  it("minifies /plugin output while /plugin-full stays raw", async () => {
    const fullResponse = await call(
      "GET",
      `/plugin-full/${encodeURIComponent(slug)}/${version}/demo.css`
    );
    expect(fullResponse.status).toBe(200);
    const fullText = await fullResponse.text();

    const minResponse = await call(
      "GET",
      `/plugin/${encodeURIComponent(slug)}/${version}/demo.css`
    );
    expect(minResponse.status).toBe(200);
    const minText = await minResponse.text();

    expect(fullText.includes("sample")).toBe(true);
    expect(minText.includes("sample")).toBe(false);
    expect(minText.length).toBeLessThan(fullText.length);
  });

  it("verify endpoint marks deleted local meta as invalid", async () => {
    await unlink(metaPath);

    const verifyResponse = await call("GET", "/verify/local-registry");
    expect(verifyResponse.status).toBe(200);

    const verifyBody = await verifyResponse.json();
    expect(verifyBody.data.markedInvalidCount).toBe(1);
    expect(verifyBody.data.invalidTotal).toBe(1);

    const hiddenResponse = await call("GET", `/meta/${encodeURIComponent(slug)}`);
    expect(hiddenResponse.status).toBe(404);

    const includedResponse = await call(
      "GET",
      `/meta/${encodeURIComponent(slug)}?includeInvalid=true`
    );
    expect(includedResponse.status).toBe(200);
  });
});
