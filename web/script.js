const API_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = window.API_KEY || "";

// Link to check API quotas:
// https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas

// Helper: Fetch data from API
async function fetchData(endpoint, params) {
    const url = `${API_URL}${endpoint}?${new URLSearchParams({ ...params, key: API_KEY })}`;
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Failed to fetch: ${response.statusText}`);
    return await response.json();
}

// Helper: Format video duration
function formatDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return "0:00";

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    const formattedMinutes = String(minutes).padStart(2, "0");
    const formattedSeconds = String(seconds).padStart(2, "0");

    return hours > 0
        ? `${hours}:${formattedMinutes}:${formattedSeconds}`
        : `${minutes}:${formattedSeconds}`;
}

// Step 1: Fetch the channel ID from a video ID
async function getChannelIdFromVideo(videoId) {
    const videoData = await fetchData("/videos", {
        part: "snippet",
        id: videoId,
    });
    return videoData.items[0]?.snippet.channelId || null;
}

async function fetchVideosFromChannel(channelId, maxResults = 50) {
    // Fetch the uploads playlist ID for the channel
    const channelData = await fetchData("/channels", {
        part: "contentDetails",
        id: channelId,
    });

    const uploadsPlaylistId =
        channelData.items[0]?.contentDetails.relatedPlaylists.uploads;

    if (!uploadsPlaylistId) {
        console.error("Uploads playlist not found for channel", channelId);
        return [];
    }

    return await fetchVideosFromPlaylist(uploadsPlaylistId, maxResults);
}

//Fetch videos from a playlist
async function fetchVideosFromPlaylist(playlistId, maxResults = 50) {
    // Step 1: Fetch playlist items
    const playlistData = await fetchData("/playlistItems", {
        part: "snippet,contentDetails",
        playlistId,
        maxResults,
    });

    const videoIds = playlistData.items
        .map((item) => item.contentDetails.videoId)
        .join(",");

    // Step 2: Fetch video details for durations
    const detailsData = await fetchData("/videos", {
        part: "contentDetails",
        id: videoIds,
    });

    // Map video IDs to durations
    const durations = detailsData.items.reduce((map, item) => {
        map[item.id] = item.contentDetails.duration;
        return map;
    }, {});

    // Step 3: Combine data into a unified array
    return playlistData.items.map((item) => ({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        publishTime: item.snippet.publishedAt.split("T")[0],
        duration: durations[item.contentDetails.videoId] || null,
    }));
}

// Render videos to the sidebar
function renderVideos(videos, container) {
    const list = document.createElement("ul");
    const inputField = document.getElementById("videoIdInput");

    videos.forEach((video) => {
        const listItem = document.createElement("li");
        const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/hq720.jpg`;

        listItem.innerHTML = `
            <div class="thumbnail" style="background-image: url('${thumbnailUrl}')">
                <span class="duration-badge">${formatDuration(video.duration)}</span>
            </div>
            <div>
                <h3 class="video-title">${video.title}</h3>
                <span class="publish-time">${video.publishTime}</span>
            </div>
        `;
        listItem.setAttribute("data-id", video.id);
        list.appendChild(listItem);
    });

    container.innerHTML = "";
    container.appendChild(list);

    // Attach click listeners
    container.addEventListener("click", (event) => {
        const listItem = event.target.closest("li");
        if (listItem && player) {
            const videoId = listItem.getAttribute("data-id");

            inputField.value = videoId;

            player.loadVideoById(videoId);
            player.playVideo();
        }
    });
}

// Extract query parameter by name
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function extractVideoId(str) {
    const regex = /(?:v=([a-zA-Z0-9_-]{11}))/;
    const match = str.match(regex);
    return match ? match[1] : null;
}

// Fetch the video ID from the "v" query parameter
const initialVideoId = getQueryParam("v");

// Load the IFrame Player API code asynchronously
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";

const firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let playerReady = false;
let autoplayBlocked = false;

// Create the YouTube Player instance when API is ready
window.onYouTubeIframeAPIReady = function () {
    const YT = window.YT;
    player = new YT.Player("player", {
        videoId: initialVideoId || "",
        playerVars: {
            playsinline: 1,
            rel: 0,
            showinfo: 0,
            ecver: 2,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            origin: location.origin,
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
        },
    });

    // Auto-play the initial video
    function onPlayerReady(e) {
        const inputField = document.getElementById("videoIdInput");
        if (initialVideoId) {
            if (inputField) inputField.value = initialVideoId;
            // === Keep your previous behavior: try autoplay WITH sound ===
            player.playVideo();

            // Fallback: detect if autoplay was blocked (still unstarted/cued after a short delay)
            setTimeout(() => {
                const state = player.getPlayerState();
                // -1: unstarted, 5: video cued — treat these as "didn't actually start"
                if (state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) {
                autoplayBlocked = true;
                // Optional: you could show a hint in the UI like “Press Space/K to play”
                }
            }, 800);

            listVideosById(initialVideoId);
        }

        const iframe = player.getIframe?.();

    playerReady = true;
  }

  function onPlayerStateChange(event) {
    // No focusing/clicking iframe needed
    console.log("onPlayerStateChange", event.data);
  }
};


