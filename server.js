const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const http = require('http');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();

// **中間件順序（重要）**
app.use(cookieParser()); // 解析 Cookie
app.use(express.json()); // 解析 JSON 請求體

// 伺服器端口
const PORT = process.env.PORT || 5000;

// **CORS 配置**
app.use(
  cors({
    origin: [
      'http://localhost:3000', // 本地開發
      'https://biolink-service.onrender.com', // 正式環境
      'https://biolink-zsl3.onrender.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 允許的請求方法
    allowedHeaders: ['Content-Type', 'Authorization'], // 允許的請求標頭
    credentials: true, // 允許攜帶 Cookie
  })
);

// **允許 OPTIONS 預檢請求**
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
});

// **設定 Cookie**
app.post('/set-cookie', async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) {
      return res.status(400).json({ error: '缺少 account 數據' });
    }
    res.cookie('userAccount', account, {
      maxAge: 24 * 60 * 60 * 1000, // 1 天
      httpOnly: true, // 防止 JavaScript 讀取
      secure: process.env.NODE_ENV === 'production', // 正式環境必須為 HTTPS
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 跨域用 None，本地用 Lax
    });

    const userQuery = query(collection(firestoreInstance, "player"), where("account", "==", account));
    const querySnapshot = await getDocs(userQuery);
    
    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0].data(); // 取第一個文檔
      res.cookie('userId', firstDoc["id"], {
        maxAge: 24 * 60 * 60 * 1000, // 1 天
        httpOnly: true, // 防止 JavaScript 讀取
        secure: process.env.NODE_ENV === 'production', // 正式環境必須為 HTTPS
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 跨域用 None，本地用 Lax
      });
    }

    res.json({ message: 'Cookie 設定成功', account });
  } catch (error) {
    console.error('設定 Cookie 失敗:', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// **獲取 Cookie**
app.get('/get-cookie', async (req, res) => {
  try {
    res.json({ account: req.cookies.userAccount || null });
  } catch (error) {
    console.error('獲取 Cookie 失敗:', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// **使用 Axios 進行 API 請求**
app.get('/external-api', async (req, res) => {
  try {
    const apiUrl = 'https://example.com/data';
    const response = await axios.get(apiUrl, { withCredentials: true });
    res.json(response.data);
  } catch (error) {
    console.error('外部 API 請求失敗:', error);
    res.status(500).json({ error: '無法獲取外部數據' });
  }
});

// **路由配置**
app.use('/api', routes);

// **啟動 HTTP 伺服器**
const server = http.createServer(app);

// **WebSocket 伺服器**
const wss = new WebSocket.Server({ server });

let users = {};

wss.on('connection', (ws) => {
  console.log('WebSocket 連線成功');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'register') {
        users[data.userId] = ws;
        console.log(`用戶 ${data.userId} 已連線`);
      } else if (data.type === 'invite') {
        const { from, to } = data;
        if (users[to]) {
          users[to].send(JSON.stringify({ type: 'invite', from }));
          console.log(`用戶 ${from} 邀請了 ${to}`);
        }
      }
    } catch (error) {
      console.error('WebSocket 解析錯誤:', error);
    }
  });

  ws.on('close', () => {
    Object.keys(users).forEach((key) => {
      if (users[key] === ws) {
        delete users[key];
      }
    });
    console.log('WebSocket 連線關閉');
  });
});

// **啟動伺服器**
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
