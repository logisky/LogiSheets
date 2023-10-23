use async_trait::async_trait;
use ezsockets::{Error, SessionExt};
use ezsockets::{Server, ServerExt};

use std::collections::HashMap;

use super::room::RoomHandle;
use crate::{FileId, UserId, UserMessage};

type Session = ezsockets::Session<UserId, ()>;

struct SequencerServer {
    sessions: HashMap<UserId, Session>,
    rooms: HashMap<FileId, RoomHandle>,
    handle: Server<Self>,
}

#[async_trait]
impl ServerExt for SequencerServer {
    type Session = SessionActor;

    type Call = UserMessage;

    async fn on_connect(
        &mut self,
        _socket: ezsockets::Socket,
        _address: std::net::SocketAddr,
        _args: <Self::Session as SessionExt>::Args,
    ) -> Result<
        ezsockets::Session<<Self::Session as SessionExt>::ID, <Self::Session as SessionExt>::Call>,
        Error,
    > {
        todo!()
    }

    async fn on_disconnect(&mut self, _id: <Self::Session as SessionExt>::ID) -> Result<(), Error> {
        todo!()
    }

    async fn on_call(&mut self, _call: Self::Call) -> Result<(), Error> {
        todo!()
    }
}

struct SessionActor {
    id: UserId,
    server: Server<SequencerServer>,
    session: Session,
    room: FileId,
}

#[async_trait]
impl SessionExt for SessionActor {
    type ID = UserId;

    type Args = ();

    type Call = ();

    fn id(&self) -> &Self::ID {
        todo!()
    }

    async fn on_text(&mut self, _text: String) -> Result<(), Error> {
        todo!()
    }

    async fn on_binary(&mut self, _bytes: Vec<u8>) -> Result<(), Error> {
        todo!()
    }

    async fn on_call(&mut self, _call: Self::Call) -> Result<(), Error> {
        todo!()
    }
}
