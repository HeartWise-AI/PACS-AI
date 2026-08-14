import axios from 'axios';
import { handleAccountSuspendedError } from './service/accountAccessSession';

const pacsAPIAxios = () => {
  const apiUrl = process.env.APP_PUBLIC_API_URL;
  const token = localStorage.getItem('sessionToken');

  const api = axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: token ? `Bearer ${token}` : null,
      'Content-Type': 'application/json',
    },
  });

  api.interceptors.response.use(
    response => response,
    error => {
      handleAccountSuspendedError(error);
      return Promise.reject(error);
    }
  );

  return api;
};

export default pacsAPIAxios;
