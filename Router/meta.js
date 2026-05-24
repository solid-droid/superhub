import { applyMetaQuery } from "../Services/QueryService.js";
import { jsonResponse, toErrorBody } from "../Helper/http.js";
import { readBooleanQueryParam, readMetaQueryPayload } from "./_utils.js";

export async function handleMetaList({ request, services }) {
  try {
    const includeInvalid = readBooleanQueryParam(request, "includeInvalid", false);
    const payload = await readMetaQueryPayload(request);
    const items = services.registry.listMeta({ includeInvalid });
    const result = applyMetaQuery(items, payload);

    return jsonResponse(200, {
      ok: true,
      ...result,
      data: result.data.map((entry) => entry.meta)
    });
  } catch (error) {
    return jsonResponse(400, toErrorBody("invalid meta query", error.message));
  }
}
