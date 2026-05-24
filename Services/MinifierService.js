function minifyJs(input) {
  const noBlockComments = input.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLineComments = noBlockComments.replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  return noLineComments
    .replace(/\s+/g, " ")
    .replace(/\s*([{}();,:+\-*/=<>&|\[\]])\s*/g, "$1")
    .trim();
}

function minifyCss(input) {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function minifyHtml(input) {
  return input
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}

function detectTypeFromPath(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) {
    return "js";
  }
  if (lower.endsWith(".css")) {
    return "css";
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "html";
  }
  return "raw";
}

export function minifyByPath(filePath, content) {
  const type = detectTypeFromPath(filePath);
  if (type === "js") {
    return minifyJs(content);
  }
  if (type === "css") {
    return minifyCss(content);
  }
  if (type === "html") {
    return minifyHtml(content);
  }
  return content;
}

export function minifyBundle(bundle) {
  return {
    ...bundle,
    files: bundle.files.map((file) => ({
      ...file,
      content: minifyByPath(file.url, file.content)
    }))
  };
}