// Input changed, play video
function onPlay() {
    const inputField = document.getElementById("videoIdInput");
    const inputString = inputField.value.trim();

    const videoId = extractVideoId(inputString);
    if (videoId && inputString != videoId) {
        inputField.value = videoId;
    }

    if (videoId) {
        player.loadVideoById(videoId);
        player.playVideo();
        listVideosById(videoId);
        const newUrl = `${window.location.origin}${window.location.pathname}?v=${videoId}`;
        console.log("New URL:", newUrl);
        window.history.pushState({ videoId }, "", newUrl);
        inputField.classList.remove("invalid");
        autoplayBlocked = false;
    } else {
        inputField.classList.add("invalid");
    }
}

let currentChannelId = null;

// Unified function to list videos based on input ID
async function listVideosById(id, type = "auto") {
    const container = document.getElementById("sidebar-list");

    try {
        if (type === "auto") {
            // Guess the type based on ID format
            if (id.startsWith("PL")) {
                type = "playlistId";
            } else if (id.length === 11) {
                type = "videoId";
            } else {
                type = "channelId";
            }
        }

        console.log("listVideosById", id, type);

        let videos = [];

        switch (type) {
            case "videoId":
                const channelId = await getChannelIdFromVideo(id);
                if (!channelId)
                    throw new Error("Channel ID not found for video ID");
                currentChannelId = channelId;
                videos = await fetchVideosFromChannel(channelId, 10);
                break;

            case "playlistId":
                const playlistData = await fetchData("/playlists", {
                    part: "snippet",
                    id,
                });
                currentChannelId = playlistData.items[0]?.snippet.channelId || null;
                videos = await fetchVideosFromPlaylist(id);
                break;

            case "channelId":
                currentChannelId = id;
                videos = await fetchVideosFromChannel(id, 10);
                break;

            default:
                throw new Error("Unsupported ID type");
        }

        renderVideos(videos, container);
    } catch (error) {
        console.error(`Error listing videos for ID (${id}):`, error);
        container.innerHTML =
            "<p class=error>Error loading related videos.</p>";
    }
}

const searchCache = new Map();

async function searchInChannel(query) {
    if (!currentChannelId || !query) return;
    const container = document.getElementById("sidebar-list");
    const cacheKey = `${currentChannelId}:${query}`;

    if (searchCache.has(cacheKey)) {
        renderVideos(searchCache.get(cacheKey), container);
        return;
    }

    try {
        const searchData = await fetchData("/search", {
            part: "snippet",
            channelId: currentChannelId,
            q: query,
            type: "video",
            maxResults: 25,
        });

        if (!searchData.items.length) {
            const errorEl = document.createElement("p");
            errorEl.className = "error";
            errorEl.textContent = "No videos found.";
            container.prepend(errorEl);
            return;
        }

        const videoIds = searchData.items.map((item) => item.id.videoId).join(",");
        const detailsData = await fetchData("/videos", {
            part: "contentDetails,snippet",
            id: videoIds,
        });

        const videos = detailsData.items.map((item) => ({
            id: item.id,
            title: item.snippet.title,
            publishTime: item.snippet.publishedAt.split("T")[0],
            duration: item.contentDetails.duration,
        }));

        searchCache.set(cacheKey, videos);
        renderVideos(videos, container);
    } catch (error) {
        console.error("Search error:", error);
        const errorEl = document.createElement("p");
        errorEl.className = "error";
        errorEl.textContent = "Search failed.";
        container.prepend(errorEl);
    }
}

function isTypingInForm(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return false;
}

function togglePlayPause() {
  const YTState = window.YT?.PlayerState;
  if (!YTState) return;

  // If autoplay was blocked, treat the first toggle as “play”
  if (autoplayBlocked) {
    autoplayBlocked = false;
    player.playVideo();
    return;
  }

  const state = player.getPlayerState();
  if (state === YTState.PLAYING) player.pauseVideo();
  else player.playVideo();
}

function seekBy(seconds) {
  const t = Math.max(0, player.getCurrentTime() + seconds);
  player.seekTo(t, true);
}

function setVolumeDelta(delta) {
  const v = Math.max(0, Math.min(100, player.getVolume() + delta));
  player.setVolume(v);
}

function toggleMute() {
  if (player.isMuted()) player.unMute();
  else player.mute();
}

function jumpToPercent(p) { // 0..100
  const dur = player.getDuration();
  if (dur > 0) player.seekTo((p / 100) * dur, true);
}

function fullscreenWrap() {
  const iframe = player.getIframe();
    iframe.requestFullscreen?.();
}

document.addEventListener("keydown", (e) => {
  if (!playerReady) return;
  if (isTypingInForm(document.activeElement)) return; // let the input work

  const key = e.key.toLowerCase();

  // Prevent page scroll for these keys (when not typing in input)
  const prevent = [" ", "arrowleft", "arrowright", "arrowup", "arrowdown"];
  if (prevent.includes(key)) e.preventDefault();

  // Play/Pause: Space or K
  if (key === " " || key === "k") { togglePlayPause(); return; }

  // Seek: J / Left (-10s), L / Right (+10s)
  if (key === "j" || key === "arrowleft") { seekBy(-10); return; }
  if (key === "l" || key === "arrowright") { seekBy(10); return; }

  // Volume: Up/Down (+/-5)
  if (key === "arrowup") { setVolumeDelta(+5); return; }
  if (key === "arrowdown") { setVolumeDelta(-5); return; }

  // Mute
  if (key === "m") { toggleMute(); return; }

  // Fullscreen wrapper
  if (key === "f") { fullscreenWrap(); return; }

  // Number keys 0..9 -> 0..90%
  if (/^[0-9]$/.test(key)) {
    jumpToPercent(parseInt(key, 10) * 10);
    return;
  }
});

