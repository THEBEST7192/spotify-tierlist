# Spotify Tierlist Maker

A web application that allows you to create tier lists from your Spotify playlists. Organize your favorite songs into tiers (S, A, B, C, D, E, F) using a drag-and-drop interface.

## Features

- Connect with your Spotify account
- Browse and select from your playlists
- Search playlists by name or description
- Drag and drop songs into different tiers
- Export your tier list as an image
- View album covers for each song
- Responsive design for desktop and mobile

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Spotify account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/spotify-tierlist.git
```

2. Install dependencies:
```bash
cd spotify-tierlist
npm install
```

3. Create a `.env.local` file in the root directory and add your Spotify API credentials:
```
REACT_APP_SPOTIFY_CLIENT_ID=your_client_id
REACT_APP_SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

4. Start the development server:
```bash
npm start
```

The app will open in your default browser at `http://localhost:3000`.

## Usage

1. Click "Login with Spotify" to connect your account
2. Select a playlist from your library
3. Drag songs into different tiers (S, A, B, C, D, E, F, or Unranked)
4. Click "Export as Image" to save your tier list

## Technologies Used

- React
- React Beautiful DND (for drag and drop functionality)
- HTML2Canvas (for image export)
- Axios (for API requests)
- Create React App

## Contributing

Ask me to upload this to GitHub then you can contribute.
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to Spotify for providing the Web API
- Inspired by tier list makers in gaming communities
- Built with Create React App

## Anti Acknowledgments
- Fuck npm run build
- Fuck npm run serve

## Support

Just ask me irl I am not open sourcing this shit project.

## Troubleshooting

If you encounter any issues:

1. Ensure your Spotify API credentials are correct
2. Check your internet connection
3. Clear your browser cache
4. Try running `npm install` again


If you ran "npm run start" you will have to run "npm run build" to build the production version of the app. After that you can run "npm run serve" to serve the production version of the app.
If not you will get various errors that are not really errors like:

react-beautiful-dnd.esm.js:39 react-beautiful-dndUnable to find draggable with id: (contentHere)👷‍ This is a development only message. It will be removed in production builds.


## Additional Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [React Beautiful DND Documentation](https://react-beautiful-dnd.netlify.app/docs/getting-started)
- [HTML2Canvas Documentation](https://html2canvas.hertzen.com/documentation)

## Contact

Your Name - [blundsbakken@gmail.com](mailto:blundsbakken@gmail.com)