const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { randomBytes } = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const rooms = {};

function generateUniqueCode(length) {
  while (true) {
    const code = randomBytes(length).toString("hex").toUpperCase();
    if (!rooms[code]) {
      return code;
    }
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.post("/room", (req, res) => {
  const { name, code, join, create, public } = req.body;

  if (!name) {
    return res.status(400).send({ error: "Please enter a name." });
  }

  if (join && !code) {
    return res.status(400).send({ error: "Please enter a room code." });
  }

  let room = code;
  if (create) {
    room = generateUniqueCode(2);
    rooms[room] = { members: 0, messages: [], public: !!public, creator: name };
  } else if (!rooms[code]) {
    return res.status(400).send({ error: "Room does not exist." });
  }

  res.send({ room });
});

io.on("connection", (socket) => {
  socket.on("join", ({ room, name }) => {
    if (!rooms[room]) return;

    socket.join(room);
    rooms[room].members++;
    socket.to(room).emit("message", {
      name: "System",
      message: `${name} has entered the room.`,
    });
    socket.emit("previousMessages", rooms[room].messages);

    socket.on("message", (data) => {
      const message = { name, message: data.message };
      rooms[room].messages.push(message);
      io.to(room).emit("message", message);
    });

    socket.on("disconnect", () => {
      socket.to(room).emit("message", {
        name: "System",
        message: `${name} has left the room.`,
      });
      rooms[room].members--;
      if (rooms[room].members === 0) {
        delete rooms[room];
      }
    });
  });
});

server.listen(5001, () => {
  console.log("Server is running on http://localhost:5001");
});
