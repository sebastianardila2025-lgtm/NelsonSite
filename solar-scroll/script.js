const frameCount = 151;
const LOOKAHEAD = 6;
const CACHE_BUST = Date.now();

const canvas = document.getElementById("solar-canvas");
const ctx = canvas.getContext("2d");
const section = document.getElementById("scroll-section");

let currentFrame = -1;
let targetFrame = 0;
let currentFrameFloat = 0;

const cache = {};

function framePath(index) {
  return `frames/frame_${String(index + 1).padStart(3, "0")}.png?v=${CACHE_BUST}`;
}

function getOrLoad(index) {
  if (index < 0 || index >= frameCount) return null;
  if (cache[index]) return cache[index];
  const img = new Image();
  img.src = framePath(index);
  cache[index] = img;
  return img;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function drawFrame(img) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ratio = Math.min(cw / iw, ch / ih);
  const nw = iw * ratio;
  const nh = ih * ratio;
  const x = (cw - nw) / 2;
  const y = (ch - nh) / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x, y, nw, nh);
}

function getScrollProgress() {
  const rect = section.getBoundingClientRect();
  const total = section.offsetHeight - window.innerHeight;
  const passed = Math.min(Math.max(-rect.top, 0), total);
  return total > 0 ? passed / total : 0;
}

function preloadAhead(frameIndex, direction) {
  for (let i = 1; i <= LOOKAHEAD; i++) {
    getOrLoad(frameIndex + i * direction);
  }
}

function animate() {
  const progress = getScrollProgress();
  targetFrame = progress * (frameCount - 1);
  currentFrameFloat += (targetFrame - currentFrameFloat) * 0.25;

  const frameIndex = Math.min(Math.max(Math.floor(currentFrameFloat), 0), frameCount - 1);

  if (frameIndex !== currentFrame) {
    const direction = frameIndex > currentFrame ? 1 : -1;
    currentFrame = frameIndex;

    preloadAhead(frameIndex, direction);

    const img = getOrLoad(frameIndex);
    if (img.complete && img.naturalWidth) {
      drawFrame(img);
    } else {
      img.onload = () => drawFrame(img);
    }
  }

  requestAnimationFrame(animate);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

for (let i = 0; i < Math.min(12, frameCount); i++) {
  getOrLoad(i);
}

animate();