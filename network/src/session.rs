use std::time::{Duration, Instant};

use actix::{Actor, ActorContext, AsyncContext, Handler, StreamHandler, SystemService};
use actix_web_actors::ws;

use crate::{
    message::{ApplyEdit, JoinEdit, ServerMessage, UserId},
    server::BooksServer,
};

type FileId = String;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

pub struct EditSession {
    file_id: FileId,
    user_id: UserId,
    last_hb: Instant,
}

impl EditSession {
    pub fn new() -> Self {
        EditSession {
            file_id: "".to_string(),
            user_id: "".to_string(),
            last_hb: Instant::now(),
        }
    }

    fn heart_beat(&self, ctx: &mut <Self as Actor>::Context) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.last_hb) > CLIENT_TIMEOUT {
                // ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for EditSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.heart_beat(ctx);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for EditSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        let msg = match msg {
            Ok(m) => m,
            Err(_) => {
                ctx.stop();
                return;
            }
        };
        match msg {
            ws::Message::Binary(b) => {
                log!("Get binary message");
                let msg = ApplyEdit::from_bytes(b);
                BooksServer::from_registry().do_send(msg);
            }
            ws::Message::Text(text) => {
                log!("reciveve text: {:?}", &text);
                let join = JoinEdit::from_text(&text, ctx.address().recipient());
                if let Some(j) = join {
                    BooksServer::from_registry().do_send(j);
                    return;
                }
                let edit = ApplyEdit::from_text(text);
                if let Some(msg) = edit {
                    log!("{:?}", &msg);
                    BooksServer::from_registry().do_send(msg);
                }
            }
            ws::Message::Ping(msg) => {
                self.last_hb = Instant::now();
                ctx.pong(&msg);
            }
            ws::Message::Pong(_) => {
                self.last_hb = Instant::now();
            }
            ws::Message::Close(reason) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

impl Handler<ServerMessage> for EditSession {
    type Result = ();

    fn handle(&mut self, msg: ServerMessage, ctx: &mut Self::Context) -> Self::Result {
        ctx.binary(msg.content);
    }
}
