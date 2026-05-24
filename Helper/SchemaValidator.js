const REQUIRED_COMMON_FIELDS = ["name", "version", "slug"];

export function validateMetaShape(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return { valid: false, errors: ["body must be a JSON object"] };
  }

  const errors = [];
  for (const field of REQUIRED_COMMON_FIELDS) {
    if (!meta[field] || typeof meta[field] !== "string") {
      errors.push(`missing or invalid field: ${field}`);
    }
  }

  const hasFiles = Array.isArray(meta.files);
  const hasExports = meta.exports && typeof meta.exports === "object";
  if (!hasFiles && !hasExports) {
    errors.push("metadata must contain either files[] or exports object");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateRouteIdentity(meta, slug, version) {
  const errors = [];
  if (meta.slug !== slug) {
    errors.push("body.slug must match route slug");
  }
  if (meta.version !== version) {
    errors.push("body.version must match route version");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
