const port = Number(process.env.PORT || 3333);
process.env.PORT = String(port);

const { startServer } = await import('./Backend/server.js');

await startServer(port, '0.0.0.0');
console.log(`[BOOT api.js] listening on PORT=${port}`);
