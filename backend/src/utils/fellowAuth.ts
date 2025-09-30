import axios from "axios";

axios.interceptors.request.use((config) => {
  config.headers = {
    ...config.headers,
    "X-API-KEY": FELLOW_API_KEY
  };
  return config;
});// TODO: implement
