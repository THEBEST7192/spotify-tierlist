/**
 * Spotify Authentication Utilities
 * Based on: https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
 */

/**
 * Refreshes the Spotify access token using the refresh token
 * @param {string} refreshToken - The refresh token from the previous authorization
 * @param {string} clientId - The Spotify client ID for the application
 * @returns {Promise<Object>} - Object containing the new access token and possibly a new refresh token
 */
export const refreshAccessToken = async (refreshToken, clientId) => {
  if (!refreshToken || !clientId) {
    throw new Error("Refresh token and client ID are required");
  }

  const url = "https://accounts.spotify.com/api/token";
  
  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    }),
  };
  
  try {
    const response = await fetch(url, payload);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Use existing refresh token if a new one isn't provided
      expires_in: data.expires_in,
      token_type: data.token_type
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw error;
  }
};

/**
 * Returns the timestamp when a token will expire
 * @param {number} expiresIn - Seconds until token expiration
 * @returns {number} - Timestamp in milliseconds when token will expire
 */
export const calculateExpiryTime = (expiresIn) => {
  return Date.now() + (expiresIn * 1000);
};

/**
 * Checks if the current access token is expired or about to expire
 * @param {number} expiryTime - Timestamp when token expires
 * @param {number} bufferTime - Buffer time in ms before expiry to refresh (default: 5 minutes)
 * @returns {boolean} - Whether the token is expired or about to expire
 */
export const isTokenExpired = (expiryTime, bufferTime = 300000) => {
  if (!expiryTime) return true;
  
  // Consider token expired if it's within buffer time of expiry
  return Date.now() >= (expiryTime - bufferTime);
}; 