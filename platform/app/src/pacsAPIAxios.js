import axios from 'axios';

const pacsAPIAxios = () => {
  const apiUrl = process.env.APP_PUBLIC_API_URL + '/api';
  const token = localStorage.getItem('sessionToken');

  return axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: token ? `Bearer ${token}` : null,
      'Content-Type': 'application/json',
    },
  });
};

export default pacsAPIAxios;
