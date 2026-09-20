const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const UPSTREAM = process.env.UPSTREAM_URL;

if (!UPSTREAM) {
    console.error("UPSTREAM_URL is not set");
    process.exit(1);
}

const httpServer = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain"
    });

    res.end("WebSocket proxy running");
});

const wss = new WebSocket.Server({
    server: httpServer
});

wss.on("connection", (client) => {
    console.log("Client connected");

    const upstream = new WebSocket(UPSTREAM);

    upstream.on("open", () => {
        console.log("Upstream connected");
    });

    client.on("message", (data, isBinary) => {
        console.log("CLIENT -> UPSTREAM");

        if (upstream.readyState === WebSocket.OPEN) {
            upstream.send(data, { binary: isBinary });
        }
    });

    upstream.on("message", (data, isBinary) => {
        console.log("UPSTREAM -> CLIENT");

        if (client.readyState === WebSocket.OPEN) {
            client.send(data, { binary: isBinary });
        }
    });

    client.on("close", () => {
        console.log("Client closed");

        if (
            upstream.readyState === WebSocket.OPEN ||
            upstream.readyState === WebSocket.CONNECTING
        ) {
            upstream.close();
        }
    });

    upstream.on("close", () => {
        console.log("Upstream closed");

        if (client.readyState === WebSocket.OPEN) {
            client.close();
        }
    });

    client.on("error", err => {
        console.error("Client error:", err.message);
    });

    upstream.on("error", err => {
        console.error("Upstream error:", err.message);
    });
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Listening on port ${PORT}`);
});
