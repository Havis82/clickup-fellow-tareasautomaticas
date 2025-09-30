import { getFellowAuthHeaders } from "../utils/fellowAuth";
import axios from "axios";

export async function fetchMeetingTranscription(meetingId: string) {
  const url = `${process.env.FELLOW_API_BASE_URL}/meetings/${meetingId}/transcription`;
  const headers = getFellowAuthHeaders();

  const response = await axios.get(url, { headers });
  return response.data;
}
