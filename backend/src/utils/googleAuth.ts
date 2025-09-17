import axios from "axios";

export async function getAccessToken() {
  const response = await axios.post("https://oauth2.googleapis.com/token", null, {
    params: {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    },
  });

  return response.data.access_token as string;
}
