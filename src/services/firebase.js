import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

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

export const autenticacao = firebaseJaInicializado || Platform.OS === "web"
  ? getAuth(aplicativo)
  : initializeAuth(aplicativo, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export const banco = getFirestore(aplicativo);
export const funcoes = getFunctions(aplicativo, "southamerica-east1");

const hostEmuladores = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
if (__DEV__ && hostEmuladores && !firebaseJaInicializado) {
  connectAuthEmulator(autenticacao, `http://${hostEmuladores}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(banco, hostEmuladores, 8080);
  connectFunctionsEmulator(funcoes, hostEmuladores, 5001);
}
