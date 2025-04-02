const CLIENT_ID = "2ddccc85e3ac476695961adbc36aa012";
const REDIRECT_URI = "http://localhost:3000";
const SCOPES = ["playlist-read-private", "user-library-read", "user-read-private", "user-read-email"];

export const getSpotifyAuthURL = () => {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.append("client_id", CLIENT_ID);
  url.searchParams.append("response_type", "token");
  url.searchParams.append("redirect_uri", REDIRECT_URI);
  url.searchParams.append("scope", SCOPES.join(" "));
  return url.toString();
};
