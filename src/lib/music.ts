// No API key, no scraping, no downloading — just plain search-URL deep
// links. Works because every major music service supports a public search
// URL. This is the legitimate way to do "open this song" without a
// developer account on either side.
export function musicSearchLinks(title: string, artist: string) {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  return {
    spotify: `https://open.spotify.com/search/${q}`,
    youtubeMusic: `https://music.youtube.com/search?q=${q}`,
    appleMusic: `https://music.apple.com/search?term=${q}`,
  };
}
