/// <reference types="svelte" />
/// <reference types="vite/client" />
// Worker imports with ?worker&url suffix
declare module "*?worker&url" {
  const url: string;
  export default url;
}

declare module "*?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
