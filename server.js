const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const { getDocs, getCountFromServer, collection, query, where, getFirestore, doc, addDoc, setDoc, updateDoc } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");
const { Midjourney } = require("midjourney");
const app = express();
const multer = require("multer");
const firestoreApp = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(firestoreApp);
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
async function sendFilePath(filePath, fileName) {
  try {
    const response = await axios.post(
      "https://biolink-py-server.onrender.com/process",
      {
        file_path: filePath,  // 正確的 JSON 結構
        file_name: fileName
      },
      { headers: { "Content-Type": "application/json" } } // 配置 headers
    );

    console.log("Flask 回應:", response.data);
    return response.data.file_path;
  } catch (error) {
    console.error("請求 Flask 時發生錯誤:", error.message);
  }
}
function generateRandomQuestions() {
  const numbers = Array.from({ length: 251 }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1); // 使用 crypto.randomInt() 代替 Math.random()
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers.slice(0, 5); // 取前5个
}



const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份从 0 开始
  const year = String(date.getFullYear()).slice(-2); // 取后两位

  return `${day}.${month}.${year}`;
};

const addFriend = async (userId, friendId) => {
  const friendsCollection = collection(firestoreInstance, "friends");

  try {
    // 查询是否已经有好友关系（双向查询）
    const q1 = query(friendsCollection, where("user1", "==", userId), where("user2", "==", friendId));
    const q2 = query(friendsCollection, where("user1", "==", friendId), where("user2", "==", userId));

    const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    if (!snapshot1.empty || !snapshot2.empty) {
      console.log("已经是好友了！");
      return;
    }
    const utcTime = new Date(); // 獲取當前 UTC 時間=
    // 🔥 手動加 8 小時
    const gmt8Time = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
    // 还不是好友，存入数据库
    await addDoc(friendsCollection, {
      user1: userId,
      user2: friendId,
      createdAt: formatDate(gmt8Time),
    });

    console.log("好友關係已建立");
  } catch (error) {
    console.error("添加好友失败:", error);
  }
};


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
      "https://biolink-py-server.onrender.com"
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
      res.cookie("userName", firstDoc.data().nickname, {
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
      userName: req.cookies.userName || null,
    });
  } catch (error) {
    console.error("取得 Cookie 失敗:", error);
    return res.status(500).json({ error: "伺服器錯誤" });
  }
});
app.get("/check_auth", (req, res) => {
  if (req.cookies.userAccount) {
    res.json({ isAuthenticated: true });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.get('/clear_cookie', (req, res) => {
  res.clearCookie("userAccount", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  });
  res.clearCookie("userId", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  });
  res.send("userAccount Cookie Cleared");
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
let roomAnswers = {}; // 追蹤每個房間的回答情況
let roomSubmitName = {};
io.on("connection", (socket) => {
  console.log("Socket.IO 連線成功:", socket.id);

  socket.on("register", (userId) => {
    users[userId] = socket.id;
    socket.data.userId = userId; // 儲存 userId 方便後續使用
    console.log(`用戶 ${userId} 已連線, socket ID: ${socket.id}`);
  });

  socket.on("invite", ({ from, to }) => {
    if (users[to]) {
      const roomId = `room_${from}_${to}`;
      socket.join(roomId);
      io.to(users[to]).emit("invite", { from, roomId });
    }
  });
  socket.on("add_friend", ({ from, to }) => {
    if (users[to]) {
      io.to(users[to]).emit("add_friend", { from });
    }
  });

  socket.on("agree_friend", ({ userId, friendId }) => {
    addFriend(userId, friendId);
    io.to(users[userId]).emit("success_add_friend");
    io.to(users[friendId]).emit("success_add_friend");
    console.log(`用戶 ${userId} 和 ${friendId} 成為好友`);
  });
  socket.on("reject_friend", ({ friendId }) => {
    io.to(users[friendId]).emit("reject_friend");
  });
  socket.on("submit_name", ({ userId ,bio_id, strainName}) => {
    const userRooms = [...socket.rooms].filter(room => room !== socket.id); // 过滤掉默认房间
    roomSubmitName[userRooms][userId] = true; // 更新用户状态
    console.log(roomSubmitName)
    checkAllTriggered(userRooms, bio_id ,strainName);
  });

  // 检查房间内所有用户是否都触发机关
function checkAllTriggered(roomId ,bio_id, strainName) {
  const users = roomSubmitName[roomId];
  if (!users) return;
  console.log(strainName)
  const allTriggered = Object.values(users).every(status => status === true); // 所有人都触发了吗？

  if (allTriggered) {
      io.to(roomId).emit("both-submit"); // 广播房间内所有人机关已触发
      const docRef = doc(firestoreInstance, "bio", bio_id);
      updateDoc(docRef, {
        name:strainName
    }).then(() => {
        console.log("字段已成功添加");
    }).catch((error) => {
        console.error("更新失败:", error);
    });
  }
}

  socket.on("accept-invite", ({ friendId, roomId, userId }) => {
    socket.join(roomId);
    if (!roomSubmitName[roomId]) {
      roomSubmitName[roomId] = {};
    }
    roomSubmitName[roomId][friendId] = false; // 初始状态：未触发机关
    roomSubmitName[roomId][userId] = false; // 初始状态：未触发机关
    console.log(`用戶 ${userId} 和 ${friendId} 加入房間 ${roomId}`);
    io.to(roomId).emit("joined-room", { users: [userId, friendId], roomId });
  });
  socket.on("reject-invite", ({ friendId, roomId, userId }) => {
    io.to(users[friendId]).emit("reject-invite");
  });

  let sharedText = "";
  // 當用戶發送更新
  socket.on("editText", (newText) => {
    sharedText = newText;
    // 廣播給所有連線的用戶
    io.emit("updateText", sharedText);
  });

  socket.on("submit_question", async ({ roomId, userId, answers }) => {
    if (!roomAnswers[roomId]) {
      roomAnswers[roomId] = {};
    }

    roomAnswers[roomId][userId] = answers; // 儲存該用戶的回答（包含 answerP1 陣列 和 answerP2 陣列）

    // 取得房間內所有玩家的 ID
    const playersInRoom = Object.keys(roomAnswers[roomId]); // 🔥 獲取房間內的所有 userId

    // 確保兩個玩家都已回答
    if (playersInRoom.length === 2) {
      console.log("both-answered");

      // 🔥 從 Firestore 獲取這些玩家的 `nickname`
      let playerNicknames = {};
      const usersCollection = collection(firestoreInstance, "player");
      const snapshot = await getCountFromServer(collection(firestoreInstance, "bio"));
      const formatNumber = (num) => String(num).padStart(4, '0');
      const bio_id = `${formatNumber(snapshot.data().count + 1)}`;
      try {
        const usersQuery = query(usersCollection, where("id", "in", playersInRoom));
        const usersSnap = await getDocs(usersQuery);

        usersSnap.forEach((doc) => {
          const data = doc.data();
          playerNicknames[data.id] = data.nickname; // 獲取 nickname
        });

        console.log("玩家 Nicknames:", playerNicknames);
      } catch (error) {
        console.error("獲取玩家暱稱時出錯:", error);
      }

      // 取得兩個玩家的 ID
      const [player1, player2] = playersInRoom;

      // 取得兩個玩家的答案
      const player1Answers = roomAnswers[roomId][player1]; // { answerP1: [...], answerP2: [...] }
      const player2Answers = roomAnswers[roomId][player2]; // { answerP1: [...], answerP2: [...] }
      console.log(`玩家 ${player1} 的答案: P1=${player1Answers.answerP1}, P2=${player1Answers.answerP2}`);
      console.log(`玩家 ${player2} 的答案: P1=${player2Answers.answerP1}, P2=${player2Answers.answerP2}`);

      // 🔥 交叉比對：每一題的 P2 與對方的 P1 是否相同
      let player1CorrectCount = 0;
      let player2CorrectCount = 0;

      // 確保 `answerP1` 和 `answerP2` 陣列長度相等
      let questionCount = Math.min(player1Answers.answerP1.length, player2Answers.answerP1.length);

      for (let i = 0; i < questionCount; i++) {
        if (player1Answers.answerP2[i] === player2Answers.answerP1[i]) {
          player1CorrectCount++;
        }
        if (player2Answers.answerP2[i] === player1Answers.answerP1[i]) {
          player2CorrectCount++;
        }
      }

      // 總答對題數
      let totalCorrect = player1CorrectCount + player2CorrectCount;

      console.log(`玩家 ${player1} (${playerNicknames[player1]}) 答對的題數: ${player1CorrectCount}`);
      console.log(`玩家 ${player2} (${playerNicknames[player2]}) 答對的題數: ${player2CorrectCount}`);
      console.log(`總共答對的題數: ${totalCorrect}`);

      const utcTime = new Date(); // 獲取當前 UTC 時間=
      // 🔥 手動加 8 小時
      const gmt8Time = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
      // 傳送比對結果 & 總答對數 & 房間內的所有玩家 ID & 暱稱
      io.to(roomId).emit("both-answered", {
        totalCorrect: totalCorrect, // 總共答對的題數
        createdAt: formatDate(gmt8Time),
        bio_id: bio_id,
        players: playersInRoom, // 傳送所有玩家 ID
        nicknames: playerNicknames, // 🔥 傳送所有玩家的 nickname
      });

      const mid = async (totalCorrect) => {
        const client = new Midjourney({
          ServerId: process.env.MID_SERVER_ID,
          ChannelId: process.env.MID_CHANNEL_ID,
          SalaiToken: process.env.MID_SALAI_TOKEN,
          Debug: false,
          Ws: true,
        });

        try {
          await client.Connect();
          let Imagine = null;
          const finalScore = totalCorrect / 2;

          if (finalScore >= 0 && finalScore < 2) {
            Imagine = await client.Imagine("An artistic, abstract representation of the organic pattern of a cell nucleus in a petri dish. The design is characterized by soft radiating structures, concentric layers and delicate flowing textures. The style is dreamy and futuristic, with gradient shades of blue and purple. The compositions of the works emphasize elegance and harmony, with subtle luminous effects and fine-grained or dotted textures that avoid any resemblance to real bacteria or microorganisms. The result feels ethereal, minimalistic, and inspired by nature’s fluid patterns and cosmic aesthetics.", (uri, progress) => { });
          } else if (finalScore < 4) {
            Imagine = await client.Imagine("An artistic, abstract representation of the organic pattern of a cell nucleus in a petri dish. The design is characterized by soft radiating structures, concentric layers and delicate flowing textures. The style is dreamy and futuristic, with gradient shades of yellow and green. The compositions of the works emphasize elegance and harmony, with subtle luminous effects and fine-grained or dotted textures that avoid any resemblance to real bacteria or microorganisms. The result feels ethereal, minimalistic, and inspired by nature’s fluid patterns and cosmic aesthetics.", (uri, progress) => { });
          } else {
            Imagine = await client.Imagine("An artistic, abstract representation of the organic pattern of a cell nucleus in a petri dish. The design is characterized by soft radiating structures, concentric layers and delicate flowing textures. The style is dreamy and futuristic, with gradient shades of red and orange. The compositions of the works emphasize elegance and harmony, with subtle luminous effects and fine-grained or dotted textures that avoid any resemblance to real bacteria or microorganisms. The result feels ethereal, minimalistic, and inspired by nature’s fluid patterns and cosmic aesthetics.", (uri, progress) => { });
          }

          if (!Imagine) {
            console.error("❌ Failed to generate image.");
            return null;
          }

          // 选择第一张图片进行放大
          const selectedIndex = 1;
          const Upscale = await client.Upscale({
            index: selectedIndex,
            msgId: Imagine.id,
            hash: Imagine.hash,
            flags: Imagine.flags,
          });

          if (!Upscale || !Upscale.uri) {
            console.error("❌ Upscale failed or no URI returned.");
            return null;
          }
          const imageUrl = Upscale.uri;
          const fileName = `${bio_id}`;
          console.log("Downloading and uploading image...");
          let URL = await sendFilePath(imageUrl, fileName);

          if (!URL) {
            console.error("❌ Image upload to S3 failed.");
            return null;
          }

          console.log(`✅ Image uploaded: ${URL}`);
          return URL;
        } catch (error) {
          console.error("❌ Error in mid function:", error);
          return null;
        }
      };

      let URL = await mid(totalCorrect);
      console.log("Final image URL:", URL);

      const data = {
        totalCorrect: totalCorrect, // 总共答对的题数
        createdAt: formatDate(gmt8Time),
        bio_id: bio_id,
        players: playersInRoom, // 传送所有玩家 ID
        nicknames: playerNicknames, // 传送所有玩家的昵称
      };

      // 只有在 URL 有效时才加入 `imageURL`
      if (URL) {
        data.imageURL = URL;
      }

      await setDoc(doc(firestoreInstance, "bio", bio_id), data);
      io.to(roomId).emit("grenarate_success", { URL, bio_id});

      // 清空房間答案（避免影響下一題）
      roomAnswers[roomId] = {};
    }
  });


  socket.on("get-question-ids", (roomId) => {
    const numbers = Array.from({ length: 251 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    const question_ids = numbers.slice(0, 5);  // 取前5个
    if (!roomData[roomId])
      roomData[roomId] = { question_ids: generateRandomQuestions() };
    console.log(roomData[roomId])
    if (roomData[roomId]) {
      socket.emit("question-ids", roomData[roomId].question_ids);
    }
  });
  socket.on("leave-room", (roomId, userId) => {
    socket.leave(roomId);
    console.log(`用戶 ${userId} 離開房間 ${roomId}`)
    socket.to(roomId).emit("user-left", { id: socket.id, room: roomId });
  });

  socket.on("disconnect", () => {
    Object.keys(users).forEach((key) => {
      if (users[key] === socket.id) {
        delete users[key];
        const userId = socket.data.userId || "Unknown";
        const roomId = [...socket.rooms].filter(r => r !== socket.id); // 取得該用戶所在的房間（不包含自己的 socket.id）
        socket.leave(roomId);
        console.log(`用戶 ${userId} 離開房間 ${roomId}`)
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});
