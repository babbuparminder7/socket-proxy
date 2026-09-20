const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const UPSTREAM_URL = process.env.UPSTREAM_URL;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket proxy is running");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (client) => {
  console.log("CLIENT CONNECTED");

  if (!UPSTREAM_URL) {
    console.error("UPSTREAM_URL missing");
    client.close(1011, "UPSTREAM_URL missing");
    return;
  }

  const upstream = new WebSocket(UPSTREAM_URL);

  // Store messages that arrive before upstream connects
  const queue = [];

  upstream.on("open", () => {
    console.log("UPSTREAM CONNECTED");

    // Send queued messages
    while (queue.length > 0) {
      const msg = queue.shift();

      console.log("QUEUED CLIENT → UPSTREAM:", msg.toString());

      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(msg);
      }
    }
  });

  client.on("message", (data) => {
    console.log("CLIENT → PROXY:", data.toString());

    if (upstream.readyState === WebSocket.OPEN) {
      console.log("PROXY → UPSTREAM:", data.toString());
      upstream.send(data);
    } else {
      console.log("UPSTREAM NOT READY — QUEUING MESSAGE");
      queue.push(data);
    }
  });

  upstream.on("message", (data) => {
    console.log("UPSTREAM → PROXY:", data.toString());

    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      console.log("PROXY → CLIENT:", data.toString());
    }
  });

  upstream.on("error", (err) => {
    console.error("UPSTREAM ERROR:", err.message);
  });

  upstream.on("close", (code, reason) => {
    console.log(
      "UPSTREAM CLOSED:",
      code,
      reason.toString()
    );

    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  client.on("close", (code, reason) => {
    console.log(
      "CLIENT CLOSED:",
      code,
      reason.toString()
    );

    if (
      upstream.readyState === WebSocket.OPEN ||
      upstream.readyState === WebSocket.CONNECTING
    ) {
      upstream.close();
    }
  });

  client.on("error", (err) => {
    console.error("CLIENT ERROR:", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
