import { jsonResponse } from "../Helper/http.js";

function normalizeTypeLabel(pluginType) {
  const map = {
    widget: "Widgets",
    theme: "Themes",
    service: "Services",
    app: "Apps"
  };

  return map[String(pluginType || "").toLowerCase()] || null;
}

export async function handleSummary({ services }) {
  const entries = services.registry.listMeta({ includeInvalid: false });

  const summary = {
    Widgets: { count: 0, families: [] },
    Themes: { count: 0, families: [] },
    Services: { count: 0, families: [] },
    Apps: { count: 0, families: [] }
  };

  for (const entry of entries) {
    const label = normalizeTypeLabel(entry.pluginType || entry.meta?.slug?.split(">")[0]);
    if (!label) {
      continue;
    }

    summary[label].count += 1;
    if (entry.family && !summary[label].families.includes(entry.family)) {
      summary[label].families.push(entry.family);
    }
  }

  return jsonResponse(200, {
    ok: true,
    data: summary
  });
}
