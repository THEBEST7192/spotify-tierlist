const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = process.env.REACT_APP_SPOTIFY_REDIRECT_URI;
const SCOPES = process.env.REACT_APP_SPOTIFY_SCOPES ? 
  process.env.REACT_APP_SPOTIFY_SCOPES.split(', ') : 
  [];

export const getSpotifyAuthURL = () => {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.append("client_id", CLIENT_ID);
  url.searchParams.append("response_type", "token");
  url.searchParams.append("redirect_uri", REDIRECT_URI);
  url.searchParams.append("scope", SCOPES.join(" "));
  return url.toString();
};
