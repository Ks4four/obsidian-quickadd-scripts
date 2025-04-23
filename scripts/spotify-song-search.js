const notice = (msg, time = 5000) => new Notice(msg, time);
const log    = (...args) => console.log("[spotify_track.js]", ...args);

module.exports = {
  entry: main,
  settings: {
    name:  "Spotify Track Search (by ID)",
    author:"You",
    /**
     * In the Obsidian-QuickAdd GUI, provide:
     *   clientId     — Spotify Client ID
     *   clientSecret — Spotify Client Secret
     */
    options: {
      clientId:     { type: "text",  defaultValue: "" },
      clientSecret: { type: "text",  defaultValue: "" }
    }
  }
};

let QuickAdd;
let Settings;

/* ──────────────────────────────────────────────
 * Entry point — invoked by QuickAdd
 * ────────────────────────────────────────────── */
async function main(params, settings) {
  QuickAdd = params;
  Settings = settings;
  log("Script started: Spotify Track Search (by ID)");

  /* 1) Prompt the user for a Track ID or URL */
  let userInput = await QuickAdd.quickAddApi.inputPrompt("请输入 Spotify Track ID 或 URL:");
  if (!userInput) {
    notice("Cancelled — nothing entered.");
    throw new Error("No track id provided.");
  }
  log("User input:", userInput);

  /* Extract the 22-character Track ID (allow pasting the whole URL) */
  const trackIdMatch = userInput.match(/([0-9A-Za-z]{22})/);
  if (!trackIdMatch) {
    notice("Could not parse a valid Track ID — please double-check your input.");
    throw new Error("Invalid track id.");
  }
  const trackId = trackIdMatch[1];
  log("Parsed Track ID:", trackId);

  /* 2) Obtain an access token via the Client Credentials Flow */
  const { clientId, clientSecret } = Settings ?? {};
  if (!clientId || !clientSecret) {
    notice("Missing clientId / clientSecret in script settings.");
    throw new Error("Spotify credentials missing.");
  }

  const accessToken = await fetchAccessToken(clientId, clientSecret);
  if (!accessToken) {
    notice("Failed to obtain a Spotify access token.");
    throw new Error("Cannot obtain token.");
  }

  /* 3) Fetch /v1/tracks/{id} */
  const trackInfo = await fetchTrackInfo(trackId, accessToken);
  if (!trackInfo) {
    notice("Failed to fetch track details — is the Track ID correct?");
    throw new Error("Track info null.");
  }
  log("trackInfo:", trackInfo);

  /* 4) Map the response to template variables */
  QuickAdd.variables = mapToTemplateVars(trackInfo);

  /* 5) Done */
  notice("Spotify track information retrieved — generating note….");
  log("Script finished: Spotify Track Search completed successfully.");
}

/* ─────────── Request an access token ─────────── */
async function fetchAccessToken(clientId, clientSecret) {
  const url = "https://accounts.spotify.com/api/token";
  const body = "grant_type=client_credentials";
  const authHeader = btoa(`${clientId}:${clientSecret}`);

  try {
    const resp = await request({
      url,
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type":  "application/x-www-form-urlencoded"
      },
      body
    });
    const json = JSON.parse(resp);
    return json.access_token;
  } catch (err) {
    log("fetchAccessToken error:", err);
    return null;
  }
}

/* ─────────── Fetch Track details ─────────── */
async function fetchTrackInfo(trackId, token) {
  const url = `https://api.spotify.com/v1/tracks/${trackId}`;
  log("fetchTrackInfo ->", url);

  try {
    const resp = await request({
      url,
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    return JSON.parse(resp);
  } catch (err) {
    log("fetchTrackInfo error:", err);
    return null;
  }
}

/* ─────────── Map variables for the template ─────────── */
function mapToTemplateVars(track) {
  const songName   = track.name ?? "null";
  const songLink   = track.external_urls?.spotify ?? "null";

  /* Multiple artists possible — join with “, ” */
  const songArtist = Array.isArray(track.artists) && track.artists.length
    ? track.artists.map(a => a.name).join(", ")
    : "null";

  const songAlbum  = track.album?.name ?? "null";

  /* Use the largest cover image (Spotify lists them in descending size) */
  const albumCover = Array.isArray(track.album?.images) && track.album.images.length
    ? track.album.images[0].url
    : "null";

  /* Keep the release year only */
  const releaseDate = track.album?.release_date ?? "";
  const songYear = releaseDate.match(/^\d{4}/)?.[0] ?? "null";

  return {
    songName,
    songArtist,
    songAlbum,
    albumCover,
    songYear,
    songLink
  };
}