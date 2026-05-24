import { jsonResponse } from "../Helper/http.js";

export async function handleVerifyLocalRegistry({ services }) {
  const summary = await services.registry.verifyLocalRegistry();

  return jsonResponse(200, {
    ok: true,
    message: "local registry verification complete",
    data: summary
  });
}
