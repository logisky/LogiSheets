#[macro_use]
extern crate logiutils;
#[macro_use]
extern crate lazy_static;
extern crate regex;
use actix_files::Files;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use actix_web_actors::ws;
use log::info;
use session::EditSession;
mod async_func_helper;
mod message;
mod room;
mod server;
mod session;
mod text_dsl;

async fn chat_route(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    ws::start(EditSession::new(), &req, stream)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let addr = "0.0.0.0:8081";

    let srv = HttpServer::new(move || {
        App::new()
            .service(web::resource("/ws/").to(chat_route))
            .service(Files::new("/", "./static/").index_file("index.html"))
    })
    .bind(&addr)?;

    info!("Starting http server: {}", &addr);

    srv.run().await
}
