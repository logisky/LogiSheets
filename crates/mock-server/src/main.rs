use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use logisheets_server_types::{CraftData, CraftDescriptor, Resp};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tower_http::cors::{Any, CorsLayer};

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
    ) -> Json<Resp<CraftDescriptor>> {
        let map = state.descriptors.lock().unwrap();
        match map.get(&id) {
            Some(descriptor) => Json(Resp {
                data: Some(descriptor.clone()),
                status_code: 200,
                message: None,
            }),
            None => Json(Resp {
                data: None,
                status_code: 404,
                message: Some("Not Found".to_string()),
            }),
        }
    }

    async fn post_descriptor(
        State(state): State<AppState>,
        Path(id): Path<String>,
        Json(payload): Json<CraftDescriptor>,
    ) -> Json<Resp<u8>> {
        let mut map = state.descriptors.lock().unwrap();
        map.insert(id, payload);
        Json(Resp {
            data: None,
            status_code: 200,
            message: None,
        })
    }

    async fn get_data(
        State(state): State<AppState>,
        Path(id): Path<String>,
    ) -> Json<Resp<CraftData>> {
        let map = state.data.lock().unwrap();
        match map.get(&id) {
            Some(data) => Json(Resp {
                data: Some(data.clone()),
                status_code: 200,
                message: None,
            }),
            None => Json(Resp {
                data: None,
                status_code: 404,
                message: Some("Not Found".to_string()),
            }),
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

    async fn get_id(State(state): State<AppState>) -> Json<Resp<String>> {
        let mut id = state.current_id.lock().unwrap();
        *id += 1;
        Json(Resp {
            data: Some(id.to_string()),
            status_code: 200,
            message: None,
        })
    }

    let cors = CorsLayer::new()
        .allow_origin(["http://localhost:4200".parse().unwrap()])
        .allow_headers(Any)
        .allow_methods(Any);

    let app = Router::new()
        .route("/", get(|| async { "A mock server for LogiSheets!" }))
        .route("/id", get(get_id))
        .route(
            "/descriptor/{id}",
            get(get_descriptor).post(post_descriptor),
        )
        .route("/data/{id}", get(get_data).post(post_data))
        .with_state(state)
        .layer(cors);
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
