import { AgentDoc, DevicePasskeyRecord, UserSessionRecord } from '../types/firestore';

const DEVICE_ID_KEY = 'switchz_device_id_v1';
const SESSION_STORAGE_KEY = 'switchz_passkey_session_v1';
const IDB_NAME = 'switchz_passkey_vault';
const IDB_STORE = 'keys';

export interface StoredSessionMeta {
  sessionToken: string;
  sessionId: string;
  ownerUid: string;
  deviceId: string;
  credentialId?: string;
  userDisplayName: string;
  userEmail: string;
}

export interface PasskeyAuthResponse {
  verified: boolean;
  sessionToken: string;
  session: UserSessionRecord;
  passkey: DevicePasskeyRecord;
  rememberedAgents: AgentDoc[];
  user: {
    uid: string;
    displayName: string;
    email: string;
    mode: 'passkey_sim';
  };
}

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const ab = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = `dev_${crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export function getFriendlyDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'SWITCHZ Device';
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
    ? 'Android'
    : /Mac OS X|Macintosh/i.test(ua)
    ? 'macOS'
    : /Windows/i.test(ua)
    ? 'Windows'
    : /Linux/i.test(ua)
    ? 'Linux'
    : 'Device';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
    ? 'Chrome'
    : /Safari\//i.test(ua)
    ? 'Safari'
    : /Firefox\//i.test(ua)
    ? 'Firefox'
    : 'Browser';
  return `${browser} on ${os}`;
}

export function getStoredSessionMeta(): StoredSessionMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSessionMeta;
    if (!parsed?.sessionToken || !parsed?.ownerUid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredSessionMeta(meta: StoredSessionMeta | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!meta) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(meta));
    }
  } catch {
    // ignore storage errors
  }
}

// IndexedDB vault for subtleCrypto device keys when hardware WebAuthn is blocked by iframe policy
function openKeyVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'credentialId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveVaultKey(credentialId: string, privateKey: CryptoKey, publicKeySpki: string): Promise<void> {
  const db = await openKeyVault();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ credentialId, privateKey, publicKeySpki });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getVaultKey(
  credentialId: string
): Promise<{ credentialId: string; privateKey: CryptoKey; publicKeySpki: string } | null> {
  try {
    const db = await openKeyVault();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(credentialId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function listVaultCredentialIds(): Promise<string[]> {
  try {
    const db = await openKeyVault();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function registerDevicePasskey(params: {
  displayName: string;
  email: string;
  ownerUid?: string;
  agentIds?: string[];
  agentHandles?: string[];
}): Promise<PasskeyAuthResponse> {
  const deviceId = getOrCreateDeviceId();
  const deviceLabel = getFriendlyDeviceLabel();

  const optRes = await fetch('/api/auth/passkey/register-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      ownerUid: params.ownerUid,
      displayName: params.displayName,
      email: params.email,
    }),
  });
  const opts = await optRes.json();
  if (!optRes.ok || !opts?.challenge) {
    throw new Error(opts?.error || 'Could not obtain passkey registration challenge.');
  }

  let credentialId = '';
  let publicKeySpki = '';
  let algorithm: 'WEBAUTHN_FIDO2' | 'DEVICE_KEY_P256' = 'DEVICE_KEY_P256';
  let transports: string[] = ['internal'];
  let clientDataJSON = '';
  let attestationObject = '';
  let signature = '';

  const canTryWebAuthn =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials?.create) &&
    typeof PublicKeyCredential !== 'undefined';

  if (canTryWebAuthn) {
    try {
      const rpId = window.location.hostname;
      const userIdBytes = new TextEncoder().encode(opts.userId || deviceId);
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: fromBase64Url(opts.challenge),
          rp: { name: 'SWITCHZ Agent Directory', id: rpId },
          user: {
            id: userIdBytes,
            name: params.email || `${deviceId}@switchboard.agent`,
            displayName: params.displayName || 'SWITCHZ Member',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
          timeout: 45000,
          attestation: 'none',
        },
      })) as PublicKeyCredential | null;

      if (cred) {
        const resp = cred.response as AuthenticatorAttestationResponse & {
          getPublicKey?: () => ArrayBuffer | null;
          getTransports?: () => string[];
        };
        credentialId = cred.id;
        algorithm = 'WEBAUTHN_FIDO2';
        clientDataJSON = toBase64Url(resp.clientDataJSON);
        attestationObject = toBase64Url(resp.attestationObject);
        const pkBuf = typeof resp.getPublicKey === 'function' ? resp.getPublicKey() : null;
        publicKeySpki = pkBuf ? toBase64(pkBuf) : toBase64(resp.attestationObject);
        transports = typeof resp.getTransports === 'function' ? resp.getTransports() : ['internal'];
      }
    } catch {
      // Fallback cleanly to WebCrypto P-256 Device Passkey Vault (required inside sandboxed iframes)
      credentialId = '';
    }
  }

  if (!credentialId) {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify']
    );
    const spkiBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    publicKeySpki = toBase64(spkiBuf);
    credentialId = `pk_p256_${deviceId.slice(0, 10)}_${Date.now().toString(36)}`;
    const sigBuf = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(opts.challenge)
    );
    signature = toBase64Url(sigBuf);
    algorithm = 'DEVICE_KEY_P256';
    await saveVaultKey(credentialId, keyPair.privateKey, publicKeySpki);
  }

  const verifyRes = await fetch('/api/auth/passkey/register-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge: opts.challenge,
      deviceId,
      deviceLabel,
      ownerUid: opts.userId,
      displayName: params.displayName,
      email: params.email,
      credentialId,
      publicKeySpki,
      algorithm,
      transports,
      clientDataJSON,
      attestationObject,
      signature,
      agentIds: params.agentIds || [],
      agentHandles: params.agentHandles || [],
    }),
  });
  const data = (await verifyRes.json()) as PasskeyAuthResponse & { error?: string };
  if (!verifyRes.ok || !data?.verified) {
    throw new Error(data?.error || 'Passkey verification failed on server.');
  }

  saveStoredSessionMeta({
    sessionToken: data.sessionToken,
    sessionId: data.session.id,
    ownerUid: data.user.uid,
    deviceId,
    credentialId: data.passkey.credentialId,
    userDisplayName: data.user.displayName,
    userEmail: data.user.email,
  });

  return data;
}

export async function authenticateWithDevicePasskey(
  preferredCredentialId?: string
): Promise<PasskeyAuthResponse> {
  const deviceId = getOrCreateDeviceId();

  const optRes = await fetch('/api/auth/passkey/login-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, credentialId: preferredCredentialId }),
  });
  const opts = await optRes.json();
  if (!optRes.ok || !opts?.challenge) {
    throw new Error(opts?.error || 'No passkey registered on this device yet.');
  }

  const candidates: Array<{ credentialId: string; algorithm: 'WEBAUTHN_FIDO2' | 'DEVICE_KEY_P256' }> =
    Array.isArray(opts.allowCredentials) ? opts.allowCredentials : [];

  const target = preferredCredentialId
    ? candidates.find((c) => c.credentialId === preferredCredentialId) || candidates[0]
    : candidates[0];

  if (!target) {
    throw new Error('No registered passkey found for this device.');
  }

  let credentialId = target.credentialId;
  let signature = '';
  let clientDataJSON = '';
  let authenticatorData = '';

  if (
    target.algorithm === 'WEBAUTHN_FIDO2' &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    navigator.credentials?.get
  ) {
    const fidoCreds = candidates
      .filter((c) => c.algorithm === 'WEBAUTHN_FIDO2')
      .map((c) => ({
        type: 'public-key' as const,
        id: fromBase64Url(c.credentialId),
      }));
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: fromBase64Url(opts.challenge),
        allowCredentials: fidoCreds,
        userVerification: 'preferred',
        timeout: 45000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('Passkey sign-in cancelled.');
    }
    const resp = assertion.response as AuthenticatorAssertionResponse;
    credentialId = assertion.id;
    signature = toBase64Url(resp.signature);
    clientDataJSON = toBase64Url(resp.clientDataJSON);
    authenticatorData = toBase64Url(resp.authenticatorData);
  } else {
    // Verify with IndexedDB ECDSA P-256 device key
    const vaultIds = await listVaultCredentialIds();
    const usableId = vaultIds.includes(target.credentialId) ? target.credentialId : vaultIds[0];
    const entry = usableId ? await getVaultKey(usableId) : null;
    if (!entry) {
      throw new Error('Device key not found in browser vault — register a new passkey.');
    }
    credentialId = entry.credentialId;
    const sigBuf = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      entry.privateKey,
      new TextEncoder().encode(opts.challenge)
    );
    signature = toBase64Url(sigBuf);
  }

  const verifyRes = await fetch('/api/auth/passkey/login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge: opts.challenge,
      deviceId,
      credentialId,
      signature,
      clientDataJSON,
      authenticatorData,
    }),
  });
  const data = (await verifyRes.json()) as PasskeyAuthResponse & { error?: string };
  if (!verifyRes.ok || !data?.verified) {
    throw new Error(data?.error || 'Passkey authorization failed.');
  }

  saveStoredSessionMeta({
    sessionToken: data.sessionToken,
    sessionId: data.session.id,
    ownerUid: data.user.uid,
    deviceId,
    credentialId: data.passkey.credentialId,
    userDisplayName: data.user.displayName,
    userEmail: data.user.email,
  });

  return data;
}

export async function restoreBackendSession(): Promise<{
  session: UserSessionRecord;
  passkeys: DevicePasskeyRecord[];
  rememberedAgents: AgentDoc[];
} | null> {
  const meta = getStoredSessionMeta();
  const deviceId = getOrCreateDeviceId();
  try {
    const res = await fetch(`/api/auth/session?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: meta?.sessionToken ? { Authorization: `Bearer ${meta.sessionToken}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.authenticated || !data?.session) return null;
    return {
      session: data.session as UserSessionRecord,
      passkeys: Array.isArray(data.passkeys) ? data.passkeys : [],
      rememberedAgents: Array.isArray(data.rememberedAgents) ? data.rememberedAgents : [],
    };
  } catch {
    return null;
  }
}

export async function linkAgentsToDeviceSession(params: {
  ownerUid: string;
  agentIds?: string[];
  agentHandles?: string[];
  activeAgentId?: string;
  activeAgentHandle?: string;
}): Promise<{ rememberedAgents: AgentDoc[] } | null> {
  const meta = getStoredSessionMeta();
  const deviceId = getOrCreateDeviceId();
  try {
    const res = await fetch('/api/auth/session/link-agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(meta?.sessionToken ? { Authorization: `Bearer ${meta.sessionToken}` } : {}),
      },
      body: JSON.stringify({
        ownerUid: params.ownerUid,
        deviceId,
        credentialId: meta?.credentialId,
        sessionId: meta?.sessionId,
        agentIds: params.agentIds || [],
        agentHandles: params.agentHandles || [],
        activeAgentId: params.activeAgentId,
        activeAgentHandle: params.activeAgentHandle,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { rememberedAgents: AgentDoc[] };
  } catch {
    return null;
  }
}

export async function fetchDevicePasskeys(ownerUid?: string): Promise<DevicePasskeyRecord[]> {
  const deviceId = getOrCreateDeviceId();
  try {
    const qs = new URLSearchParams({ deviceId });
    if (ownerUid) qs.set('ownerUid', ownerUid);
    const res = await fetch(`/api/auth/passkeys?${qs.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.passkeys) ? data.passkeys : [];
  } catch {
    return [];
  }
}

export async function revokeDevicePasskey(credentialId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    });
    const meta = getStoredSessionMeta();
    if (res.ok && meta?.credentialId === credentialId) {
      saveStoredSessionMeta(null);
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function logoutBackendSession(): Promise<void> {
  const meta = getStoredSessionMeta();
  const deviceId = getOrCreateDeviceId();
  saveStoredSessionMeta(null);
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(meta?.sessionToken ? { Authorization: `Bearer ${meta.sessionToken}` } : {}),
      },
      body: JSON.stringify({ sessionId: meta?.sessionId, deviceId }),
    });
  } catch {
    // non-blocking
  }
}
