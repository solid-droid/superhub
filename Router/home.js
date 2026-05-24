import { readFile } from "node:fs/promises";
import path from "node:path";

const homeDir = path.resolve(import.meta.dir, "..", "Home");
const htmlPath = path.join(homeDir, "index.html");
const cssPath = path.join(homeDir, "home.css");
const jsPath = path.join(homeDir, "home.js");

function fallbackPage(message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SuperHub</title>
</head>
<body>
  <h1>SuperHub is running</h1>
  <p>Home assets failed to load.</p>
  <pre>${message}</pre>
</body>
</html>`;
}

export async function handleHome() {
  try {
    const [template, css, js] = await Promise.all([
      readFile(htmlPath, "utf-8"),
      readFile(cssPath, "utf-8"),
      readFile(jsPath, "utf-8")
    ]);

    const html = template
      .replace("__HOME_CSS__", css)
      .replace("__HOME_JS__", js);

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  } catch (error) {
    return new Response(fallbackPage(error.message), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  }
}
