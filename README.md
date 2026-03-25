# Music Bot

Simple music bot plugin for Sharkord that allows streaming music from youtube or direct links to voice channels.

## Dependencies

The plugin will automatically download the required dependencies (yt-dlp and ffmpeg) on first run.

## Manual Installation

1. Download the latest release from the [Releases](https://github.com/Sharkord/music-bot/releases) page.
2. Move the `sharkord-music-bot` folder to your Sharkord plugins directory, typically located at `~/.config/sharkord/plugins`. See: [Data Dir](https://sharkord.com/docs/data-dir).

## Screenshots

![Screenshot of the music bot plugin](https://i.imgur.com/cYA9yTc.png)

## Commands

- `/play <query>`: Plays a song in the voice channel you are currently in. The query can be a YouTube URL or a search term.
- `/stop`: Stops the music.
- `/volume <0-100>`: Sets the playback volume (default is 50).
- `/nowplaying`: Shows the currently playing song.

## Troubleshooting

### Sign in to confirm you’re not a bot

Well, turns out this is a bot. If you encounter this issue, you can try the following solutions:

1. Use a different IP address by connecting through a VPN or proxy.
2. Pass your cookies to yt-dlp to a file in `plugins/sharkord-music-bot/bin/cookies.txt`.
