import Api from './../pacsAPIAxios';

export default {
  Login(data) {
    return Api()
      .post(`/v1/iam/login`, data)
      .then(x => x.data);
  },
  GetCurrentUser() {
    return Api()
      .get(`/v1/user/me`)
      .then(x => x.data);
  },
};
