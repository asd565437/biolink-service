const express = require("express");
const bcrypt = require('bcryptjs');
const { getFirestore, getCountFromServer, collection, query, where, getDocs, doc, setDoc, getDoc, limit } = require("firebase/firestore");
const { firebaseConfig } = require("./firebase.js");
const { initializeApp } = require("firebase/app");
const router = express.Router();
const app = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(app);

const getFriends = async (userId) => {
  const friendsCollection = collection(firestoreInstance, "friends");
  console.log(userId)
  // 查询好友关系（双向查询）
  const q1 = query(friendsCollection, where("user1", "==", userId));
  const q2 = query(friendsCollection, where("user2", "==", userId));

  const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  let friends = [];

  snapshot1.forEach((doc) => {
    friends.push(doc.data().user2);
  });

  snapshot2.forEach((doc) => {
    friends.push(doc.data().user1);
  });
  return friends;
};
const getFriendInfo = async (userId, friendIdArray) => {
  const friendsCollection = collection(firestoreInstance, "friends");

  try {
    if (!friendIdArray || friendIdArray.length === 0) {
      console.log("好友 ID 陣列為空");
      return [];
    }

    const friendPromises = friendIdArray.map(async (friendId) => {
      const q1 = query(friendsCollection, where("user1", "==", userId), where("user2", "==", friendId));
      const q2 = query(friendsCollection, where("user1", "==", friendId), where("user2", "==", userId));

      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      if (!snapshot1.empty) {
        const data = snapshot1.docs[0].data();
        return { id: friendId, createdAt: data.createdAt };
      } else if (!snapshot2.empty) {
        const data = snapshot2.docs[0].data();
        return { id: friendId, createdAt: data.createdAt };
      } else {
        return null;
      }
    });

    const friendInfoArray = await Promise.all(friendPromises);
    return friendInfoArray.filter(Boolean); // 移除 null
  } catch (error) {
    console.error("取得好友資訊錯誤:", error);
    return [];
  }
};




const getUsersByIds = async (userIds, start, end) => {
  if (!userIds || userIds.length === 0) {
    return [];
  }
  const usersCollection = collection(firestoreInstance, "player");
  // 🔥 Firestore 限制 `where("in", [...])` 最多 10 個 ID，這裡改成 6 個
  const usersQuery = query(usersCollection, where("id", "in", userIds.slice(start, end)));
  const usersSnap = await getDocs(usersQuery);

  return usersSnap.docs.map(doc => ({
    id: doc.id,
    nickname: doc.data().nickname,
    bio_count: doc.data().bio_count,
    photoURL: doc.data().photoURL
  }));
};


