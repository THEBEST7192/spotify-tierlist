# KNOWN ISSUES
## (From highest priority to lowest) 

### 1. Playlist descriptions contain Unicode Hex character codes
Unicode Hex characters wrongly displayed in playlist descriptions, this only happens in descriptions, not in the name of the playlist or elsewhere.
i.e.:
```
This is a playlist consisting of only one letter songs for rock&#x2F;metal related songs in their alphabetical&#x2F;numerical order with no artist repeats.  Send me a message on Discord&#x2F;TikTok if I should add any song
```

### 2 Unavailable songs showing
Songs that are removed from spotify get included when getting the songs from Spotify, this causes issues during playback as the songs will not play, but you can still get recommendations for them using the Last.FM API.

### 3. Bad menu for adding songs to playlist
- If a user is searching for a playlist to add their song to it will not filter out the rest of them, which is annoying, if you have multiple playlists called the same thing there will be no way to know what is what, there is also no album art etc. All of this can be fixed by adding a search bar to the add playlist menu
- After clicking on the add to playlist button, the menu will be gone for a split second before returning to normal then it will stay there for a few seconds

### 4. Lagging when turning on absolute cinema mode on first time, but not other times
- This is because of the site downloading the MoveNet model at the start, as the issues only happens when the absolute cinema mode is first turned on, this could get fixed by doing it at the start of the page load or in the background.
    - *I am not sure if this is necessary, but the way each frame, the code is implemented now makes it so that, the pose detection runs at high frame rate combined with full‑screen image rendering on which may be ineffiecnt but I belive that this is not a issue as there is no lag after the user turn on absolute cinema mode*

### 5. Bad editing of tiers
- When editing tiers using Editing tools, the button to move a tier higher/lower than possible if visible, this button does not an is therefore unnecessary, but it causes no issue. 
- Another issue related editing of tiers is no color changing for the existing tiers, this makes it annoying to create tiers in the middle of a tierlist as you have to create a new tier, this is a issue, because of the user needing to move songs to a new tier

### 6. When editing tiers, you can move unranked around
- This does not really affect the functionality of the tierlist, since Unranked is excluded from the ranking no matter what, a solution could be to not let the user move tiers below it


### 7. Being hard to tell if you are disconnected from the internet in the Spotify iFrame
- This is due to the way that the spotify iframe is created it would be hard to fix this as it lies on Spotify, also this only happens when there is no internet or another issue with Spotify, the user would also notice other errors like no playback etc. a solution would be to add a check to display a pop-up when it can not play the songs because of a network issue