use lazy_static::lazy_static;
use rustc_hash::FxHashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const TTL: Duration = Duration::from_secs(300);
const CAPACITY: usize = 64;

lazy_static! {
    static ref ENTRIES: Mutex<FxHashMap<String, (Instant, serde_json::Value)>> =
        Mutex::new(FxHashMap::default());
}

pub fn get(key: &str) -> Option<serde_json::Value> {
    let mut entries = ENTRIES.lock().ok()?;
    let (stored_at, value) = entries.get(key)?;

    if stored_at.elapsed() > TTL {
        entries.remove(key);
        return None;
    }

    Some(value.clone())
}

pub fn put(key: String, value: serde_json::Value) {
    let Ok(mut entries) = ENTRIES.lock() else {
        return;
    };

    if entries.len() >= CAPACITY {
        entries.retain(|_, (stored_at, _)| stored_at.elapsed() <= TTL);
    }

    if entries.len() >= CAPACITY {
        entries.clear();
    }

    entries.insert(key, (Instant::now(), value));
}
