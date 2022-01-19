mod baiduhotsearch;
use std::collections::HashMap;
use xlrs_controller::{AsyncCalcResult, Task};

use crate::{message::CalcAsyncResult, server::BooksServer};

use super::message::CalcAsyncTask;
use actix::{Actor, Context, Handler, ResponseActFuture, Supervised, SystemService};
use actix_interop::{with_ctx, FutureInterop};
use futures::future::{join_all, BoxFuture};

macro_rules! registry_async_func {
    ($r: expr, $n: expr, $e: expr) => {
        $r.insert(String::from($n), Box::new($e) as Box<dyn AsyncCalcFn>)
    };
}

pub trait AsyncCalcFn {
    fn call(&self, args: Task) -> BoxFuture<'static, AsyncCalcResult>;
}

pub struct AsyncCalculator {
    registry: HashMap<String, Box<dyn AsyncCalcFn>>,
}

impl Actor for AsyncCalculator {
    type Context = Context<Self>;
}

impl Handler<CalcAsyncTask> for AsyncCalculator {
    type Result = ResponseActFuture<Self, ()>;

    fn handle(&mut self, msg: CalcAsyncTask, _: &mut Self::Context) -> Self::Result {
        log!("receive calc async task: {:?}", msg);
        async move {
            log!("executing asyn func");
            let results = with_ctx(|actor: &mut Self, _| {
                msg.tasks
                    .iter()
                    .map(|t| match actor.registry.get(&t.async_func) {
                        Some(func) => func.call(t.clone()),
                        None => todo!(),
                    })
                    .collect::<Vec<_>>()
            });
            let r = join_all(results).await;
            let r = CalcAsyncResult {
                tasks: msg.tasks,
                res: r,
                file_id: msg.file_id,
                dirtys: msg.dirtys,
            };
            BooksServer::from_registry().do_send(r);
        }
        .interop_actor_boxed(self)
    }
}

impl SystemService for AsyncCalculator {}
impl Supervised for AsyncCalculator {}

impl Default for AsyncCalculator {
    fn default() -> Self {
        let mut registry = HashMap::new();
        use baiduhotsearch::BaiduHotSearchFunc;
        registry_async_func!(registry, "BAIDUHOTSEARCH", BaiduHotSearchFunc {});
        AsyncCalculator { registry }
    }
}
