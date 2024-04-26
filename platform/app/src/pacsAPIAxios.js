import axios from 'axios';

export default () => {
  const apiUrl = 'http://localhost:8000';
  const token = localStorage.getItem('sessionToken');

  return axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: token ? token : null,
      'Content-Type': 'application/json',
    },
  });
};
