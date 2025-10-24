# Spotify Tierlist Maker

A web application that allows you to create tier lists from your Spotify playlists. Organize your favorite songs into tiers (S, A, B, C, D, E, F or your own) using a drag-and-drop interface, and get personalized song recommendations based on your tier rankings.

I am hosting the latest version of the project here: [tierlistsforspotify.party](https://tierlistsforspotify.party)

I have not recived extended qouta yet, so I will have to manually approve accounts that can use the API, so if you want to use it please message me on Discord (@thebest7192) or host it yourself.

## Features

- Connect with your Spotify account
- Browse and select from your playlists
- Search playlists by name or description
- Drag and drop songs into different tiers
- Create custom tiers for your tierlist
- Export your tier list as an image
- View album covers for each song
- Get personalized song recommendations based on your tier rankings
- Control recommendation variety with the Exploration Depth slider
- Responsive design for desktop and mobile (Except for a Nokia 8110, I checked)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Spotify API account (for song metadata, acquisition of playlitsts and search)
- Last.fm API account (for recommendations)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/THEBEST7192/spotify-tierlist
```

2. Install frontend dependencies:
```bash
cd spotify-tierlist
npm install
```

3. Install backend dependencies:
```bash
cd api
npm install
cd ..
```

4. Create a `.env.local` file in the root directory by copying `.env.example` and fill in your API credentials:
```bash
cp .env.example .env.local
```
Then, open `.env.local` and add your API credentials:
```bash
VITE_SPOTIFY_CLIENT_ID=YOUR_CLIENT_ID
VITE_SPOTIFY_REDIRECT_URI=YOUR_REDIRECT_URI
LASTFM_API_KEY=YOUR_LASTFM_API_KEY
```

The `VITE_SPOTIFY_CLIENT_ID` and `VITE_SPOTIFY_REDIRECT_URI` are for the frontend. The `LASTFM_API_KEY` is for the backend server.

The client id and redirect URI should be the same as the ones you set in the Spotify developer console, if running locally set the redirect URI to `http://127.0.0.1:3000` in the Spotify developer console and in the environment file.

The scope is handled in the [SpotifyAuth.js](src/utils/SpotifyAuth.js) file in the `getSpotifyAuthURL` function.

5. Start the backend server:
```bash
npm run server
```

6. Build and serve the frontend app:
```bash
npm run build
serve -s build
```
or
```
npm run start
```

The app will be available at the address provided in the terminal (e.g., `http://127.0.0.1:3000`). Please note that you should use `http://127.0.0.1:PORT` instead of `http://localhost:PORT` to access the application.

## Usage

1. Click "Login with Spotify" to connect your account
2. Select a playlist from your library
3. Drag songs into different tiers (S, A, B, C, D, E, F, or Unranked)
4. Click "Export as Image" to save your tier list
5. Click "Get Recommendations Based on Your Tiers" to generate personalized song recommendations
   - Songs in S and A tiers have the highest **AMOUNT_OF_SONGS**, thus the greatest influence on recommendations
   - Adjust **Exploration Depth** (0–20) to start further down Last.fm’s list for more variety
   - Recommendations are based on similar tracks from Last.fm
   - Each recommendation shows which song and tier influenced it
   - See [RECOMMENDATION_ALGORITHM.md](DOCS_AND_OTHER_INFO/RECOMMENDATION_ALGORITHM.md) for more information

6. Konami Code
   - Type the Konami Code (Up, Up, Down, Down, Left, Right, Left, Right, B, A) or search for `wwssadadab` to activate the Konami Code
   - All song limits are removed (This does not change how the Spotify/LastFM API works*)
   - You can deactivate the Konami Code effects by activating it again

7. Debug Mode
   - Type "debugmode" in the console to activate debug mode
   - Debug mode will show the camera feed that [CinemaPoseDetector](src/components/CinemaPoseDetector.jsx) is using to detect the pose of the user
   - More debugging will come soon

## Technologies Used

- React
- React Beautiful DND (for drag and drop functionality)
- HTML2Canvas (for image export)
- Axios (for API requests)
- Create React App
- Spotify Web API (for song data and music playback)
- Last.fm API (for music recommendations)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to Spotify for providing the Web API
- Thanks to Last.fm for their music recommendation API
- Inspired by tier list makers in gaming communities and the digital influencer DougDoug
- Built with Create React App
- [JFXR](https://jfxr.frozenfractal.com) for the Konami Code sounds

## Support

Send me a message on Discord (@thebest7192)

## Troubleshooting

If you encounter any issues:

1. Ensure your Spotify API credentials are correct
2. Check your internet connection
3. Clear your browser cache
4. Try running npm install again
5. If you get any errors when logging in to Spotify it is most likely because of the user not being approved in the developer console of Spotify. Make sure that you have approved the email address of the user trying to log on too.

## Additional Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [Last.fm API Documentation](https://www.last.fm/api)
- [Unoffical Last.fm API Documentation](https://lastfm-docs.github.io/api-docs/)
- [Create React App Documentation](https://create-react-app.dev/docs)
- [React Beautiful DND Documentation](https://react-beautiful-dnd.netlify.app/docs/getting-started)
- [HTML2Canvas Documentation](https://html2canvas.hertzen.com/documentation)

## Contact
@thebest7192 on Discord