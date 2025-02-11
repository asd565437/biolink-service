const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser()); // 解析 Cookie

// 服务器端口（Render 会提供 `PORT` 环境变量）
const PORT = process.env.PORT || 5000;

// CORS 配置（仅允许 Render 站点访问）
app.use(cors({
  origin: [
    'https://biolink-service.onrender.com',
    'https://biolink-zsl3.onrender.com',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // 允许前端携带 Cookie 或身份验证令牌
}));

// 中间件
app.use(express.json());

// 设置 Cookie
app.post('/set-cookie', (req, res) => {
  const { account } = req.body;
  if (!account) {
    return res.status(400).json({ error: '缺少 account 数据' });
  }

  res.cookie('userAccount', account, {
    maxAge: 24 * 60 * 60 * 1000, // 1 天
    httpOnly: true, // 防止 JavaScript 读取
    secure: process.env.NODE_ENV === 'production', // 仅生产环境启用 HTTPS
    sameSite: 'Lax', // 防止 CSRF 攻击
  });

  res.json({ message: 'Cookie 设置成功', account });
});

// 获取 Cookie
app.get('/get-cookie', (req, res) => {
  res.json({ account: req.cookies.userAccount || null });
});

// 路由配置
app.use('/api', routes);

// 启动 HTTP 服务器（用于 WebSocket）
const server = http.createServer(app);

// WebSocket 服务，绑定到 HTTP 服务器
const wss = new WebSocket.Server({ server });

let users = {};

wss.on('connection', (ws) => {
  console.log('WebSocket 连接成功');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'register') {
        // 用户注册 WebSocket 连接
        users[data.userId] = ws;
        console.log(`用户 ${data.userId} 已连接`);
      } else if (data.type === 'invite') {
        // 发送邀请
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
    // 断开连接时移除用户
    Object.keys(users).forEach((key) => {
      if (users[key] === ws) {
        delete users[key];
      }
    });
    console.log('WebSocket 连接关闭');
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
