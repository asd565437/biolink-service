const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const { Midjourney } = require("midjourney");
const { getDocs, getCountFromServer, collection, query, where, getFirestore, doc, addDoc, setDoc, updateDoc, getDoc } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");
const axios = require("axios");
const firestoreApp = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(firestoreApp);
const app = express();
app.use(express.json());
const server = http.createServer(app);
let sec = 0;
let timer = null;
app.use(cors({

  origin: ["http://localhost:5173",

    "https://biolink-ipad.netlify.app"], // 允许前端访问的地址

  methods: ["GET", "POST"]

}));



const io = new Server(server, {

  cors: {

    origin: ["http://localhost:5173",

      "https://biolink-ipad.netlify.app"

    ], // 允许的前端地址

    methods: ["GET", "POST"]

  }

});

app.options("*", (req, res) => {

  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  res.header("Access-Control-Allow-Credentials", "true");

  res.sendStatus(204);

});


let player1 = false;
let player2 = false;
let p1toPlay = false;
let p2toPlay = false;
let ph = false;
let shake = false;

let fogStatus = {
  guide: false,
  operate: false
};

let bioName = {
  bio1: false,
  bio2: false
};

let data = {
  name1: null,
  name2: null,
  bioName: null,
  bio_id: 0
}
app.post("/get_bio_info_n2", async (req, res) => {
  try {
    console.log(req.body)
    const { name2 } = req.body;
    data.name2 = name2;
    res.json({ success: true });
  } catch (error) {
    console.error("設定 name2 傳輸失敗:", error);
    res.status(500).json({ error: "內部錯誤" });
  }
});
app.post("/get_bio_info_n1", async (req, res) => {
  try {
    console.log(req.body)
    const { name1 } = req.body;
    data.name1 = name1;
    console.log("收到 name1：", name1);
    res.json({ success: true });
  } catch (error) {
    console.error("設定 name1 傳輸失敗:", error);
    res.status(500).json({ error: "內部錯誤" });
  }
});

app.post("/get_score", async (req, res) => {
  try {
    const { finalScore } = req.body;
    sec = 0;
    timer = setInterval(() => {
      sec += 1;
    }, 1000);
    const videoPath = await mid(finalScore);
    res.json({ success: true });
  } catch (error) {
    console.error("設定 finalScore 傳輸失敗:", error);
    res.status(500).json({ error: "內部錯誤" });
  }
});

let latestPikaURL = null;

app.post("/webhook", async (req, res) => {
  try {
    console.log(sec);
    clearInterval(timer);
    const response = await axios.post(
      "https://biolink-py-server.onrender.com/video",
      {
        file_path: req.body.videos[0].resultUrl,  // 正確的 JSON 結構
        file_name: data.bio_id
      },
      { headers: { "Content-Type": "application/json" } } // 配置 headers
    );
    console.log("generate video complete!!");
    console.log(response.data.file_path);

    latestPikaURL = response.data.file_path;
    io.emit("get-video", latestPikaURL);
    // io.emit("get-video", response.data.file_path);
    res.json({ success: true });
  } catch (error) {
    console.error("設定 webhook 失敗:", error);
    res.status(500).json({ error: "webhook 失敗" });
  }
});

