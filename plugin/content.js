
// Video cards: old renderers and the new yt-lockup-view-model cards
const CARD_SELECTOR = [
    "ytd-rich-grid-media",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "yt-lockup-view-model",
    // Home grid item wrapper, catches any card type inside it
    "ytd-rich-item-renderer",
    // Hover preview is rendered outside of the card, as its own overlay element
    "ytd-video-preview",
    "ytd-moving-thumbnail-renderer",
].join(",")

function getVideoId(link) {
    const url = new URL(link.href)
    // Shorts are excluded explicitly, they always stay on youtube.com
    if (url.pathname.startsWith("/shorts/")) return null
    if (url.pathname !== "/watch") return null
    return url.searchParams.get("v")
}

function preventClicks(event) {
    console.log("target", event.target)
    if (!event.target.closest) return

    // Any click inside a video card link: static or hover-preview thumbnail, title, etc.
    const link = event.target.closest("a[href]")
    if (!link || !link.closest(CARD_SELECTOR)) return

    const videoId = getVideoId(link)
    console.log("link", link, videoId)
    if (!videoId) return

    event.stopPropagation()
    event.preventDefault()
    openOrReuseTab("https://stopdesign.ru/yt/?v=" + videoId)
}

function openOrReuseTab(url) {
    const targetName = "myUniqueTarget"
    window.open(url, targetName)
}

function runFunction() {
    if (!document.body.getAttribute("data-extension-active")) {
        document.addEventListener("click", preventClicks, true)
        console.log(document)
        console.log(document.body)
        patchLogo()
    }

    // Shorts must be hidden on every page, not only when a new card was patched
    injectCSS()

    document.body.setAttribute("data-extension-active", true)
}

function patchLogo() {
    const targetElement = document.querySelector("#logo-icon")
    if (targetElement) {
        const newDiv = document.createElement("div")
        newDiv.textContent = "( ๏ 人 ๏ )"
        Object.assign(newDiv.style, {
            position: "absolute",
            bottom: "2px",
            left: "8px",
            fontSize: "11px",
            zIndex: "9999",
        })
        targetElement.appendChild(newDiv)
    }
}

// Everything that leads to Shorts is hidden: shelves, single items, sidebar entries
const HIDDEN_SHORTS_SELECTOR = [
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-rich-section-renderer:has(a[href^='/shorts/'])",
    "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
    "ytd-rich-item-renderer:has(a[href^='/shorts/'])",
    "ytd-video-renderer:has(a[href^='/shorts/'])",
    "ytd-compact-video-renderer:has(a[href^='/shorts/'])",
    "yt-lockup-view-model:has(a[href^='/shorts/'])",
    "ytm-shorts-lockup-view-model",
    "ytd-guide-entry-renderer:has(a[href^='/shorts'])",
    "ytd-mini-guide-entry-renderer:has(a[href^='/shorts'])",
].join(",")

function injectCSS() {
    const css =
        "ytd-rich-item-renderer { margin: 0 1.5em 2em 0 !important; } " +
        HIDDEN_SHORTS_SELECTOR + " { display: none !important; }"

    if (!document.getElementById("magictube-style")) {
        const style = document.createElement("style")
        style.id = "magictube-style"
        style.textContent = css
        document.head.appendChild(style)
        console.log("CSS injected")
    }
}

function isTargetDomain() {
    const domainWhitelist = ["youtube.com", "www.youtube.com"]
    const currentDomain = window.location.hostname
    return domainWhitelist.some((domain) => currentDomain.endsWith(domain))
}

// Periodically patch the page
setInterval(() => {
    if (isTargetDomain()) runFunction()
}, 1000)
