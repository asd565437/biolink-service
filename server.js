const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const { getDocs, collection, query, where, getFirestore } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");

const app = express();
const firestoreApp = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(firestoreApp);

app.use(cookieParser());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const roomData = {};  // 存储房间的问题 ID
const roomUsers = {}; // 存储房间的用户列表

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://biolink-service.onrender.com",
      "https://biolink-zsl3.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(204);
});

app.use("/api", routes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let users = {};

io.on("connection", (socket) => {
  console.log("Socket.IO 连接成功:", socket.id);

  // 用户注册到 Socket 服务器
  socket.on("register", (userId) => {
    users[userId] = socket.id;
    console.log(`用户 ${userId} 连接成功, socket ID: ${socket.id}`);
  });

  // 处理邀请
  socket.on("invite", ({ from, to }) => {
    if (users[to]) {
      const roomId = `room_${from}_${to}`;
      socket.join(roomId);
      io.to(users[to]).emit("invite", { from, roomId });
    }
  });

  // 处理接受邀请
  socket.on("accept-invite", ({ friendId, roomId, userId }) => {
    socket.join(roomId);

    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(socket.id);

    console.log(`用户 ${userId} 和 ${friendId} 加入房间 ${roomId}`);

    io.to(roomId).emit("joined-room", { users: [userId, friendId], roomId });
  });

  // 处理获取题目 ID
  socket.on("get-question-ids", (roomId) => {
    if (!roomData[roomId]) {
      const numbers = Array.from({ length: 251 }, (_, i) => i + 1);
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      roomData[roomId] = { question_ids: numbers.slice(0, 5) }; // 取前5个
      console.log(`房间 ${roomId} 生成新题目:`, roomData[roomId].question_ids);
    }

    socket.emit("question-ids", roomData[roomId].question_ids);
  });

  // 处理用户离开房间
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    if (roomUsers[roomId]) {
      roomUsers[roomId].delete(socket.id);
      console.log(`用户 ${socket.id} 退出房间 ${roomId}`);

      // 如果房间没人了，就删除数据
      if (roomUsers[roomId].size === 0) {
        delete roomData[roomId];
        delete roomUsers[roomId];
        console.log(`房间 ${roomId} 已空，删除数据`);
      }
    }
  });

  // 处理用户断开连接
  socket.on("disconnect", () => {
    console.log("用户断开连接:", socket.id);

    // 查找该用户在哪个房间，并移除
    for (const roomId in roomUsers) {
      if (roomUsers[roomId].has(socket.id)) {
        roomUsers[roomId].delete(socket.id);
        console.log(`用户 ${socket.id} 断开连接，退出房间 ${roomId}`);

        // 如果房间没人了，就删除数据
        if (roomUsers[roomId].size === 0) {
          delete roomData[roomId];
          delete roomUsers[roomId];
          console.log(`房间 ${roomId} 已空，删除数据`);
        }
        break;
      }
    }

    // 移除用户映射
    Object.keys(users).forEach((key) => {
      if (users[key] === socket.id) {
        delete users[key];
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
