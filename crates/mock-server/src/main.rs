use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use logisheets_server_types::{CraftData, CraftDescriptor};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
};

#[derive(Debug, Clone)]
pub struct AppState {
    pub descriptors: Arc<Mutex<HashMap<String, CraftDescriptor>>>,
    pub data: Arc<Mutex<HashMap<String, CraftData>>>,
    pub current_id: Arc<Mutex<usize>>,
}

#[tokio::main]
async fn main() {
    let state = AppState {
        descriptors: Arc::new(Mutex::new(HashMap::new())),
        data: Arc::new(Mutex::new(HashMap::new())),
        current_id: Arc::new(Mutex::new(0)),
    };

    async fn get_descriptor(
        State(state): State<AppState>,
        Path(id): Path<String>,
    ) -> Result<Json<CraftDescriptor>, StatusCode> {
        let map = state.descriptors.lock().unwrap();
        match map.get(&id) {
            Some(descriptor) => Ok(Json(descriptor.clone())),
            None => Err(StatusCode::NOT_FOUND),
        }
    }
    async fn post_descriptor(
        State(state): State<AppState>,
        Path(id): Path<String>,
        Json(payload): Json<CraftDescriptor>,
    ) -> StatusCode {
        let mut map = state.descriptors.lock().unwrap();
        map.insert(id, payload);
        StatusCode::OK
    }
    async fn get_data(
        State(state): State<AppState>,
        Path(id): Path<String>,
    ) -> Result<Json<CraftData>, StatusCode> {
        let map = state.data.lock().unwrap();
        match map.get(&id) {
            Some(data) => Ok(Json(data.clone())),
            None => Err(StatusCode::NOT_FOUND),
        }
    }
    async fn post_data(
        State(state): State<AppState>,
        Path(id): Path<String>,
        Json(payload): Json<CraftData>,
    ) -> StatusCode {
        let mut map = state.data.lock().unwrap();
        map.insert(id, payload);
        StatusCode::OK
    }

    async fn get_id(State(state): State<AppState>) -> Result<Json<usize>, StatusCode> {
        let mut id = state.current_id.lock().unwrap();
        *id += 1;
        Ok(Json(*id))
    }

    let app = Router::new()
        .route("/", get(|| async { "A mock server for LogiSheets!" }))
        .route("/id", get(get_id))
        .route("/descriptor/:id", get(get_descriptor).post(post_descriptor))
        .route("/data/:id", get(get_data).post(post_data))
        .with_state(state);
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