io.on('connection', (socket) => {

  console.log('A new client has connected');

  function checkStart(player1, player2) {

    if (player1 && player2) {
      console.log("start")
      socket.broadcast.emit("start");
    }
  }

  function stage1Play(p1toPlay, p2toPlay) {

    if (p1toPlay && p2toPlay) {
      console.log("start Stage1")
      socket.broadcast.emit("stage1Table");
    }
  }

  function check(ph, shake) {

    if (ph && shake) {
      console.log("two")
      socket.broadcast.emit("two-guide");
    }
  }

  function checkFog() {

    if (fogStatus.guide && fogStatus.operate) {
      console.log("two-blow");
      io.emit("fog-end");  // 推薦用 io.emit 讓所有連線都收到，不只是 broadcast

      // 重置狀態，讓未來可以重新再判斷
      fogStatus.guide = false;
      fogStatus.operate = false;
    }
  }

  function checkBioName(name) {

    console.log("🔍 bioName 狀態：", bioName);

    if (bioName.bio1 && bioName.bio2) {
      console.log("雙方都已確認名字，準備 black");

      io.emit("black");  // 推薦用 io.emit 讓所有連線都收到，不只是 broadcast

      const docRef = doc(firestoreInstance, "bio", data.bio_id);
      data.bioName = name;
      updateDoc(docRef, {
        name: data.bioName
      }).then(() => {
        console.log("名字已成功添加");
      }).catch((error) => {
        console.error("更新失败:", error);
      });

      bioName.bio1 = false;
      bioName.bio2 = false;
    }
  }

  // 開始遊戲
  socket.on('start-player1', () => {
    console.log('player1');
    player1 = true;
    checkStart(player1, player2);
  });

  socket.on('start-player2', () => {
    console.log('player2');
    player2 = true;
    checkStart(player1, player2);
  });

  //命名確認開始遊玩
  socket.on('name1ptoPlay', () => {
    console.log('player1 to guide');
    p1toPlay = true;
    stage1Play(p1toPlay, p2toPlay);
  });

  socket.on('name2ptoPlay', () => {
    console.log('player2 to lab');
    p2toPlay = true;
    stage1Play(p1toPlay, p2toPlay);

  });

  //酸鹼
  socket.on('phed3', () => {
    console.log('橘色了');
    ph = true;
    check(ph, shake);
    socket.broadcast.emit("table-ph-3");
  });

  //搖晃
  socket.on('shaked', () => {
    console.log('搖了');
    shake = true;
    check(ph, shake);
  });

  socket.on('shaked1', () => {
    console.log('1搖了');
    socket.broadcast.emit("table-shake-1");
  });

  socket.on('shaked4', () => {
    console.log('4搖了');
    socket.broadcast.emit("table-shake-4");
  });

  //混合
  socket.on('mixed', () => {
    console.log("mixed");
    socket.broadcast.emit('three-guide');
  });

  //失敗有霧
  socket.on('stired-fog', () => {
    console.log('stired-fog');
    socket.broadcast.emit('fog-guide');
  });

  //成功
  socket.on('stired-correct', () => {
    console.log('stired-correct');
    socket.broadcast.emit('correct-guide');
  });

  //說明吹氣
  socket.on('fogged-guide', () => {
    console.log('fogged-guide');
    fogStatus.guide = true;
    checkFog();
  });

  //操作吹氣
  socket.on('fogged-operate', () => {
    console.log('fogged-operate');
    fogStatus.operate = true;
    checkFog();
  });

  // 倒出
  socket.on('pour', () => {
    console.log("stage1-end");
    socket.broadcast.emit('stage1-end');
  });

  // 第二前導片
  socket.on('stage2-intro', () => {
    console.log("stage2-intro");
    socket.broadcast.emit('stage2-intro');
  });

  //電腦命名界面
  socket.on('goNamebio', () => {
    console.log("goNamebio");
    socket.broadcast.emit('goNamebio');
  });

  socket.on('namebio:update', (value) => {
    socket.broadcast.emit('namebio:update', value); // 傳給其他人
  });

  //玩家1確認菌名
  socket.on('namebio1:confirm', (name) => {
    console.log("玩家1 確認菌名");
    bioName.bio1 = true;

    if (!data.bioName) {
      data.bioName = name;
      console.log("✅ bioName 記錄為：", name);
    }

    io.emit('namebio1:status', true);
    checkBioName(name);
  });

  //玩家2確認菌名
  socket.on('namebio2:confirm', (name) => {
    console.log("玩家2 確認菌名");
    bioName.bio2 = true;

    if (!data.bioName) {
      data.bioName = name;
      console.log("✅ bioName 記錄為：", name);
    }

    io.emit('namebio2:status', true);
    checkBioName(name);
  });

  //生長動畫
  socket.on('grow', () => {
    console.log("生長 GROW");
    socket.broadcast.emit('grow');
  });

  // PIKA
  socket.on("ask-for-pika", () => {
    if (latestPikaURL) {
      socket.emit("get-video", latestPikaURL);
    }
  });

  //結尾影片
  socket.on('wall-end', () => {
    console.log("wall-end");
    socket.broadcast.emit('wall-end');
  });

  // 當客戶端斷開連接時

  socket.on('disconnect', () => {
    player1 = false;
    player2 = false;
    p1toPlay = false;
    p2toPlay = false;
    ph = false;
    shake = false;

    console.log('A client has disconnected');
    data.name1 = null;
    data.name2 = null;
    data.bio_name = null;
    data.bio_id = 0;
  });

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
    const finalScore = totalCorrect;

    console.log("generate image...");
    if (finalScore >= 0 && finalScore <= 30) {
      Imagine = await client.Imagine("An artistic, abstract representation of the organic pattern of a cell nucleus in a petri dish. The design is characterized by soft radiating structures, concentric layers and delicate flowing textures. The style is dreamy and futuristic, with gradient shades of blue and purple. The compositions of the works emphasize elegance and harmony, with subtle luminous effects and fine-grained or dotted textures that avoid any resemblance to real bacteria or microorganisms. The result feels ethereal, minimalistic, and inspired by nature’s fluid patterns and cosmic aesthetics.", (uri, progress) => { });
    } else if (finalScore <= 60) {
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
    const snapshot = await getCountFromServer(collection(firestoreInstance, "bio"));
    const formatNumber = (num) => String(num).padStart(4, '0');
    const bio_id = `${formatNumber(snapshot.data().count + 1)}`;
    data.bio_id = bio_id;
    const fileName = `${bio_id}`;
    const utcTime = new Date(); // 獲取當前 UTC 時間=
    const gmt8Time = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
    console.log("uploading image...");
    const { pikaPath, midPath } = await sendFilePath(imageUrl, fileName);
    console.log("generate video...");
    let job_id = await generateVideo(midPath);
    const bio_data = {
      totalCorrect: totalCorrect, // 总共答对的题数
      createdAt: formatDate(gmt8Time),
      bio_id: bio_id,
      players: ["9998", "9999"], // 传送所有玩家 ID
      nicknames: { 9998: data.name1, 9999: data.name2 }, // 传送所有玩家的昵称
      imageURL: `https://biolink-pic.s3.us-east-1.amazonaws.com/midjourney/${bio_id}.png`
    };
    await setDoc(doc(firestoreInstance, "bio", bio_id), bio_data);

    return midPath;

  } catch (error) {
    console.error("❌ Error in mid function:", error);
    return null;
  }
};
const PIKA_API_URL = 'https://api.pikapikapika.io/web/generate';
const PIKA_API_TOKEN = 'cd93dac8-e90e-4f23-a6fe-f0dc2afb4b8d';

async function generateVideo(imageURL) {
  const requestData = {
    promptText: "move it",
    model: "Turbo",
    image: imageURL,
    options: {
      frameRate: 24,
      parameters: {
        guidanceScale: 12,
        motion: 1,
        negativePrompt: "",
        seed: null,
      },
      extend: false
    }
  };

  try {
    const response = await axios.post(
      PIKA_API_URL,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${PIKA_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('生成的影片 URL:', response.data.job.id);
    return response.data.job.id;
  } catch (error) {
    console.error('請求失敗:', error.response ? error.response.data : error.message);
  }
}
async function sendFilePath(filePath, fileName) {
  try {
    const response2 = await axios.post(
      "https://biolink-py-server.onrender.com/pika",
      {
        file_path: filePath,  // 正確的 JSON 結構
        file_name: fileName
      },
      { headers: { "Content-Type": "application/json" } } // 配置 headers
    );
    const response = await axios.post(
      "https://biolink-py-server.onrender.com/process",
      {
        file_path: filePath,  // 正確的 JSON 結構
        file_name: fileName
      },
      { headers: { "Content-Type": "application/json" } } // 配置 headers
    );
    return {
      midPath: response.data.file_path,
      pikaPath: response2.data.file_path
    };
  } catch (error) {
    console.error("請求 Flask 時發生錯誤:", error.message);
  }
}
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份从 0 开始
  const year = String(date.getFullYear()).slice(-2); // 取后两位

  return `${day}.${month}.${year}`;
};
server.listen(3000, () => {

  console.log('Server running on port 3000');

});