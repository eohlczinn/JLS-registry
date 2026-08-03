import axios from 'axios';

export default axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://jls-registry-api.vercel.app',
  headers: { 'Content-Type': 'application/json' }
});
