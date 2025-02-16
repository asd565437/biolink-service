const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();

// **中间件顺序调整**
app.use(cookieParser()); // 解析 Cookie
app.use(express.json()); // 解析 JSON 请求体

// 服务器端口
const PORT = process.env.PORT || 5000;

// **CORS 配置**
app.use(
  cors({
    origin: [
      'https://biolink-service.onrender.com',
      'https://biolink-zsl3.onrender.com',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true, // 允许跨域请求携带 Cookie
  })
);

// **设置 Cookie**
app.post('/set-cookie', async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) {
      return res.status(400).json({ error: '缺少 account 数据' });
    }

    res.cookie('userAccount', account, {
      maxAge: 24 * 60 * 60 * 1000, // 1 天
      httpOnly: true, // 防止 JavaScript 读取
      secure: false, // 生产环境必须 HTTPS
      sameSite: 'None', // 本地用 Lax，跨域用 None
    });

    res.json({ message: 'Cookie 设置成功', account });
  } catch (error) {
    console.error('设置 Cookie 失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// **获取 Cookie**
app.get('/get-cookie', async (req, res) => {
  try {
    console.log('Cookies:', req.cookies); // 确保能打印出 cookies
    res.json({ account: req.cookies.userAccount || null });
  } catch (error) {
    console.error('获取 Cookie 失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// **使用 Axios 进行 API 请求**
app.get('/external-api', async (req, res) => {
  try {
    const apiUrl = 'https://example.com/data';
    const response = await axios.get(apiUrl, { withCredentials: true });
    res.json(response.data);
  } catch (error) {
    console.error('外部 API 请求失败:', error);
    res.status(500).json({ error: '无法获取外部数据' });
  }
});

// **路由配置**
app.use('/api', routes);

// **启动 HTTP 服务器**
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
        delete users[key];
      }
    });
    console.log('WebSocket 连接关闭');
  });
});

// **启动服务器**
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
