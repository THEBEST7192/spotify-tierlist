# Spotify Tierlist Maker

A web application that allows you to create tier lists from your Spotify playlists. Organize your favorite songs into tiers (S, A, B, C, D, E, F) using a drag-and-drop interface, and get personalized song recommendations based on your tier rankings.

## Features

- Connect with your Spotify account
- Browse and select from your playlists
- Search playlists by name or description
- Drag and drop songs into different tiers
- Export your tier list as an image
- View album covers for each song
- Get personalized song recommendations based on your tier rankings
- Responsive design for desktop and mobile

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Spotify account
- Last.fm account (for recommendations)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/THEBEST7192/spotify-tierlist
```

2. Install dependencies:
```bash
cd spotify-tierlist
npm install
```

3. Create a `.env.local` file in the root directory and add your API credentials:
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_REDIRECT_URI=http://localhost:3000 or whichever redirect uri you set in your spotify dashboard
REACT_APP_LASTFM_API_KEY=your_lastfm_api_key
```

4. Build and start the production server:
```bash
npm run build
serve -s build
```

The app will open in your default browser at `http://localhost:3000` or wherever you set as your redirect uri.

## Usage

1. Click "Login with Spotify" to connect your account
2. Select a playlist from your library
3. Drag songs into different tiers (S, A, B, C, D, E, F, or Unranked)
4. Click "Export as Image" to save your tier list
5. Click "Get Recommendations Based on Your Tiers" to generate personalized song recommendations
   - Songs in S and A tiers have the highest influence on recommendations
   - Recommendations are based on similar artists and tracks from Last.fm
   - Each recommendation shows which song and tier influenced it

## Technologies Used

- React
- React Beautiful DND (for drag and drop functionality)
- HTML2Canvas (for image export)
- Axios (for API requests)
- Create React App
- Spotify Web API (for song data)
- Last.fm API (for music recommendations)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to Spotify for providing the Web API
- Thanks to Last.fm for their music recommendation API
- Inspired by tier list makers in gaming communities
- Built with Create React App

## Anti Acknowledgments

- Fuck npm run build
- Fuck serve -s build

## Support

~~Just ask me irl I am not open sourcing this shit project~~ Send me a message at Discord (@thebest7192)

## Troubleshooting

If you encounter any issues:

1. Ensure your Spotify API credentials are correct
2. Check your internet connection
3. Clear your browser cache
4. Try running npm install again
5. If you ran "npm run start" you should instead run "npm run build" to build the production version of the app. After that you can run "npm run -s serve" to serve the production version of the app. If not you will get various errors that are not really errors, you will also not be able to move the songs around.
One example of those errors is this one:
```
react-beautiful-dnd.esm.js:39 react-beautiful-dndUnable to find draggable with id: (contentHere)👷‍ This is a development only message. It will be removed in production builds.
```

## Additional Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [Last.fm API Documentation](https://www.last.fm/api)
- [React Beautiful DND Documentation](https://react-beautiful-dnd.netlify.app/docs/getting-started)
- [HTML2Canvas Documentation](https://html2canvas.hertzen.com/documentation)

## Contact
@thebest7192 on Discord