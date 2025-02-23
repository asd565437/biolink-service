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
  console.log(friends)
  return friends;
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
      return res.status(300).json({ error: "請輸入帳號密碼" });
    }

    // 查询用户
    const usersSnap = await getDocs(query(collection(firestoreInstance, "player"), where("account", "==", account)));

    if (usersSnap.empty) {
      return res.status(303).json({ error: "帳號不存在" });
    }

    const user = usersSnap.docs[0].data();

    // 处理密码验证
    if (!googleLogin) {
      const isPasswordValid = await bcrypt.compare(String(password || ""), String(user.password || ""));
      if (!isPasswordValid) {
        return res.status(301).json({ error: "密碼錯誤" });
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
//
// 📌 获取 Bio 信息
//
router.post('/bio', async (req, res) => {
  try {
    const { userId } = req.body;
    const biosSnap = await getDocs(
      query(collection(firestoreInstance, 'bio'), where("user_id", "==", userId))
    );

    const bios = biosSnap.docs.map(doc => doc.data()).slice(0, 8);
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
    const { userId } = req.body;
    console.log(userId)
    const friends = getFriends(userId);
    res.json({ friends });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

module.exports = router;
