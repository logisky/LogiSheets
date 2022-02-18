use std::collections::HashMap;

use crate::async_func_helper::AsyncCalculator;
use crate::message::{CalcAsyncResult, CalcAsyncTask};
use logisheets_protocols::{deserialize_client_message, serialize_server_message};
use logisheets_protocols::message::ServerSend;

use super::message::{ApplyEdit, FileId, JoinEdit, LeaveEdit, ServerMessage, UserId};
use super::room::{ClientResponse, Room};
use actix::{Actor, Context, Handler, MessageResult, Recipient, Supervised, SystemService};
use actix_broker::BrokerSubscribe;
use xlrs_controller::controller::edit_action::ActionEffect;
use xlrs_controller::controller::Controller;

#[derive(Default)]
pub struct BooksServer {
    rooms: HashMap<FileId, Room>,
}

impl BooksServer {
    fn take_room_members(
        &mut self,
        file_id: &FileId,
    ) -> Option<HashMap<UserId, Recipient<ServerMessage>>> {
        let room = self.rooms.get_mut(file_id)?;
        let users = std::mem::replace(&mut room.users, HashMap::new());
        Some(users)
    }

    fn send_room_message(&mut self, fid: &FileId, msg: ServerMessage) -> Option<()> {
        let mut users = self.take_room_members(fid)?;
        for (id, client) in users.drain() {
            if client.do_send(msg.clone()).is_ok() {
                self.add_client_to_room(fid.clone(), id, client);
            }
        }
        Some(())
    }

    fn send_user_message(&mut self, fid: &FileId, uid: &UserId, msg: ServerMessage) -> Option<()> {
        let room = self.rooms.get_mut(fid);
        match room {
            Some(r) => {
                if let Some(recipient) = r.users.get_mut(uid) {
                    if recipient.do_send(msg).is_ok() {
                        Some(())
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            None => None,
        }
    }

    fn add_client_to_room(
        &mut self,
        file_id: FileId,
        user_id: UserId,
        client: Recipient<ServerMessage>,
    ) {
        match self.rooms.get_mut(&file_id) {
            Some(room) => {
                room.users.insert(user_id, client);
            }
            None => {
                log!("going to new a room");
                let mut users = HashMap::new();
                users.insert(user_id, client);
                let room = Room {
                    wb: get_controller(),
                    users,
                    history: vec![],
                };
                log!("new room{:?}", &file_id);
                self.rooms.insert(file_id, room);
            }
        }
    }
}

fn get_controller() -> Controller {
    use std::{fs, path::Path};
    let path_str = "static/6.xlsx";
    let path = Path::new(path_str);
    let buf = fs::read(path).unwrap();
    let name = String::from("6");
    Controller::from_file(name, &buf).unwrap()
}

impl Actor for BooksServer {
    type Context = Context<Self>;
    fn started(&mut self, ctx: &mut Self::Context) {
        self.subscribe_system_async::<JoinEdit>(ctx);
        self.subscribe_system_async::<LeaveEdit>(ctx);
        self.subscribe_system_async::<ApplyEdit>(ctx);
    }
}

impl Handler<JoinEdit> for BooksServer {
    type Result = MessageResult<JoinEdit>;

    fn handle(&mut self, msg: JoinEdit, _ctx: &mut Self::Context) -> Self::Result {
        let JoinEdit {
            file_id,
            user_id,
            recipient,
        } = msg;
        let e = ActionEffect::default();
        let r = ServerSend::from_action_effect(e.sheets);
        let buf = serialize_server_message(r);
        let res = ServerMessage { content: buf };
        self.send_user_message(&file_id, &user_id, res);
        log!("connected user_id: {:?}, file_id: {:?}", &user_id, &file_id);
        self.add_client_to_room(file_id, user_id, recipient);
        MessageResult(())
    }
}

impl Handler<LeaveEdit> for BooksServer {
    type Result = ();

    fn handle(&mut self, msg: LeaveEdit, _ctx: &mut Self::Context) -> Self::Result {
        let LeaveEdit { file_id, user_id } = msg;
        if let Some(room) = self.rooms.get_mut(&file_id) {
            room.users.remove(&user_id);
        }
    }
}

impl Handler<ApplyEdit> for BooksServer {
    type Result = MessageResult<ApplyEdit>;

    fn handle(&mut self, msg: ApplyEdit, _ctx: &mut Self::Context) -> Self::Result {
        let ApplyEdit { content } = msg;
        if let Ok(client_send) = deserialize_client_message(content) {
            let file_id = client_send.file_id;
            let user = client_send.user;
            if let Some(room) = self.rooms.get_mut(&file_id) {
                if room.has_user(&user) {
                    if let Some(msg) = room.get_response(client_send.client_send_oneof.unwrap()) {
                        let r = match msg {
                            ClientResponse::Display(dr) => ServerSend::from_display_response(dr),
                            ClientResponse::ActionEffect(e) => {
                                let calc_tasks = CalcAsyncTask {
                                    file_id: file_id.clone(),
                                    tasks: e.async_tasks,
                                    dirtys: e.dirtys,
                                };
                                if calc_tasks.tasks.len() > 0 {
                                    AsyncCalculator::from_registry().do_send(calc_tasks);
                                }
                                ServerSend::from_action_effect(e.sheets)
                            }
                        };
                        let buf = serialize_server_message(r);
                        let res = ServerMessage { content: buf };
                        self.send_room_message(&file_id, res);
                    }
                }
            }
        }
        MessageResult(())
    }
}

impl Handler<CalcAsyncResult> for BooksServer {
    type Result = ();

    fn handle(&mut self, msg: CalcAsyncResult, ctx: &mut Self::Context) -> Self::Result {
        if let Some(room) = self.rooms.get_mut(&msg.file_id) {
            let affect = room
                .wb
                .handle_async_calc_results(msg.tasks, msg.res, msg.dirtys);
            if let Some(ae) = affect {
                let buf = serialize_server_message(ServerSend::from_action_effect(ae.sheets));
                let res = ServerMessage { content: buf };
                self.send_room_message(&msg.file_id, res);
            }
        }
    }
}

impl SystemService for BooksServer {}
impl Supervised for BooksServer {}
