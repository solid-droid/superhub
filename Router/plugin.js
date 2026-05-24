import { jsonResponse, toErrorBody } from "../Helper/http.js";
import { resolvePluginBundle, resolvePluginFile } from "../Services/FileResolverService.js";
import { minifyBundle, minifyByPath } from "../Services/MinifierService.js";
import { getPathParam } from "./_utils.js";

export async function handlePluginBundle({ params, services, projectRoot }) {
  const slug = getPathParam(params, "slug");
  const version = getPathParam(params, "version");
  const entry = services.registry.getBySlugVersion(slug, version, { includeInvalid: false });

  if (!entry) {
    return jsonResponse(404, toErrorBody("plugin not found", { slug, version }));
  }

  try {
    const bundle = await resolvePluginBundle(projectRoot, entry.meta);
    const minified = minifyBundle(bundle);
    return jsonResponse(200, { ok: true, data: minified });
  } catch (error) {
    return jsonResponse(500, toErrorBody("plugin resolution failed", error.message));
  }
}

export async function handlePluginFile({ params, services, projectRoot }) {
  const slug = getPathParam(params, "slug");
  const version = getPathParam(params, "version");
  const file = getPathParam(params, "file");

  const entry = services.registry.getBySlugVersion(slug, version, { includeInvalid: false });
  if (!entry) {
    return jsonResponse(404, toErrorBody("plugin not found", { slug, version }));
  }

  try {
    const resolved = await resolvePluginFile(projectRoot, entry.meta, file);
    if (!resolved) {
      return jsonResponse(404, toErrorBody("plugin file not found", { slug, version, file }));
    }

    const minifiedContent = minifyByPath(resolved.url, resolved.content);
    return new Response(minifiedContent, {
      status: 200,
      headers: {
        "content-type": resolved.contentType
      }
    });
  } catch (error) {
    return jsonResponse(500, toErrorBody("plugin file resolution failed", error.message));
  }
}
