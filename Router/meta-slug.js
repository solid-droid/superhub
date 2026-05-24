import { jsonResponse, toErrorBody } from "../Helper/http.js";
import { getPathParam, readBooleanQueryParam } from "./_utils.js";

export async function handleMetaBySlug({ request, params, services }) {
  const slug = getPathParam(params, "slug");
  const includeInvalid = readBooleanQueryParam(request, "includeInvalid", false);
  const entries = services.registry.getBySlug(slug, { includeInvalid });

  if (entries.length === 0) {
    return jsonResponse(404, toErrorBody("meta slug not found", { slug }));
  }

  return jsonResponse(200, {
    ok: true,
    slug,
    count: entries.length,
    data: entries.map((entry) => entry.meta)
  });
}
