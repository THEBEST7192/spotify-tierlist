import axios from 'axios';

// Backend API base URL - use explicit localhost in dev, relative in prod
const API_BASE_URL = import.meta.env.VITE_SPOTIFY_REDIRECT_URI && import.meta.env.VITE_SPOTIFY_REDIRECT_URI.includes('localhost') ? 'http://localhost:3001' : '';

// Create axios instance with base configuration
const backendApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
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

export default backendApi;