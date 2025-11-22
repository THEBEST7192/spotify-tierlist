import axios from 'axios';

// Backend API base URL - use explicit localhost in dev, relative in prod
const API_BASE_URL = import.meta.env.VITE_SPOTIFY_REDIRECT_URI && import.meta.env.VITE_SPOTIFY_REDIRECT_URI.includes('127.0.0.1') ? 'http://localhost:3001' : '';
const API_TIMEOUT_MS = Number(import.meta.env.VITE_BACKEND_TIMEOUT_MS) || 25000;

// Create axios instance with base configuration
const backendApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});

/**
 * Get similar tracks from Last.fm via backend API
 * @param {string} artist - Artist name
 * @param {string} track - Track name
 * @returns {Promise<Object>} Last.fm similar tracks response
 */
export const getSimilarTracksFromBackend = async (artist, track) => {
  try {
    const response = await backendApi.get('/api/similar-tracks', {
      params: {
        artist: artist,
        track: track
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching similar tracks from backend:', error);
    throw error;
  }
};

/**
 * Get similar artists from Last.fm via backend API
 * @param {string} artist - Artist name
 * @param {number} limit - Number of similar artists to fetch (default: 10)
 * @returns {Promise<Object>} Last.fm similar artists response
 */
export const getSimilarArtistsFromBackend = async (artist, limit = 10) => {
  try {
    const response = await backendApi.get('/api/similar-artists', {
      params: {
        artist: artist,
        limit: limit
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching similar artists from backend:', error);
    throw error;
  }
};

/**
 * Check if backend API is available
 * @returns {Promise<boolean>} True if backend is available
 */
export const checkBackendHealth = async () => {
  try {
    const response = await backendApi.get('/health');
    return response.status === 200;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
};

/**
 * Create a tierlist document in the backend
 * @param {Object} payload - Tierlist payload matching backend expectations
 * @returns {Promise<Object>} Created tierlist document
 */
export const createTierlist = async (payload) => {
  const response = await backendApi.post('/api/tierlists', payload);
  return response.data;
};

/**
 * Update an existing tierlist by shortId
 * @param {string} shortId - Tierlist short identifier
 * @param {Object} payload - Update payload (must include spotifyUserId)
 * @returns {Promise<Object>} Updated tierlist document
 */
export const updateTierlist = async (shortId, payload) => {
  const response = await backendApi.put(`/api/tierlists/${shortId}`, payload);
  return response.data;
};

/**
 * Fetch a tierlist by shortId
 * @param {string} shortId - Tierlist short identifier
 * @returns {Promise<Object>} Tierlist document
 */
export const getTierlist = async (shortId) => {
  const response = await backendApi.get(`/api/tierlists/${shortId}`);
  return response.data;
};

export const toggleTierlistPrivacy = async (shortId, spotifyUserId) => {
  const response = await backendApi.patch(`/api/tierlists/${shortId}/privacy`, {
    spotifyUserId
  });
  return response.data;
};

export const deleteTierlist = async (shortId, spotifyUserId) => {
  const response = await backendApi.delete(`/api/tierlists/${shortId}`, {
    data: { spotifyUserId }
  });
  return response.data;
};

/**
 * Fetch public tierlists from the backend API
 * @param {Object} params - Optional query parameters
 * @returns {Promise<Object>} Public tierlists response
 */
export const getPublicTierlists = async (params = {}) => {
  const response = await backendApi.get('/api/tierlists/public', { params });
  return response.data;
};

/**
 * Fetch the current user's tierlists from the backend API
 * @param {string} spotifyUserId - Spotify user ID
 * @returns {Promise<Object>} User's tierlists response
 */
export const getUserTierlists = async (spotifyUserId) => {
  const response = await backendApi.get('/api/tierlists/user/self', {
    params: { spotifyUserId }
  });
  return response.data;
};

export default backendApi;