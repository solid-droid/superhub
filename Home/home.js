(() => {
  const API_LIST = [
    "GET /meta",
    "GET /meta/:slug",
    "GET /meta/:slug/:version",
    "GET /summary",
    "GET /verify/local-registry",
    "GET /plugin/:slug/:version",
    "GET /plugin/:slug/:version/:file",
    "GET /plugin-full/:slug/:version",
    "GET /plugin-full/:slug/:version/:file",
    "POST /plugin/:slug/:version"
  ];

  const state = {
    items: [],
    view: []
  };

  const searchEl = document.getElementById("search");
  const kindEl = document.getElementById("kind-filter");
  const sortEl = document.getElementById("sort-by");
  const rowsEl = document.getElementById("meta-rows");
  const statusEl = document.getElementById("status");
  const apiListEl = document.getElementById("api-list");

  function parseKind(slug) {
    const raw = String(slug || "");
    const ix = raw.indexOf(">");
    return ix === -1 ? "unknown" : raw.slice(0, ix).toLowerCase();
  }

  function sortItems(items, mode) {
    const sorted = [...items];
    const [field, dir] = String(mode || "name-asc").split("-");

    const getVal = (item) => {
      if (field === "name") {
        return String(item.name || "").toLowerCase();
      }
      if (field === "slug") {
        return String(item.slug || "").toLowerCase();
      }
      if (field === "version") {
        return String(item.version || "").toLowerCase();
      }
      return "";
    };

    sorted.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) {
        return dir === "desc" ? 1 : -1;
      }
      if (av > bv) {
        return dir === "desc" ? -1 : 1;
      }
      return 0;
    });

    return sorted;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderApiList() {
    apiListEl.innerHTML = API_LIST
      .map((line) => `<li><code>${escapeHtml(line)}</code></li>`)
      .join("");
  }

  function renderRows() {
    rowsEl.innerHTML = state.view
      .map((item) => {
        const name = escapeHtml(item.name || "-");
        const slug = escapeHtml(item.slug || "-");
        const version = escapeHtml(item.version || "-");
        const description = escapeHtml(item.description || "-");

        return `<tr><td>${name}</td><td>${slug}</td><td>${version}</td><td>${description}</td></tr>`;
      })
      .join("");

    statusEl.textContent = `Showing ${state.view.length} result(s)`;
  }

  function applyFilters() {
    const term = String(searchEl.value || "").trim().toLowerCase();
    const kind = String(kindEl.value || "all").toLowerCase();
    const sort = String(sortEl.value || "name-asc");

    let filtered = state.items.filter((item) => {
      const text = `${item.name || ""} ${item.slug || ""} ${item.description || ""}`.toLowerCase();
      const searchMatch = !term || text.includes(term);
      const kindMatch = kind === "all" || parseKind(item.slug) === kind;
      return searchMatch && kindMatch;
    });

    filtered = sortItems(filtered, sort);
    state.view = filtered;
    renderRows();
  }

  async function loadMeta() {
    statusEl.textContent = "Loading metadata...";

    try {
      const response = await fetch("/meta");
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      state.items = Array.isArray(payload.data) ? payload.data : [];
      applyFilters();
    } catch (error) {
      statusEl.textContent = `Failed to load metadata: ${error.message}`;
      rowsEl.innerHTML = "";
    }
  }

  searchEl.addEventListener("input", applyFilters);
  kindEl.addEventListener("change", applyFilters);
  sortEl.addEventListener("change", applyFilters);

  renderApiList();
  loadMeta();
})();
