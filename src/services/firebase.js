import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const configuracaoFirebase = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const firebaseJaInicializado = getApps().length > 0;
const aplicativo = firebaseJaInicializado ? getApp() : initializeApp(configuracaoFirebase);

export const autenticacao = firebaseJaInicializado
  ? getAuth(aplicativo)
  : initializeAuth(aplicativo, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export const banco = getFirestore(aplicativo);
