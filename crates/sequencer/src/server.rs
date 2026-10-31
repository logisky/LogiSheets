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
        _request: ezsockets::Request,
        _address: std::net::SocketAddr,
    ) -> Result<
        ezsockets::Session<<Self::Session as SessionExt>::ID, <Self::Session as SessionExt>::Call>,
        Option<ezsockets::CloseFrame>,
    > {
        todo!()
    }

    async fn on_disconnect(
        &mut self,
        _id: <Self::Session as SessionExt>::ID,
        _reason: Result<Option<ezsockets::CloseFrame>, Error>,
    ) -> Result<(), Error> {
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

    type Call = ();

    fn id(&self) -> &Self::ID {
        todo!()
    }

    async fn on_text(&mut self, _text: ezsockets::Utf8Bytes) -> Result<(), Error> {
        todo!()
    }

    async fn on_binary(&mut self, _bytes: ezsockets::Bytes) -> Result<(), Error> {
        todo!()
    }

    async fn on_call(&mut self, _call: Self::Call) -> Result<(), Error> {
        todo!()
    }
}
