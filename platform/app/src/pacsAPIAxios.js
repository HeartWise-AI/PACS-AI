import axios from 'axios';

export default () => {
  const apiUrl = process.env.REACT_APP_PUBLIC_API_URL;
  const token = localStorage.getItem('sessionToken');

  return axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: token ? token : null,
      'Content-Type': 'application/json',
    },
  });
};
