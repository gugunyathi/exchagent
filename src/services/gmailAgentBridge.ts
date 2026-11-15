import { getWorkspaceAccessToken } from '../lib/firebase';

export async function listRecentGmailThreads(): Promise<{
  live: boolean;
  subjects: string[];
}> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    return { live: false, subjects: [] };
  }
  try {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return { live: false, subjects: [] };
    const data = await res.json();
    const ids: string[] = (data.messages ?? []).map((m: { id: string }) => m.id);
    return {
      live: true,
      subjects: ids.map((id) => `Gmail Thread #${id}`),
    };
  } catch {
    return { live: false, subjects: [] };
  }
}

export async function sendEmailViaGmailApi(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    return {
      sent: false,
      error: 'Gmail OAuth token not active — delivered via native @switchboard.agent relay.',
    };
  }

  const rawLines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.body,
  ].join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(rawLines)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, error: `Gmail API ${res.status}: ${errText.slice(0, 100)}` };
    }
    const json = await res.json();
    return { sent: true, messageId: json.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Gmail send failed' };
  }
}
