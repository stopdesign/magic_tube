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
    const regex = /\b[a-zA-Z0-9_-]{11}\b/;
    const match = str.match(regex);
    return match ? match[0] : null;
}

// Fetch the video ID from the "v" query parameter
const initialVideoId = getQueryParam("v");

// Load the IFrame Player API code asynchronously
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";

const firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;

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
            inputField.value = initialVideoId;
            player.playVideo();
            listVideosById(initialVideoId);
        }
        // player.g.parentNode.style.width = "900px";
        // player.g.style.height = "600px";
    }

    function onPlayerStateChange(event) {
        console.log("onPlayerStateChange", event);
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
    } else {
        inputField.classList.add("invalid");
    }
}

// Unified function to list videos based on input ID
async function listVideosById(id, type = "auto") {
    const container = document.getElementById("sidebar");

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
                videos = await fetchVideosFromChannel(channelId, 10);
                break;

            case "playlistId":
                videos = await fetchVideosFromPlaylist(id);
                break;

            case "channelId":
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
