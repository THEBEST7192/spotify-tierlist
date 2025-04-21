# KNOWN ISSUES
## (From highest priority to lowest) 

### 1. Bad menu for adding songs to playlist
- If a user is searching for a playlist to add their song to it will not filter out the rest of them, which is annoying, if you have multiple playlists called the same thing there will be no way to know what is what, there is also no album art etc. All of this can be fixed by adding a search bar to the add playlist menu
- After clicking on the add to playlist button, the menu will be gone for a split second before returning to normal then it will stay there for a few seconds

### 2. Lagging when turning on absolute cinema mode on first time, but not other times
- This is because of the site downloading the MoveNet model at the start, as the issues only happens when the absolute cinema mode is first turned on, this could get fixed by doing it at the start of the page load or in the background.
    - *I am not sure if this is necessary, but the way the code is implemented now makes it so that, the pose detection runs at high frame rate combined with full‑screen image rendering on each frame, which may be ineffiecnt but I belive that this is not a issue as there is no lag after the user turn on absolute cinema mode*

### 3. Bad editing of tiers
- When editing tiers using Editing tools, the button to move a tier higher/lower than possible if visible, this button does not an is therefore unnecessary, but it causes no issue. 
- Another issue related editing of tiers is no color changing for the existing tiers, this makes it annoying to create tiers in the middle of a tierlist as you have to create a new tier, this is a issue, because of the user needing to move songs to a new tier

### 4 When editing tiers, you can move unranked around
- This does not really affect the functionality of the tierlist, since Unranked is excluded from the ranking no matter what, a solution could be to not let the user move tiers below it


### 5. Being hard to tell if you are disconnected from the internet in the Spotify iFrame
- This is due to the way that the spotify iframe is created it would be hard to fix this as it lies on Spotify, also this only happens when there is no internet or another issue with Spotify, the user would also notice other errors like no playback etc. a solution would be to add a check to display a pop-up when it can not play the songs because of a network issue*