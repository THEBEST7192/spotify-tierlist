const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = process.env.REACT_APP_SPOTIFY_REDIRECT_URI;
const SCOPES = process.env.REACT_APP_SPOTIFY_SCOPES ? 
  process.env.REACT_APP_SPOTIFY_SCOPES.split(', ') : 
  [];

export const getSpotifyAuthURL = () => {
  const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  const redirectUri = window.location.origin;
  const scope = 'playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-read-private user-read-email';
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('response_type', 'token');
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', scope);
  authUrl.searchParams.append('show_dialog', 'true');
  
  return authUrl.toString();
};
