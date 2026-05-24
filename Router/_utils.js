import { parseJsonBody } from "../Helper/http.js";

export function getPathParam(params, key) {
  return decodeURIComponent(params[key] || "");
}

export function readBooleanQueryParam(request, name, defaultValue = false) {
  const url = new URL(request.url);
  const value = url.searchParams.get(name);
  if (value == null) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function readMetaQueryPayload(request) {
  const url = new URL(request.url);
  const fromQuery = {
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("pageSize")
  };

  const filterText = url.searchParams.get("filter");
  if (filterText) {
    fromQuery.filter = JSON.parse(filterText);
  }

  const sortText = url.searchParams.get("sort");
  if (sortText) {
    fromQuery.sort = JSON.parse(sortText);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return fromQuery;
  }

  return {
    ...fromQuery,
    ...body
  };
}
