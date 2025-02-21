const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const { getDocs, collection, query, where, getFirestore } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");
const crypto = require("crypto");

const app = express();
const firestoreApp = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(firestoreApp);


function generateRandomQuestions() {
  const numbers = Array.from({ length: 251 }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1); // 使用 crypto.randomInt() 代替 Math.random()
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers.slice(0, 5); // 取前5个
}

// 在服务器启动时预生成
const questionIdsOnStartup = generateRandomQuestions();
app.use(cookieParser());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const roomData = {};
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

app.post("/set-cookie", async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) return res.status(400).json({ error: "缺少 account 資料" });

    res.cookie("userAccount", account, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });

    const userQuery = query(
      collection(firestoreInstance, "player"),
      where("account", "==", account)
    );
    const querySnapshot = await getDocs(userQuery);
    let userId = null;

    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      userId = firstDoc.id;

      res.cookie("userId", userId, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      });
    }

    return res.json({ message: "Cookie 設定成功", account, userId });
  } catch (error) {
    console.error("設定 Cookie 失敗:", error);
    return res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.get("/get-cookie", async (req, res) => {
  try {
    return res.json({
      account: req.cookies.userAccount || null,
      id: req.cookies.userId || null,
    });
  } catch (error) {
    console.error("取得 Cookie 失敗:", error);
    return res.status(500).json({ error: "伺服器錯誤" });
  }
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
  console.log("Socket.IO 連線成功:", socket.id);

  socket.on("register", (userId) => {
    users[userId] = socket.id;
    console.log(`用戶 ${userId} 已連線, socket ID: ${socket.id}`);
  });

  socket.on("invite", ({ from, to }) => {
    if (users[to]) {
      const roomId = `room_${from}_${to}`;
      socket.join(roomId);
      io.to(users[to]).emit("invite", { from, roomId });
    }
  });

  socket.on("accept-invite", ({ friendId, roomId, userId }) => {
    socket.join(roomId);
    console.log(`用戶 ${userId} 和 ${friendId} 加入房間 ${roomId}`);
    io.to(roomId).emit("joined-room", { users: [userId, friendId], roomId });
  });

  socket.on("get-question-ids", (roomId) => {
    const numbers = Array.from({ length: 251 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    const question_ids = numbers.slice(0, 5);  // 取前5个
    if(!roomData[roomId])
      roomData[roomId] = { question_ids: generateRandomQuestions() };
    console.log(roomData[roomId])
    if (roomData[roomId]) {
      socket.emit("question-ids", roomData[roomId].question_ids);
    }
  });
  socket.on("leave-room", (roomName,userId) => {
    socket.leave(roomName);
    console.log(`用戶 ${userId} 離開房間 ${roomName}`)
});

  socket.on("disconnect", () => {
    Object.keys(users).forEach((key) => {
      if (users[key] === socket.id) {
        delete users[key];
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});
