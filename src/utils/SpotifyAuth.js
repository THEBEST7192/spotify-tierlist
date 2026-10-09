export const refreshAccessToken = async () => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const refreshToken = localStorage.getItem('refresh_token');

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('expires_at', Date.now() + (data.expires_in * 1000));
  if (data.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token);
  }

  return data;
};

export const getValidAccessToken = async () => {
  const expiresAt = localStorage.getItem('expires_at');
  const accessToken = localStorage.getItem('access_token');

  if (!accessToken) {
    throw new Error('No access token available');
  }

  // If token is expired or will expire in next 5 minutes, refresh it
  if (!expiresAt || Date.now() > (Number(expiresAt) - 300000)) {
    const newTokens = await refreshAccessToken();
    return newTokens.access_token;
  }

  return accessToken;
};
