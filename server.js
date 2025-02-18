const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const http = require("http");  // 建立 HTTP 伺服器
const { Server } = require("socket.io");  // 引入 Socket.IO
const cookieParser = require("cookie-parser");
const axios = require("axios");
const { getDocs, collection, query, where, getFirestore } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");

const app = express();
const firestoreApp = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(firestoreApp);

// **中介軟體**
app.use(cookieParser()); 
app.use(express.json()); 

// **伺服器埠號**
const PORT = process.env.PORT || 5000;

// **CORS 設定**
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

// **設定 Cookie**
app.post("/set-cookie", async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) {
      return res.status(400).json({ error: "缺少 account 資料" });
    }

    res.cookie("userAccount", account, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });

    // 查詢 Firestore 取得 userId
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

// **取得 Cookie**
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

// **路由設定**
app.use("/api", routes);

// **建立 HTTP 伺服器**
const server = http.createServer(app);

// **Socket.IO 伺服器**
const io = new Server(server, {
  cors: {
    origin: "*", // 允許所有跨域請求
    methods: ["GET", "POST"],
  },
});

let users = {};

io.on("connection", (socket) => {
  console.log("Socket.IO 連線成功:", socket.id);

  socket.on("register", (userId) => {
    users[userId] = socket.id;
    console.log(`用戶 ${userId} 已連線, socket ID: ${socket.id}`);
    console.log("當前在線用戶:", users); // 👈 顯示所有在線用戶
  });

  socket.on("invite", ({ from, to }) => {
    console.log(`收到邀請請求: ${from} -> ${to}`);
    console.log("當前在線用戶:", users);

    if (users[to]) {
      io.to(users[to]).emit("invite", { from });
      console.log(`成功發送邀請: ${from} -> ${to}`);
    } else {
      console.log(`用戶 ${to} 不在線，無法發送邀請`);
    }
  });

  socket.on("disconnect", () => {
    Object.keys(users).forEach((key) => {
      if (users[key] === socket.id) {
        console.log(`用戶 ${key} 斷開連線`);
        delete users[key];
      }
    });
  });
});

// **啟動伺服器**
server.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});
