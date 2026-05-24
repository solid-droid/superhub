import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_TYPE_BY_EXT = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function resolveTemplate(str, meta) {
  return String(str || "").replaceAll("${baseURL}", meta.baseURL || "");
}

function toFsPath(projectRoot, relativeOrAbsolute) {
  const normalizedRelative = String(relativeOrAbsolute || "").replaceAll("\\", "/");
  const absolute = path.resolve(projectRoot, normalizedRelative);
  const root = path.resolve(projectRoot);

  if (!absolute.startsWith(root)) {
    throw new Error("path traversal rejected");
  }

  return absolute;
}

function toPublicPath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).replaceAll("\\", "/");
}

function contentTypeFor(filePath) {
  return CONTENT_TYPE_BY_EXT[path.extname(filePath).toLowerCase()] || "text/plain; charset=utf-8";
}

export async function resolvePluginBundle(projectRoot, meta) {
  const files = Array.isArray(meta.files) ? meta.files : [];

  const resolvedFiles = [];
  for (const fileRef of files) {
    const logicalPath = resolveTemplate(fileRef.url, meta);
    const fsPath = toFsPath(projectRoot, logicalPath);
    const content = await readFile(fsPath, "utf-8");

    resolvedFiles.push({
      url: logicalPath,
      entry: Boolean(fileRef.entry),
      contentType: contentTypeFor(fsPath),
      content
    });
  }

  return {
    meta,
    files: resolvedFiles
  };
}

export async function resolvePluginFile(projectRoot, meta, fileName) {
  const files = Array.isArray(meta.files) ? meta.files : [];
  const lowerRequested = String(fileName || "").toLowerCase();

  const matched = files.find((fileRef) => {
    const logicalPath = resolveTemplate(fileRef.url, meta);
    return logicalPath.toLowerCase().endsWith(`/${lowerRequested}`) || logicalPath.toLowerCase().endsWith(lowerRequested);
  });

  if (!matched) {
    return null;
  }

  const logicalPath = resolveTemplate(matched.url, meta);
  const fsPath = toFsPath(projectRoot, logicalPath);
  const content = await readFile(fsPath, "utf-8");

  return {
    url: toPublicPath(projectRoot, fsPath),
    contentType: contentTypeFor(fsPath),
    content
  };
}
