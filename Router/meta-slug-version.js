import { jsonResponse, toErrorBody } from "../Helper/http.js";
import { getPathParam, readBooleanQueryParam } from "./_utils.js";

export async function handleMetaBySlugVersion({ request, params, services }) {
  const slug = getPathParam(params, "slug");
  const version = getPathParam(params, "version");
  const includeInvalid = readBooleanQueryParam(request, "includeInvalid", false);
  const entry = services.registry.getBySlugVersion(slug, version, { includeInvalid });

  if (!entry) {
    return jsonResponse(404, toErrorBody("meta version not found", { slug, version }));
  }

  return jsonResponse(200, {
    ok: true,
    data: entry.meta
  });
}
