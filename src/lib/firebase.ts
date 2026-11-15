import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const typedConfig = firebaseConfig as {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(typedConfig);
  authInstance = getAuth(app);
  dbInstance = typedConfig.firestoreDatabaseId
    ? getFirestore(app, typedConfig.firestoreDatabaseId)
    : getFirestore(app);
} catch (err) {
  console.warn('Firebase initialization skipped, using local adapter:', err);
}

export const auth = authInstance;
export const db = dbInstance;

// In-memory Workspace OAuth access token (never stored in localStorage/sessionStorage)
let cachedWorkspaceToken: string | null = null;
let isSigningIn = false;

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceToken;
}

export function clearWorkspaceAccessToken(): void {
  cachedWorkspaceToken = null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline or unconfigured — local persistence adapter active.');
    }
    return false;
  }
}

export function subscribeAuth(
  onUser: (user: User | null, accessToken: string | null) => void
): () => void {
  if (!auth) {
    onUser(null, null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedWorkspaceToken = null;
      onUser(null, null);
    } else if (!isSigningIn) {
      onUser(user, cachedWorkspaceToken);
    }
  });
}

export async function signInWithGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized.');
  }
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedWorkspaceToken = credential?.accessToken ?? null;
    return {
      user: result.user,
      accessToken: cachedWorkspaceToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutFirebase(): Promise<void> {
  cachedWorkspaceToken = null;
  if (auth) {
    await signOut(auth);
  }
}
