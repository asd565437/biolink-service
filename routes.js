const express = require("express");
const bcrypt = require("bcrypt");
const { getFirestore,getCountFromServer, collection, query, where, getDocs, doc, setDoc, getDoc } = require("firebase/firestore");
const { db, firebaseConfig } = require("./firebase.js"); // 确保路径正确
const { initializeApp } = require("firebase/app");

const router = express.Router();
const app = initializeApp(firebaseConfig);
const firestoreInstance = getFirestore(app);


router.post('/register', async (req, res) => {
  const { account, password, nickName, googleLogin, photoUrl } = req.body;

  if (!googleLogin) {
    if (!account || !password || !nickName) {
      return res.status(400).json({ error: '請填寫所有必填欄位' });
    }
  }

  try {
    // 检查用户是否存在
    const userSnap = await getDocs(query(collection(firestoreInstance, "player"), where("account", "==", account)));

    if (!userSnap.empty) {
      return res.status(400).json({ error: '帳號已存在' });
    }
    const q = query(collection(firestoreInstance, "player")); // 建立查詢
    const snapshot = await getCountFromServer(q); // 只取得數量
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    const user_id='biolink'+(snapshot.data().count+1);
    // ✅ 使用 `setDoc()` 让 email 作为文档 ID
    const userRef = doc(firestoreInstance, "player", user_id);
    await setDoc(userRef, {
      id: user_id,
      account: account,
      nickname: nickName,
      password: hashedPassword,
      bio_count: 0,
      photoURL: photoUrl || null,
    });

    res.status(201).json({ message: '註冊成功',
      user: {
        id: user_id
    }});
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/login", async (req, res) => {
  const { account, password, googleLogin } = req.body;

  if (!googleLogin) {
    if (!account || !password) {
      return res.status(400).json({ error: "請輸入帳號密碼" });
    }
  }

  try {
    const usersRef = collection(firestoreInstance, "player");
    const usersQuery = query(usersRef, where("account", "==", account));
    const usersSnap = await getDocs(usersQuery);

    if (usersSnap.empty) {
      return res.status(404).json({ error: "帳號不存在" });
    }

    const user = usersSnap.docs[0].data();
    if (!googleLogin) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "密碼錯誤" });
      }
    }

    res.status(200).json({
      message: "登入成功",
      user: {
        account: user.account,
        nickname: user.nickname,
      },
    });

  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post('/question', async (req, res) => {
  const { question_id } = req.body;

  if (!question_id) {
    return res.status(400).json({ error: '請提供 question_id' });
  }

  try {
    const questionRef = doc(firestoreInstance, 'question', String(question_id));
    const questionSnap = await getDoc(questionRef);

    if (!questionSnap.exists()) {
      return res.status(404).json({ error: '問題不存在' });
    }

    const questionData = questionSnap.data();

    res.status(200).json({
      message: '獲取成功',
      question_list: {
        question: questionData.question,
        answers: questionData.options[0] + ", " + questionData.options[1]
      }
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/photo', async (req, res) => {
  const { account, photoURL } = req.body;

  if (!photoURL) {
    return res.status(400).json({ error: '請選擇圖片' });
  }

  try {
    const photoRef = doc(firestoreInstance, 'player', account);
    await setDoc(photoRef, {
      photoURL: photoURL,
    }, { merge: true });

    res.status(200).json({
      message: '設定圖片成功',
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
