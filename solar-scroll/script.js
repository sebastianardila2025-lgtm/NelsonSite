var video   = document.getElementById("solar-video");
var canvas  = document.getElementById("solar-canvas");
var section = document.getElementById("scroll-section");
var loader  = document.getElementById("loader");
var ctx     = canvas.getContext("2d");

var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;

/* ── Geometría cacheada (evita getBoundingClientRect en el hot-path) ── */
var sectionTop = 0, sectionH = 0;

function cacheGeometry() {
  sectionTop = section.offsetTop;
  sectionH   = section.offsetHeight;
}

/* ── Shared helpers ── */
function resizeCanvas() {
  var dpr = window.devicePixelRatio || 1;
  var w = window.innerWidth;
  // móvil: canvas es 16:9 (CSS aspect-ratio), alto = ancho*9/16
  var h = isMobile ? Math.round(w * 9 / 16) : window.innerHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + "px";
  // no sobreescribir height en móvil: CSS aspect-ratio lo controla
  if (!isMobile) canvas.style.height = h + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  cacheGeometry(); // recalcular al resize
}

function drawVideoFrame() {
  if (!video.videoWidth) return;
  var cw = window.innerWidth,  ch = window.innerHeight;
  var vw = video.videoWidth,   vh = video.videoHeight;
  // móvil: canvas 16:9 → contain llena perfectamente. escritorio: contain normal
  var ch = isMobile ? Math.round(cw * 9 / 16) : window.innerHeight;
  var ratio = Math.min(cw / vw, ch / vh);
  var nw = vw * ratio, nh = vh * ratio;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, (cw - nw) / 2, (ch - nh) / 2, nw, nh);
}

function getScrollProgress() {
  // window.pageYOffset: sin layout reflow, a diferencia de getBoundingClientRect
  var scrollY = window.pageYOffset || document.documentElement.scrollTop;
  var total   = sectionH - window.innerHeight;
  var passed  = Math.min(Math.max(scrollY - sectionTop, 0), total);
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
  if (loader) { loader.style.display = "block"; loader.textContent = "Cargando…"; }

  window.addEventListener("resize", function () {
    resizeCanvas();
    if (mobileReady) drawVideoFrame();
  }, { passive: true });

  video.addEventListener("progress", function () {
    if (!mobileReady && loader && video.buffered.length && video.duration) {
      var pct = Math.round(
        (video.buffered.end(video.buffered.length - 1) / video.duration) * 100
      );
      loader.textContent = "Cargando " + pct + "%";
    }
  });

  /* Start loading + play/pause trick to force buffering on iOS */
  video.load();
  video.play().then(function () {
    video.pause();
    video.currentTime = 0;
  }).catch(function () { /* autoplay may already be queued */ });

  /* canplay → switch to scrubbing mode, start RAF */
  video.addEventListener("canplay", function () {
    if (mobileReady) return;
    mobileReady = true;
    video.pause();
    video.currentTime = 0;
    if (loader) loader.style.display = "none";
    drawVideoFrame();
    if (!mobileRafId) mobileRafId = requestAnimationFrame(mobileTick);
  }, { once: true });

  /* seeked → paint frame; encadenar seek si el scroll cambio durante el decode */
  video.addEventListener("seeked", function () {
    mobilePending = false;
    drawVideoFrame();
    if (mobileReady && video.duration) {
      var next = getScrollProgress() * video.duration;
      if (Math.abs(video.currentTime - next) > 0.015) {
        mobilePending = true;
        video.currentTime = next;
      }
    }
  });


  /* RAF loop: samples scroll at 60 fps (catches iOS momentum scroll too).
     Actual seeks are gated by mobilePending so the decoder isn't flooded. */
  var mobileRafId = null;

  function mobileTick() {
    if (mobileReady && !mobilePending && video.duration) {
      var target = getScrollProgress() * video.duration;
      if (Math.abs(video.currentTime - target) > 0.015) {
        mobilePending = true;
        video.currentTime = target;
      }
    }
    mobileRafId = requestAnimationFrame(mobileTick);
  }

  /* Pause RAF when section leaves viewport to save battery */
  var mobileVisObs = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      if (mobileReady && !mobileRafId) mobileRafId = requestAnimationFrame(mobileTick);
    } else {
      if (mobileRafId) { cancelAnimationFrame(mobileRafId); mobileRafId = null; }
    }
  }, { threshold: 0 });
  mobileVisObs.observe(section);

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
  var scrollDirty = false; // true cuando el scroll cambio y hay que procesar
  var rafId       = null;

  /* Marcar que el scroll cambio — cero trabajo en el handler */
  window.addEventListener("scroll", function () { scrollDirty = true; }, { passive: true });

  function doSeek() {
    var target = getScrollProgress() * video.duration;
    if (Math.abs(video.currentTime - target) > 0.016) {
      pendingSeek = true;
      video.currentTime = target;
    }
  }

  function animate() {
    /* Solo actuar cuando el scroll cambio Y el decoder esta libre */
    if (ready && !pendingSeek && scrollDirty && video.duration) {
      scrollDirty = false;
      doSeek();
    }
    rafId = requestAnimationFrame(animate);
  }

  /* seeked → pintar frame; encadenar si hubo scroll durante el decode */
  video.addEventListener("seeked", function () {
    pendingSeek = false;
    drawVideoFrame();
    if (scrollDirty && video.duration) {
      scrollDirty = false;
      doSeek();
    }
  });

  video.addEventListener("canplay", function () {
    if (!ready) {
      ready = true;
      if (loader) loader.style.display = "none";
      cacheGeometry();
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