//
// 📌 用户注册
//
router.post('/register', async (req, res) => {
  try {
    const { account, password, nickName, googleLogin, photoUrl } = req.body;

    if (!googleLogin && (!account || !password || !nickName)) {
      return res.status(400).json({ error: '請填寫所有必填欄位' });
    }

    // 检查用户是否已存在
    const userQuery = query(collection(firestoreInstance, "player"), where("account", "==", account));
    const userSnap = await getDocs(userQuery);

    if (!userSnap.empty) {
      return res.status(400).json({ error: '帳號已存在' });
    }

    // 生成用户 ID
    const snapshot = await getCountFromServer(collection(firestoreInstance, "player"));
    const formatNumber = (num) => String(num).padStart(4, '0');
    const user_id = `${formatNumber(snapshot.data().count + 1)}`;

    // 处理密码（Google 登录不哈希密码）
    const hashedPassword = googleLogin ? null : await bcrypt.hash(password, 10);

    // 存入 Firestore
    await setDoc(doc(firestoreInstance, "player", user_id), {
      id: user_id,
      account,
      nickname: nickName,
      password: hashedPassword,
      bio_count: 0,
      photoURL: photoUrl || null,
      googleLogin
    });

    res.status(200).json({ message: '註冊成功', user: { id: user_id } });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//
// 📌 用户登录
//
router.post("/login", async (req, res) => {
  try {
    const { account, password, googleLogin } = req.body;

    if (!googleLogin && (!account || !password)) {
      return res.status(201).json({ error: "請輸入帳號密碼" });
    }

    // 查询用户
    const usersSnap = await getDocs(query(collection(firestoreInstance, "player"), where("account", "==", account)));

    if (usersSnap.empty) {
      return res.status(202).json({ error: "帳號不存在" });
    }

    const user = usersSnap.docs[0].data();

    // 处理密码验证
    if (!googleLogin) {
      const isPasswordValid = await bcrypt.compare(String(password || ""), String(user.password || ""));
      if (!isPasswordValid) {
        return res.status(203).json({ error: "密碼錯誤" });
      }
    }

    res.status(200).json({ message: "登入成功", user: { id: user.id, account: user.account, nickname: user.nickname } });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//
// 📌 获取问题信息
//
router.post('/question', async (req, res) => {
  try {
    const { question_id } = req.body;

    if (!question_id) {
      return res.status(400).json({ error: '請提供 question_id' });
    }

    const questionRef = doc(firestoreInstance, 'question', String(question_id));
    const questionSnap = await getDoc(questionRef);

    if (!questionSnap.exists()) {
      return res.status(404).json({ error: '問題不存在' });
    }

    const questionData = questionSnap.data();
    const answers = questionData.options ? questionData.options.join(", ") : "";

    res.status(200).json({ message: '獲取成功', question: { id: question_id, question: questionData.question, answers } });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//
// 📌 更新用户头像
//
router.post('/photo', async (req, res) => {
  try {
    const { account, photoURL } = req.body;

    if (!account || !photoURL) {
      return res.status(400).json({ error: '請提供帳號和圖片URL' });
    }

    const userRef = doc(firestoreInstance, 'player', account);
    await setDoc(userRef, { photoURL }, { merge: true });

    res.status(200).json({ message: '設定圖片成功' });
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/get-friend-info', async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: '請提供 id' });
    }

    const questionRef = doc(firestoreInstance, 'player', String(id));
    const questionSnap = await getDoc(questionRef);

    if (!questionSnap.exists()) {
      return res.status(404).json({ error: 'id不存在' });
    }

    const questionData = questionSnap.data();

    res.status(200).json({ message: '獲取成功', player: { nickName: questionData.nickname, photoURL: questionData.photoURL } });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/get-friend-name', async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: '請提供 id' });
    }

    const questionRef = doc(firestoreInstance, 'player', String(id));
    const questionSnap = await getDoc(questionRef);

    if (!questionSnap.exists()) {
      return res.status(404).json({ error: 'id不存在' });
    }

    const questionData = questionSnap.data();

    res.status(200).json({ message: '獲取成功', player: { nickName: questionData.nickname } });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
//
// 📌 获取 Bio 信息
//
router.post('/bio', async (req, res) => {
  try {
    const { userId, index } = req.body;
    const biosSnap = await getDocs(
      query(collection(firestoreInstance, 'bio'), where("players", "array-contains", userId))
    );
    const count = biosSnap.size;
    function getPageRange(index, pageSize = 8) {
      const start = index * pageSize;
      const end = (index + 1) * pageSize;
      return [start, end];
    }

    // 使用：
    const [start, end] = getPageRange(index);
    const bios = biosSnap.docs.map(doc => doc.data()).slice(start, end);
    res.json({ bios, count });
  } catch (error) {
    console.error('Error fetching bios:', error);
    res.status(500).json({ error: 'Failed to fetch bios' });
  }
});

router.post('/get_all_bio', async (req, res) => {
  try {
    const { innerWidth, innerHeight } = req.body;
    const biosSnap = await getDocs(collection(firestoreInstance, "bio"));
    const bios = biosSnap.docs.map((doc, index) => ({
      id: doc.id,
      src: `https://biolink-pic.s3.us-east-1.amazonaws.com/midjourney/${doc.id}.png`, // 假設你仍然使用 bio_01 ~ bio_07
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      z: Math.random() * (900 - 1) + 1,
      scale: Math.random() * (0.25 - 0.1) + 0.1,
      speedX: Math.random() * 1.5,
      speedY: Math.random() * 1.5,
      speedZ: Math.random() * 1.5,
      directionX: Math.random() < 0.5 ? -1 : 1, // 隨機方向
      directionY: Math.random() < 0.5 ? -1 : 1,
      directionZ: Math.random() < 0.5 ? -1 : 1,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 0.7,
      info: {
        name: doc.data().name,
        keeper: doc.data().nicknames[doc.data().players[0]] + "&" + doc.data().nicknames[doc.data().players[1]] || `培養員 ${index + 1}`,
        createdAt: doc.data().createdAt || `2025-0${(index % 9) + 1}-01`,
        id: doc.data().bio_id || `${index + 1}`,
      },
    }));
    res.json({ bios });
  } catch (error) {
    console.error('Error fetching bios:', error);
    res.status(500).json({ error: 'Failed to fetch bios' });
  }
});

//
// 📌 获取好友信息
//
router.post('/friend', async (req, res) => {
  try {
    const { userId, index } = req.body;
    const friendIds = await getFriends(userId);

    if (!friendIds || friendIds.length === 0) {
      return [];
    }
    const [start, end] = getPageRange(index);
    const userInfo = await getUsersByIds(friendIds, start, end);
    const friendInfo = await getFriendInfo(userId, friendIds);
    function getPageRange(index, pageSize = 6) {
      const start = index * pageSize;
      const end = (index + 1) * pageSize;
      return [start, end];
    }
    console.log(friendInfo)
    const sortedUserInfo = userInfo.sort((a, b) => a.id.localeCompare(b.id));
    const sortedFriendInfo = friendInfo.sort((a, b) => a.id.localeCompare(b.id));
    const newUInfo = sortedUserInfo.slice(start, end);
    const newFInfo = sortedFriendInfo.slice(start, end);
    const count = friendInfo.length;
    res.json({ newUInfo, newFInfo, count });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

module.exports = router;
