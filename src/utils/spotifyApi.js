import axios from 'axios';
import { getValidAccessToken } from './SpotifyAuth';

const spotifyApi = axios.create({
  baseURL: 'https://api.spotify.com/v1',
});

// Add a request interceptor to handle token refresh
spotifyApi.interceptors.request.use(async (config) => {
  try {
    const token = await getValidAccessToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  } catch (error) {
    return Promise.reject(error);
  }
});

// Add a response interceptor to handle errors
spotifyApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired - this shouldn't happen since we check in the request interceptor,
      // but just in case, we'll try one more time
      try {
        const token = await getValidAccessToken();
        const originalRequest = error.config;
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return spotifyApi(originalRequest);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const getPlaylistTracks = (playlistId) => {
  return spotifyApi.get(`/playlists/${playlistId}/tracks`);
};

export const getCurrentUser = () => {
  return spotifyApi.get('/me');
};

export const getUserPlaylists = () => {
  return spotifyApi.get('/me/playlists');
};

export const searchPlaylists = (query) => {
  return spotifyApi.get('/search', {
    params: {
      q: query,
      type: 'playlist',
      limit: 50
    }
  });
};

export const createPlaylist = (userId, { name, description, isPublic }) => {
  return spotifyApi.post(`/users/${userId}/playlists`, {
    name,
    description,
    public: isPublic
  });
};

export const addTracksToPlaylist = (playlistId, uris) => {
  return spotifyApi.post(`/playlists/${playlistId}/tracks`, {
    uris
  });
};

export const searchTracks = (query) => {
  return spotifyApi.get('/search', {
    params: {
      q: query,
      type: 'track',
      limit: 1
    }
  });
};

export const getRecommendations = (params) => {
  return spotifyApi.get('/recommendations', {
    params
  });
};

export default spotifyApi;