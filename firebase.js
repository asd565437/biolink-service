import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBEBOvR5IsLUspq0AGF12wQWXA69-XpBxI",//你的API金鑰
  authDomain: "biolink-auth.firebaseapp.com",//你的專案ID.firebaseapp.com
  projectId: "biolink-auth",//你的專案ID
  messagingSenderId: "507593072695",//你的訊息發送者ID
  appId: "1:507593072695:web:d6e8d53729083bc7d91fb2"//你的應用程式ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const db = getFirestore(app);
// Initialize Firebase Authentication
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
