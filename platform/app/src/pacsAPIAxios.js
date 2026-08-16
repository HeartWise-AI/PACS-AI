import axios from 'axios';
import { handleAccountSuspendedError } from './service/accountAccessSession';
import { handlePolicyAcceptanceRequiredError } from './service/policyAcceptanceSession';

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

  api.interceptors.request.use(config => {
    const currentToken = localStorage.getItem('sessionToken');

    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    } else {
      delete config.headers.Authorization;
    }

    return config;
  });

  api.interceptors.response.use(
    response => response,
    error => {
      handleAccountSuspendedError(error);
      handlePolicyAcceptanceRequiredError(error);
      return Promise.reject(error);
    }
  );

  return api;
};

export default pacsAPIAxios;
