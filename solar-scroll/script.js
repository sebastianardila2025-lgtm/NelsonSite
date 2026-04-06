const video   = document.getElementById("solar-video");
const canvas  = document.getElementById("solar-canvas");
const section = document.getElementById("scroll-section");
const loader  = document.getElementById("loader");

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                 window.innerWidth <= 768;

/* ════════════════════════════════════════════════════════
   MOBILE — play video natively (no canvas scrubbing)
   canplay / currentTime seeks are blocked on mobile without
   a prior user gesture, so canvas scrubbing never works.
   Instead we show the video element directly and let it loop.
   ════════════════════════════════════════════════════════ */
if (isMobile) {

  if (loader) loader.style.display = "none";

  /* make sure video is set up for autoplay */
  video.muted    = true;
  video.loop     = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("preload", "auto");

  /* start loading */
  video.load();

  /* play / pause based on visibility */
  var mobileObs = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      video.play().catch(function () {});
    } else {
      video.pause();
    }
  }, { threshold: 0.1 });

  mobileObs.observe(section);

/* ════════════════════════════════════════════════════════
   DESKTOP — scroll-driven canvas scrubbing
   ════════════════════════════════════════════════════════ */
} else {

  var ctx         = canvas.getContext("2d");
  var ready       = false;
  var pendingSeek = false;
  var rafId       = null;

  /* ── Canvas sizing ── */
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    if (ready) drawVideoFrame();
  }

  /* ── Draw current video frame ── */
  function drawVideoFrame() {
    if (!video.videoWidth) return;
    var cw = window.innerWidth,  ch = window.innerHeight;
    var iw = video.videoWidth,   ih = video.videoHeight;
    var ratio = Math.min(cw / iw, ch / ih);
    var nw = iw * ratio, nh = ih * ratio;
    var x  = (cw - nw) / 2,     y  = (ch - nh) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, x, y, nw, nh);
  }

  /* ── Scroll progress [0-1] ── */
  function getScrollProgress() {
    var rect  = section.getBoundingClientRect();
    var total = section.offsetHeight - window.innerHeight;
    var passed = Math.min(Math.max(-rect.top, 0), total);
    return total > 0 ? passed / total : 0;
  }

  /* ── RAF loop: seek to scroll-mapped time ── */
  function animate() {
    if (ready && !pendingSeek && video.duration) {
      var targetTime = getScrollProgress() * video.duration;
      if (Math.abs(video.currentTime - targetTime) > 0.02) {
        pendingSeek = true;
        video.currentTime = targetTime;
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

  /* ── Pause RAF when off-screen ── */
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