import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAYlWOAGzN6Ys1q94t3J8LJ6m81I7CeNVo",
  authDomain: "joinroom-56600.firebaseapp.com",
  projectId: "joinroom-56600",
  storageBucket: "joinroom-56600.firebasestorage.app",
  messagingSenderId: "159005762865",
  appId: "1:159005762865:web:43cb914c9613e9b045fc10",
  measurementId: "G-XK8S21JJRY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
