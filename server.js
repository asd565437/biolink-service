const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());  // 解析 Cookie
const PORT = process.env.PORT || 5000;

// CORS 配置
app.use(cors({
  origin: ['http://localhost:3000', 'http://biolink-auth.firebaseapp.com','https://roaring-swan-7a4242.netlify.app/'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,  // 允许前端携带 Cookie 或身份验证令牌
}));

// 中间件
app.use(express.json());

app.post('/set-cookie', (req, res) => {
  const { account } = req.body; // 从请求体中解析出 account
  if (!account) {
    return res.status(400).json({ error: '缺少 account 数据' });
  }

  res.cookie('userAccount', account, {
    maxAge: 24 * 60 * 60 * 1000, // 1 天
    httpOnly: true,             // 防止 JavaScript 读取
    secure: false,              // 本地开发关闭 HTTPS
    sameSite: 'Lax',            // 防止 CSRF 攻击
  });

  res.json({ message: 'Cookie 设置成功', account });
});


// 獲取 Cookie
app.get('/get-cookie', (req, res) => {
  res.json({ account: req.cookies.userAccount || null });
});

const wss = new WebSocket.Server({ port: 8080 });
let users = {};
wss.on('connection', (ws) => {

  ws.on('message', (message) => {
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
  });

  ws.on('close', () => {
      // 断开连接时移除用户
      Object.keys(users).forEach((key) => {
          if (users[key] === ws) {
              delete users[key];
          }
      });
  });
});
// 初始化数据库
// 路由配置
app.use('/api', routes);

// React 静态文件
const staticPath = path.join(__dirname, 'client/build');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  console.error('Static files not found. Ensure React app is built.');
}

// 启用 HTTP 或 HTTPS
const server = http.createServer(app); // 如果需要 HTTPS，改为 https.createServer

// 启动服务器
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
