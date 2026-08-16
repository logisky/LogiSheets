// Native HTTP for the frontend.
//
// The webview's own `fetch` is a browser fetch: it enforces the same-origin
// policy, so calling an LLM provider that doesn't return CORS headers (e.g.
// Kimi / Moonshot) is blocked. This command runs the request from Rust
// (`reqwest`), which is not a browser and has no CORS notion, so the desktop app
// can reach those providers directly — no external proxy needed.
//
// It's a generic request/response passthrough (not LLM-specific): the frontend
// hands it a URL + method + headers + body and gets back the status, headers,
// and body text, which the frontend adapts into a standard `Response`. Watson's
// `AnthropicBrowserClient` then treats it exactly like `window.fetch`.
//
// Following the desktop package's convention (see storage.rs / craft-storage),
// this is a plain app command reached via `window.__TAURI_INTERNALS__.invoke`,
// so the frontend needs no `@tauri-apps/*` npm dependency. App-defined commands
// are not permission-gated in Tauri v2, so no capability entry is required.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub url: String,
    pub method: String,
    /// Request headers as a flat map (the only shape the frontend sends).
    pub headers: HashMap<String, String>,
    /// Raw request body (JSON string for our use); `None` for bodyless verbs.
    pub body: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

/// Perform an HTTP request natively and return the whole response.
///
/// Errors (bad URL, DNS, TLS, connection reset, ...) come back as `Err(String)`,
/// which the frontend surfaces as a network error and retries — mirroring how a
/// failed `window.fetch` rejects. A non-2xx HTTP status is NOT an error here: it
/// is returned as a normal `HttpResponse` so the caller can read the provider's
/// error body, exactly as the browser client does.
#[tauri::command]
pub async fn llm_fetch(req: HttpRequest) -> Result<HttpResponse, String> {
    // Only http(s); never let the frontend reach file:// or other schemes.
    let is_http = req.url.starts_with("https://") || req.url.starts_with("http://");
    if !is_http {
        return Err(format!("unsupported URL scheme: {}", req.url));
    }

    let method = reqwest::Method::from_bytes(req.method.as_bytes())
        .map_err(|e| format!("invalid HTTP method '{}': {e}", req.method))?;

    let client = reqwest::Client::new();
    let mut builder = client.request(method, &req.url);
    for (name, value) in &req.headers {
        builder = builder.header(name, value);
    }
    if let Some(body) = req.body {
        builder = builder.body(body);
    }

    let resp = builder
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = resp.status().as_u16();
    let mut headers = HashMap::new();
    for (name, value) in resp.headers() {
        if let Ok(v) = value.to_str() {
            headers.insert(name.as_str().to_string(), v.to_string());
        }
    }
    let body = resp
        .text()
        .await
        .map_err(|e| format!("failed to read response body: {e}"))?;

    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}
