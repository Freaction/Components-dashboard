use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

#[tokio::main]
async fn main() {
    let token = std::env::var("FIGMA_TOKEN").expect("FIGMA_TOKEN must be set");
    let file_key = "MwBOfUhxj9YqwrvMa0DmJh";
    
    let client = Client::builder().timeout(Duration::from_secs(30)).build().unwrap();
    let url = format!("https://api.figma.com/v1/files/{}/variables/local", file_key);
    
    println!("Testing fetch local variables for file {}...", file_key);
    
    let res = client.get(&url).header("X-Figma-Token", token).send().await.unwrap();
    if res.status().is_success() {
        let data: Value = res.json().await.unwrap();
        if let Some(meta) = data.get("meta") {
            if let Some(variables) = meta.get("variables").and_then(|v| v.as_object()) {
                println!("Successfully fetched {} local variables!", variables.len());
                for (id, var) in variables.iter().take(3) {
                    println!(" - {} ({})", var.get("name").and_then(|n| n.as_str()).unwrap_or("?"), id);
                }
            } else {
                println!("No 'variables' array inside 'meta'.");
            }
        } else {
            println!("No 'meta' object returned.");
        }
    } else {
        println!("Error: {}", res.status());
    }
}
