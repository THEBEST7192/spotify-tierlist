import React, { useEffect, useState } from "react";
import Home from "./pages/Home";
import "./App.css";

function App() {
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    // Check the URL hash for the Spotify token
    const hash = window.location.hash;
    let token = null;
    if (hash) {
      token = new URLSearchParams(hash.substring(1)).get("access_token");
      window.location.hash = ""; // Clean the URL
    }
    if (token) {
      setAccessToken(token);
    }
  }, []);

  return (
    <div className="App">
      <Home accessToken={accessToken} setAccessToken={setAccessToken} />
    </div>
  );
}

export default App;
