use crate::{Edit, Join, SequencerInitWorkbook, SequencerMessage, UserId, UserMessage};
use tokio::sync::mpsc::{self, Receiver, Sender};
use tokio::sync::RwLock;

use logisheets_controller::Controller;
use logisheets_controller::Error;

pub struct RoomHandle {
    users: Vec<UserId>,
    sender: Sender<UserMessage>,
    receiver: Receiver<SequencerMessage>,
}

pub struct RoomServer {
    ctrl: RwLock<Controller>,
    actions: Vec<Edit>,
    sender: Sender<SequencerMessage>,
    receiver: Receiver<UserMessage>,
}

impl RoomServer {
    pub async fn handle_msg(mut self) {
        loop {
            if let Some(msg) = self.receiver.recv().await {
                match msg {
                    UserMessage::Join(m) => {
                        let ctrl = self.ctrl.read().await;
                        let resp = SequencerMessage::Join(SequencerInitWorkbook {
                            version: ctrl.version(),
                            file_id: m.file,
                            data: Some(ctrl.save(vec![]).unwrap()),
                        });
                        self.sender.send(resp).await.unwrap();
                    }
                    UserMessage::Edit(_) => {
                        todo!()
                    }
                }
            }
        }
    }
}

fn new_workbook_room(msg: Join) -> Result<RoomHandle, Error> {
    let ctrl = if let Some(f) = msg.wb_file {
        Controller::from_file(f.name, &f.data)
    } else {
        Ok(Controller::default())
    }?;

    let (user_sender, server_receiver) = mpsc::channel::<UserMessage>(32);
    let (server_sender, user_receiver) = mpsc::channel::<SequencerMessage>(32);
    let handle = RoomHandle {
        users: vec![msg.user],
        sender: user_sender,
        receiver: user_receiver,
    };
    let rs = RoomServer {
        ctrl: RwLock::new(ctrl),
        actions: vec![],
        sender: server_sender,
        receiver: server_receiver,
    };

    start_room_server(rs);

    Ok(handle)
}

fn start_room_server(rs: RoomServer) {
    tokio::spawn(async move { rs.handle_msg() });
}
