const video   = document.getElementById("solar-video");
const canvas  = document.getElementById("solar-canvas");
const ctx     = canvas.getContext("2d");
const section = document.getElementById("scroll-section");
const loader  = document.getElementById("loader");

let ready       = false;
let pendingSeek = false;
let rafId       = null;

/* ── Canvas sizing ── */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth  + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  if (ready) drawVideoFrame();
}

/* ── Draw current video frame to canvas ── */
function drawVideoFrame() {
  if (!video.videoWidth) return;
  const cw = window.innerWidth, ch = window.innerHeight;
  const iw = video.videoWidth,  ih = video.videoHeight;
  const ratio = Math.min(cw / iw, ch / ih);
  const nw = iw * ratio, nh = ih * ratio;
  const x  = (cw - nw) / 2,   y  = (ch - nh) / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, x, y, nw, nh);
}

/* ── Scroll progress [0-1] within the sticky section ── */
function getScrollProgress() {
  const rect  = section.getBoundingClientRect();
  const total = section.offsetHeight - window.innerHeight;
  const passed = Math.min(Math.max(-rect.top, 0), total);
  return total > 0 ? passed / total : 0;
}

/* ── RAF loop: seek video to scroll-mapped time ── */
function animate() {
  if (ready && !pendingSeek && video.duration) {
    const targetTime = getScrollProgress() * video.duration;
    if (Math.abs(video.currentTime - targetTime) > 0.02) {
      pendingSeek = true;
      video.currentTime = targetTime;
    }
  }
  rafId = requestAnimationFrame(animate);
}

/* ── Video events ── */
video.addEventListener("seeked", function () {
  pendingSeek = false;
  drawVideoFrame();
});

video.addEventListener("canplay", function () {
  if (!ready) {
    ready = true;
    if (loader) loader.style.display = "none";
    drawVideoFrame();
  }
}, { once: true });

video.addEventListener("progress", function () {
  if (loader && loader.style.display !== "none" && video.buffered.length && video.duration) {
    const pct = Math.round((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
    loader.textContent = "Cargando " + pct + "%";
  }
});

/* ── Pause RAF when section not visible ── */
const observer = new IntersectionObserver(function (entries) {
  if (entries[0].isIntersecting) {
    if (!rafId) rafId = requestAnimationFrame(animate);
  } else {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }
}, { rootMargin: "200px" });

observer.observe(section);

window.addEventListener("resize", resizeCanvas, { passive: true });
resizeCanvas();