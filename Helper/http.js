export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export async function parseJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  const text = await request.text();
  if (!text || !text.trim()) {
    return null;
  }

  return JSON.parse(text);
}

export function toErrorBody(message, details) {
  if (!details) {
    return { ok: false, error: message };
  }
  return { ok: false, error: message, details };
}
