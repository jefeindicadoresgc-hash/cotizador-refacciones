import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Credenciales reales de tu proyecto Hyundai
const firebaseConfig = {
    apiKey: "AIzaSyCcA4WzZolfHyfVE7YZso37iAZn5Ppt7hI",
    authDomain: "refacciones-hyundai.firebaseapp.com",
    projectId: "refacciones-hyundai",
    storageBucket: "refacciones-hyundai.firebasestorage.app",
    messagingSenderId: "866017744551",
    appId: "1:866017744551:web:32e03be4b8152f504aad82"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Exportamos la base de datos (Firestore) para que app.js, inventario.js, etc., la puedan usar
export const db = getFirestore(app);