var video   = document.getElementById("solar-video");
var canvas  = document.getElementById("solar-canvas");
var section = document.getElementById("scroll-section");
var loader  = document.getElementById("loader");
var ctx     = canvas.getContext("2d");

var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;

/* ── Shared helpers ── */
function resizeCanvas() {
  var dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth  + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function drawVideoFrame() {
  if (!video.videoWidth) return;
  var cw = window.innerWidth,  ch = window.innerHeight;
  var vw = video.videoWidth,   vh = video.videoHeight;
  var ratio = Math.min(cw / vw, ch / vh);
  var nw = vw * ratio, nh = vh * ratio;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, (cw - nw) / 2, (ch - nh) / 2, nw, nh);
}

function getScrollProgress() {
  var rect  = section.getBoundingClientRect();
  var total = section.offsetHeight - window.innerHeight;
  var passed = Math.min(Math.max(-rect.top, 0), total);
  return total > 0 ? passed / total : 0;
}

/* ════════════════════════════════════════════════════════
   MOBILE — canvas scrubbing with play/pause buffering trick.
   Muted + playsinline videos can call .play() without gesture
   on iOS Safari, which forces the browser to buffer the video
   and fires canplay. Then we pause and scrub via currentTime.
   Fallback to looping playback if canplay never fires.
   ════════════════════════════════════════════════════════ */
if (isMobile) {

  var mobileReady   = false;
  var mobilePending = false;
  var lastSeekMs    = 0;

  video.muted = true;
  video.loop  = false;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("preload", "auto");

  resizeCanvas();
  window.addEventListener("resize", function () {
    resizeCanvas();
    if (mobileReady) drawVideoFrame();
  }, { passive: true });

  /* Show loading text while buffering */
  if (loader) {
    loader.style.display = "block";
    loader.textContent   = "Cargando…";
  }

  /* Start loading + play/pause trick to force buffering on iOS */
  video.load();
  video.play().then(function () {
    video.pause();
    video.currentTime = 0;
  }).catch(function () { /* autoplay may already be queued */ });

  /* canplay → switch to scrubbing mode */
  video.addEventListener("canplay", function () {
    if (mobileReady) return;
    mobileReady = true;
    video.pause();
    video.currentTime = 0;
    if (loader) loader.style.display = "none";
    drawVideoFrame();
  }, { once: true });

  /* seeked → paint frame */
  video.addEventListener("seeked", function () {
    mobilePending = false;
    drawVideoFrame();
  });

  /* progress → update loading % */
  video.addEventListener("progress", function () {
    if (!mobileReady && loader && video.buffered.length && video.duration) {
      var pct = Math.round(
        (video.buffered.end(video.buffered.length - 1) / video.duration) * 100
      );
      loader.textContent = "Cargando " + pct + "%";
    }
  });

  /* Scroll-driven seek (throttled ~12 fps to keep iOS smooth) */
  function mobileSeek() {
    if (!mobileReady || mobilePending) return;
    var now = Date.now();
    if (now - lastSeekMs < 80) return;
    lastSeekMs = now;
    var target = getScrollProgress() * video.duration;
    if (Math.abs(video.currentTime - target) > 0.04) {
      mobilePending = true;
      video.currentTime = target;
    }
  }
  window.addEventListener("scroll", mobileSeek, { passive: true });

  /* Fallback: if canplay never fires after 5 s, just loop the video */
  setTimeout(function () {
    if (!mobileReady) {
      if (loader) loader.style.display = "none";
      video.loop = true;
      video.play().catch(function () {});
    }
  }, 5000);

/* ════════════════════════════════════════════════════════
   DESKTOP — RAF-driven canvas scrubbing
   ════════════════════════════════════════════════════════ */
} else {

  var ready       = false;
  var pendingSeek = false;
  var rafId       = null;

  function animate() {
    if (ready && !pendingSeek && video.duration) {
      var target = getScrollProgress() * video.duration;
      if (Math.abs(video.currentTime - target) > 0.02) {
        pendingSeek = true;
        video.currentTime = target;
      }
    }
    rafId = requestAnimationFrame(animate);
  }

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
    if (loader && loader.style.display !== "none" &&
        video.buffered.length && video.duration) {
      var pct = Math.round(
        (video.buffered.end(video.buffered.length - 1) / video.duration) * 100
      );
      loader.textContent = "Cargando " + pct + "%";
    }
  });

  var desktopObs = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      if (!rafId) rafId = requestAnimationFrame(animate);
    } else {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
  }, { rootMargin: "200px" });

  desktopObs.observe(section);
  window.addEventListener("resize", resizeCanvas, { passive: true });
  resizeCanvas();

}