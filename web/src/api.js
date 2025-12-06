const BASE_URL = "http://localhost:8000";

export async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");

  const token = localStorage.getItem("idToken");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Convert body to JSON string if it's an object
  const body = typeof init.body === 'object' && init.body !== null
    ? JSON.stringify(init.body)
    : init.body;

  // Debug
  console.log("[apiFetch] ->", `${BASE_URL}${path}`, {
    method: init.method || "GET",
    headers: Object.fromEntries(headers.entries()),
    bodyPreview: body?.substring(0, 200),
  });

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    body
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("[apiFetch] <-", resp.status, text);
  }
  return resp;
}