export const logoutUser = (navigate, tenantId) => {
  navigate(`/login?t=${tenantId}`);
  localStorage.removeItem('sessionToken');
};
