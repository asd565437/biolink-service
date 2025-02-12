require("dotenv").config();
const { initializeApp } = require("firebase/app");
const { getAuth, GoogleAuthProvider } = require("firebase/auth");
const { getFirestore } = require("firebase/firestore");

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};
// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Firestore 数据库
const db = getFirestore(app);

// 初始化 Firebase 认证
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

module.exports = { db, auth, googleProvider, firebaseConfig };
