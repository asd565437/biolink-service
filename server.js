const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const http = require('http');  // 用于创建 HTTP 服务器
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const { getDocs, collection, query, where, getFirestore } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");

const app = express();
const firestoreApp = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(firestoreApp);

// **中间件**
app.use(cookieParser()); // 解析 Cookie
app.use(express.json()); // 解析 JSON 请求体

// **服务器端口**
const PORT = 443 || 5000;

// **CORS 配置**
app.use(
  cors({
    origin: [
      'http://localhost:3000', // 本地开发
      'https://biolink-service.onrender.com', // 正式环境
      'https://biolink-zsl3.onrender.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // 允许携带 Cookie
  })
);

// **允许 OPTIONS 预检请求**
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
});

// **设置 Cookie**
app.post('/set-cookie', async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) {
      return res.status(400).json({ error: '缺少 account 数据' });
    }

    // 设置 userAccount Cookie
    res.cookie('userAccount', account, {
      maxAge: 24 * 60 * 60 * 1000, // 1 天
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    });

    // 查询 Firestore 获取 userId
    const userQuery = query(collection(firestoreInstance, "player"), where("account", "==", account));
    const querySnapshot = await getDocs(userQuery);

    let userId = null;
    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      userId = firstDoc.id; // Firestore 的 id 来自 doc.id，而不是 doc.data().id

      res.cookie('userId', userId, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      });
    }

    return res.json({ message: 'Cookie 设置成功', account, userId });

  } catch (error) {
    console.error('设置 Cookie 失败:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
});

// **获取 Cookie**
app.get('/get-cookie', async (req, res) => {
  try {
    return res.json({ 
      account: req.cookies.userAccount || null,
      id: req.cookies.userId || null
    });
  } catch (error) {
    console.error('获取 Cookie 失败:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
});


// **路由配置**
app.use('/api', routes);

// **创建 HTTP 服务器**
const server = http.createServer(app);

// **WebSocket 服务器**
const wss = new WebSocket.Server({ server });

let users = {};

wss.on('connection', (ws) => {
  console.log('WebSocket 连接成功');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'register') {
        users[data.userId] = ws;
        console.log(`用户 ${data.userId} 已连接`);
      } else if (data.type === 'invite') {
        const { from, to } = data;
        if (users[to]) {
          users[to].send(JSON.stringify({ type: 'invite', from }));
          console.log(`用户 ${from} 邀请了 ${to}`);
        }
      }
    } catch (error) {
      console.error('WebSocket 解析错误:', error);
    }
  });

  ws.on('close', () => {
    Object.keys(users).forEach((key) => {
      if (users[key] === ws) {
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
