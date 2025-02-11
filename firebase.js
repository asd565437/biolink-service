const { initializeApp } = require("firebase/app");
const { getAuth, GoogleAuthProvider } = require("firebase/auth");
const { getFirestore } = require("firebase/firestore");

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEBOvR5IsLUspq0AGF12wQWXA69-XpBxI", // 你的 API 金鑰
  authDomain: "biolink-auth.firebaseapp.com", // 你的專案 ID.firebaseapp.com
  projectId: "biolink-auth", // 你的專案 ID
  messagingSenderId: "507593072695", // 你的訊息發送者 ID
  appId: "1:507593072695:web:d6e8d53729083bc7d91fb2" // 你的應用程式 ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
const db = getFirestore(app);

// Initialize Firebase Authentication
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

module.exports = { db, auth, googleProvider };
