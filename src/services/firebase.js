import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseReady = Object.values(firebaseConfig).every(Boolean);

let app = null;
let auth = null;
let db = null;

if (isFirebaseReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

function assertFirebaseReady() {
  if (!isFirebaseReady || !auth || !db) {
    throw new Error('Configuration Firebase incomplète.');
  }
}

function mapAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/configuration-not-found') {
    return new Error('Firebase Authentication non configurée: activez Authentication dans Firebase Console.');
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error('Connexion Email/mot de passe desactivée: activez Email/Password dans Firebase Authentication.');
  }
  if (code === 'auth/invalid-api-key') {
    return new Error('API key Firebase invalide: vérifiez VITE_FIREBASE_API_KEY dans .env.');
  }
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return new Error('Email ou mot de passe invalide.');
  }
  if (code === 'auth/invalid-email') {
    return new Error('Format d\'email invalide.');
  }
  if (code === 'auth/email-already-in-use') {
    return new Error('Cet email est deja utilise.');
  }
  if (code === 'auth/weak-password') {
    return new Error('Mot de passe trop faible (6 caracteres minimum).');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Réseau indisponible: impossible de joindre Firebase.');
  }
  return error instanceof Error ? error : new Error(String(error || 'Erreur Firebase inconnue'));
}

export function observeAuthState(onChange) {
  assertFirebaseReady();
  return onAuthStateChanged(auth, onChange);
}

export function getCurrentUser() {
  if (!isFirebaseReady || !auth) return null;
  return auth.currentUser;
}

export async function loginWithEmail(email, password) {
  assertFirebaseReady();
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function registerWithEmail(email, password) {
  assertFirebaseReady();
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function logoutFromCloud() {
  assertFirebaseReady();
  try {
    await signOut(auth);
  } catch (error) {
    throw mapAuthError(error);
  }
}

export function subscribeToHousehold(householdId, onData, onError) {
  assertFirebaseReady();
  return onSnapshot(doc(db, 'households', householdId), snapshot => {
    onData(snapshot.exists() ? snapshot.data() : null);
  }, onError);
}

export async function saveHouseholdData(householdId, data) {
  assertFirebaseReady();
  await setDoc(doc(db, 'households', householdId), {
    appliances: data.appliances,
    products: data.products,
    schemaVersion: 1,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
