const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const http = require("http");  // 创建 HTTP 服务器
const { Server } = require("socket.io");  // 引入 Socket.IO
const cookieParser = require("cookie-parser");
const axios = require("axios");
const { getDocs, collection, query, where, getFirestore } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");

const app = express();
const firestoreApp = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(firestoreApp);

// **中间件**
app.use(cookieParser()); 
app.use(express.json()); 

// **服务器端口**
const PORT = process.env.PORT || 5000;

// **CORS 配置**
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

// **设置 Cookie**
app.post("/set-cookie", async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) {
      return res.status(400).json({ error: "缺少 account 数据" });
    }

    res.cookie("userAccount", account, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });

    // 查询 Firestore 获取 userId
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

    return res.json({ message: "Cookie 设置成功", account, userId });
  } catch (error) {
    console.error("设置 Cookie 失败:", error);
    return res.status(500).json({ error: "服务器错误" });
  }
});

// **获取 Cookie**
app.get("/get-cookie", async (req, res) => {
  try {
    return res.json({
      account: req.cookies.userAccount || null,
      id: req.cookies.userId || null,
    });
  } catch (error) {
    console.error("获取 Cookie 失败:", error);
    return res.status(500).json({ error: "服务器错误" });
  }
});

// **路由配置**
app.use("/api", routes);

// **创建 HTTP 服务器**
const server = http.createServer(app);

// **Socket.IO 服务器**
const io = new Server(server, {
  cors: {
    origin: "*", // 允许所有跨域请求
    methods: ["GET", "POST"],
  },
});

let users = {};

io.on("connection", (socket) => {
  console.log("Socket.IO 连接成功:", socket.id);

  socket.on("register", (userId) => {
    users[userId] = socket.id;
    console.log(`用户 ${userId} 已连接, socket ID: ${socket.id}`);
    console.log("当前在线用户:", users); // 👈 打印所有在线用户
});


socket.on("invite", ({ from, to }) => {
  console.log(`收到邀请请求: ${from} -> ${to}`);
  console.log("当前在线用户:", users);

  if (users[to]) {
      io.to(users[to]).emit("invite", { from });
      console.log(`成功发送邀请: ${from} -> ${to}`);
  } else {
      console.log(`用户 ${to} 不在线，无法发送邀请`);
  }
});


  socket.on("disconnect", () => {
    Object.keys(users).forEach((key) => {
      if (users[key] === socket.id) {
        console.log(`用户 ${key} 断开连接`);
        delete users[key];
      }
    });
  });
});

// **启动服务器**
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
