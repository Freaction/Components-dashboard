use std::collections::HashSet;
use std::sync::Mutex;

lazy_static::lazy_static! {
    pub static ref RUNNING_SESSIONS: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
    pub static ref PAUSE_REQUESTS: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
}

pub fn request_pause(session_id: String) {
    if let Ok(mut pause) = PAUSE_REQUESTS.lock() {
        pause.insert(session_id);
    }
}
