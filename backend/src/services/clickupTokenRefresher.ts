import axios from 'axios';

interface TokenResponse {
  access_token: string;
  // Add other fields if needed
}

export async function refreshToken(refreshToken: string): Promise<string> {
  try {
    const response = await axios.post<TokenResponse>('https://api.clickup.com/api/v2/oauth/token', {
      client_id: process.env.CLICKUP_CLIENT_ID,
      client_secret: process.env.CLICKUP_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw new Error('Failed to refresh token');
  }
}