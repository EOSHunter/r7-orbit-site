// `npm run cms`: the Decap local proxy that /admin talks to under `npm run dev`. It reads and writes the files in this
// repository. decap-server listens on every network interface unless told otherwise, so pin it to this machine.
process.env.BIND_HOST ??= '127.0.0.1';
await import('decap-server');
