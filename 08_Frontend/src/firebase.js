import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";


const firebaseConfig = {
  apiKey: "AIzaSyBd-LaDdqKj65QLT-bxWWHnKmYfJUMcYPY",
  authDomain: "cold-chain-system-ec795.firebaseapp.com",
  databaseURL: "https://cold-chain-system-ec795-default-rtdb.firebaseio.com",
  projectId: "cold-chain-system-ec795",
  storageBucket: "cold-chain-system-ec795.firebasestorage.app",
  messagingSenderId: "877975062148",
  appId: "1:877975062148:web:52fef581008cd1a2a6e4d1",
  measurementId: "G-JBH3ND48QT"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);