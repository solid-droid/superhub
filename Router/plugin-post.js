import { jsonResponse, parseJsonBody, toErrorBody } from "../Helper/http.js";
import { validateMetaShape, validateRouteIdentity } from "../Helper/SchemaValidator.js";
import { getPathParam } from "./_utils.js";

export async function handlePluginPost({ request, params, services }) {
  const slug = getPathParam(params, "slug");
  const version = getPathParam(params, "version");

  let body;
  try {
    body = await parseJsonBody(request);
  } catch (error) {
    return jsonResponse(400, toErrorBody("invalid JSON body", error.message));
  }

  if (!body) {
    return jsonResponse(400, toErrorBody("body is required", "send content-type application/json"));
  }

  const shapeValidation = validateMetaShape(body);
  if (!shapeValidation.valid) {
    return jsonResponse(400, toErrorBody("meta validation failed", shapeValidation.errors));
  }

  const identityValidation = validateRouteIdentity(body, slug, version);
  if (!identityValidation.valid) {
    return jsonResponse(400, toErrorBody("route identity validation failed", identityValidation.errors));
  }

  if (services.registry.hasEntry(slug, version)) {
    return jsonResponse(409, toErrorBody("plugin already exists", { slug, version }));
  }

  services.registry.upsertMeta({
    meta: body,
    sourceType: "posted",
    sourcePath: null,
    lastVerifiedAt: new Date().toISOString()
  });

  return jsonResponse(201, {
    ok: true,
    message: "plugin registered",
    data: {
      slug,
      version
    }
  });
}
