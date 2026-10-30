
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDUNeWZ69E3IC50s1Vx1sPXLCwKaMvA4R4",
  authDomain: "rb-tech-solution.firebaseapp.com",
  projectId: "rb-tech-solution",
  storageBucket: "rb-tech-solution.firebasestorage.app",
  messagingSenderId: "280273384965",
  appId: "1:280273384965:web:8fb65db00d084eb1010e6c",
  measurementId: "G-SCH6TQ27JH"
};

// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);

// AUTHENTICATION
export const auth = getAuth(app);

// FIRESTORE DATABASE
export const db = getFirestore(app);

// LOGIN PERSISTENCE
export const authReady = setPersistence(
  auth,
  browserLocalPersistence
);

export default app;
