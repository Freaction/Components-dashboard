use serde_json::Value;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct PageRequest {
    pub id: String,
    pub name: String,
}

pub struct PrefetchedPage {
    pub request: PageRequest,
    pub result: Result<Value, String>,
}

pub struct PagePrefetch {
    receiver: mpsc::Receiver<PrefetchedPage>,
    advance: Arc<Semaphore>,
}

impl PagePrefetch {
    pub async fn recv(&mut self) -> Option<PrefetchedPage> {
        let page = self.receiver.recv().await?;
        self.advance.add_permits(1);
        Some(page)
    }
}

pub fn start(file_key: String, token: String, pages: Vec<PageRequest>) -> PagePrefetch {
    let (sender, receiver) = mpsc::channel(1);
    let advance = Arc::new(Semaphore::new(0));
    let producer_advance = advance.clone();
    tokio::spawn(async move {
        for (index, request) in pages.into_iter().enumerate() {
            if index > 0 {
                let Ok(permit) = producer_advance.acquire().await else {
                    break;
                };
                permit.forget();
            }
            tracing::info!("[Scanner] Fetching page: {}", request.name);
            let started = std::time::Instant::now();
            let result = crate::figma::get_figma_nodes(&file_key, &request.id, None, &token).await;
            if result.is_ok() {
                tracing::info!(
                    "[Scanner] Downloaded page '{}' in {:.2?}",
                    request.name,
                    started.elapsed()
                );
            }
            if sender
                .send(PrefetchedPage { request, result })
                .await
                .is_err()
            {
                break;
            }
        }
    });
    PagePrefetch { receiver, advance }
}
