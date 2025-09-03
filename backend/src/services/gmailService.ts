import { google, Auth } from 'googleapis';

export async function getThreadMessages(auth: Auth.OAuth2Client, threadId: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `threadId:${threadId}`
  });

  const messages = res.data.messages || [];
  return Promise.all(
    messages.map(msg =>
      gmail.users.messages.get({ userId: 'me', id: msg.id! })
    )
  );
}
