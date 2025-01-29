
function preventClicks(event) {
  console.log("target", event.target);
  if (
        event.target.matches("video.video-stream.html5-main-video") ||
        event.target.matches("img.ytd-moving-thumbnail-renderer")
    ) {


    const link = event.target.closest("a#thumbnail") || event.target.closest("a#media-container-link");
    console.log("link", link);
    if (link && link.hasAttribute("href")) { 
        event.stopPropagation();
        event.preventDefault();
        const url = link.getAttribute("href");
        const params = new URLSearchParams(url.split("?")[1]);
        const videoId = params.get("v");
        openOrReuseTab("https://stopdesign.ru/yt/?v=" + videoId);
    }
  } 
}

function openOrReuseTab(url) {
  const targetName = "myUniqueTarget";
  window.open(url, targetName);
}

function runFunction() {
  let changes = false;

  if (!document.body.getAttribute("data-extension-active")) {
        document.addEventListener("click", preventClicks, true);
        console.log(document);
        console.log(document.body);
        patchLogo();
  }

  // main page
  document
    .querySelectorAll(
      "#contents ytd-rich-grid-media, #contents ytd-video-renderer",
    )
    .forEach((content) => {
      const btn = content.querySelector("#button");
      if (btn && !btn.hasAttribute("patched")) {
        btn.setAttribute("patched", "true");
        changes = true;
      }
    });

  // Alert only if there were changes
  if (changes === true) {
        injectCSS();
        console.log("inject css")
  }

  document.body.setAttribute("data-extension-active", true);
}

function patchLogo() {
    const targetElement = document.querySelector("#logo-icon");
    if (targetElement) {
        const newDiv = document.createElement("div");
        newDiv.textContent = "( ๏ 人 ๏ )";
        Object.assign(newDiv.style, {
            position: "absolute", 
            bottom: "2px",
            left: "8px",
            fontSize: "11px",
            zIndex: "9999",
        });
        targetElement.appendChild(newDiv);
    }
}

function injectCSS() {
  const css =
    "ytd-rich-item-renderer { margin: 0 1.5em 2em 0 !important; }  ytd-reel-shelf-renderer { display: none !important; }";

  // Check if the CSS rule is already added
  const existingStyles = Array.from(document.styleSheets).some((sheet) => {
    try {
      return Array.from(sheet.cssRules).some((rule) => rule.cssText === css);
    } catch (e) {
      return false; // Ignore errors from cross-origin stylesheets
    }
  });

  if (!existingStyles) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    console.log("CSS injected");
  }
}

function isTargetDomain() {
  const domainWhitelist = ["youtube.com", "www.youtube.com"];
  const currentDomain = window.location.hostname;
  return domainWhitelist.some((domain) => currentDomain.endsWith(domain));
}

// Periodically patch the page
setInterval(() => {
  if (isTargetDomain()) runFunction();
}, 1000);
