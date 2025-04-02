import React, { useEffect, useState } from "react";
import axios from "axios";
import TierList from "../components/TierList";

const TierListPage = ({ playlist }) => {
  const [songs, setSongs] = useState([]);

  useEffect(() => {
    axios
      .get(playlist.tracks.href, {
        headers: { Authorization: `Bearer ${playlist.accessToken}` },
      })
      .then((res) => setSongs(res.data.items.map((t) => t.track)))
      .catch(console.error);
  }, [playlist]);

  return <TierList songs={songs} />;
};

export default TierListPage;
