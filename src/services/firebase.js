import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
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
    return new Error('Firebase Authentication non configurée: activez Authentication puis Anonymous dans Firebase Console.');
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error('Connexion anonyme désactivée: activez Anonymous dans Firebase Authentication.');
  }
  if (code === 'auth/invalid-api-key') {
    return new Error('API key Firebase invalide: vérifiez VITE_FIREBASE_API_KEY dans .env.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Réseau indisponible: impossible de joindre Firebase.');
  }
  return error instanceof Error ? error : new Error(String(error || 'Erreur Firebase inconnue'));
}

export async function signInToCloud() {
  assertFirebaseReady();
  if (auth.currentUser) return auth.currentUser;
  try {
    const credential = await signInAnonymously(auth);
    return credential.user;
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
