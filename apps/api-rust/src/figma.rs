use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

lazy_static::lazy_static! {
    static ref CLIENT: Client = Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .unwrap();
}

#[allow(dead_code)]
pub async fn get_figma_nodes(
    file_key: &str,
    ids: &str,
    depth: Option<u8>,
    token: &str,
) -> Result<Value, String> {
    let mut url = if ids.is_empty() {
        format!("https://api.figma.com/v1/files/{}?geometry=none", file_key)
    } else {
        format!("https://api.figma.com/v1/files/{}/nodes?ids={}&geometry=none", file_key, ids)
    };

    if let Some(d) = depth {
        url.push_str(&format!("&depth={}", d));
    }

    for attempt in 1..=5 {
        let res = CLIENT
            .get(&url)
            .header("X-Figma-Token", token)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if res.status().as_u16() == 429 {
            tracing::warn!("Figma API 429 Rate limited. Waiting {}s before retry (attempt {}/5)...", attempt * 2, attempt);
            tokio::time::sleep(Duration::from_secs(attempt * 2)).await;
            continue;
        }

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            return Err(format!("Figma API Error {}: {}", status, text));
        }

        let json: Value = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        return Ok(json);
    }

    Err("Figma API Error: Exceeded retry limit for Rate Limit (429)".to_string())
}
