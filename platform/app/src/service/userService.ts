export const logoutUser = (navigate, tenantId, forcedLogout = true) => {
  localStorage.removeItem('sessionToken');

  if (forcedLogout) {
    // if unauthorized user error, redirect to login page using window.location.href to clear the cache and state, and avoid re-rendering
    window.location.href = `/login?t=${tenantId}`;
  } else {
    // redirect to login page
    navigate(`/login?t=${tenantId}`);
  }
};
