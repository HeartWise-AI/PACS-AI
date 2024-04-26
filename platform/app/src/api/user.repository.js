import axios from 'axios';
// const dotenv = require('dotenv');
// dotenv.config();
// require('dotenv').config();
// const API_URL = process.env.REACT_APP_PUBLIC_API_URL;
const API_URL = 'http://localhost:8000';

export function Login(tenantId, idToken) {
  return axios.post(`${API_URL}/v1/iam/login`, {
    tenantId,
    idToken,
  });
}
