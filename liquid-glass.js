// Liquid Glass — adapted from github.com/srdavo/liquid-glass
// SVG feDisplacementMap in backdrop-filter (Chromium only; Safari uses CSS fallback)
(function () {
  var ok = (function () {
    var ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return false;
    var t = document.createElement('div');
    if (typeof t.style.backdropFilter === 'undefined' && typeof t.style.webkitBackdropFilter === 'undefined') return false;
    return /chrome|chromium|crios|edg/.test(ua) && !/firefox|fxios/.test(ua);
  })();
  if (!ok) return;

  function dmap(w, h, r, d) {
    var ys = Math.ceil((r/h)*15), ye = Math.floor(100-(r/h)*15);
    var xs = Math.ceil((r/w)*15), xe = Math.floor(100-(r/w)*15);
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg height="'+h+'" width="'+w+'" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">' +
      '<style>.m{mix-blend-mode:screen}</style>' +
      '<defs>' +
        '<linearGradient id="Y" x1="0" x2="0" y1="'+ys+'%" y2="'+ye+'%"><stop offset="0%" stop-color="#0F0"/><stop offset="100%" stop-color="#000"/></linearGradient>' +
        '<linearGradient id="X" x1="'+xs+'%" x2="'+xe+'%" y1="0" y2="0"><stop offset="0%" stop-color="#F00"/><stop offset="100%" stop-color="#000"/></linearGradient>' +
      '</defs>' +
      '<rect width="'+w+'" height="'+h+'" fill="#808080"/>' +
      '<g filter="blur(2px)">' +
        '<rect width="'+w+'" height="'+h+'" fill="#000080"/>' +
        '<rect width="'+w+'" height="'+h+'" fill="url(#Y)" class="m"/>' +
        '<rect width="'+w+'" height="'+h+'" fill="url(#X)" class="m"/>' +
        '<rect x="'+d+'" y="'+d+'" width="'+(w-2*d)+'" height="'+(h-2*d)+'" fill="#808080" rx="'+r+'" filter="blur('+d+'px)"/>' +
      '</g></svg>');
  }

  function gfilter(w, h, r, d, s, ca, b) {
    var m = dmap(w, h, r, d);
    var svg = '<svg height="'+h+'" width="'+w+'" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><filter id="gl" color-interpolation-filters="sRGB">' +
        '<feImage x="0" y="0" width="'+w+'" height="'+h+'" href="'+m+'" result="dm"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="dm" scale="'+(s+ca*2)+'" xChannelSelector="R" yChannelSelector="G"/>' +
        '<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="R"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="dm" scale="'+(s+ca)+'" xChannelSelector="R" yChannelSelector="G"/>' +
        '<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="G"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="dm" scale="'+s+'" xChannelSelector="R" yChannelSelector="G"/>' +
        '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="B"/>' +
        '<feBlend in="R" in2="G" mode="screen"/><feBlend in2="B" mode="screen"/>' +
      '</filter></defs></svg>';
    var uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '#gl';
    return 'blur('+(b*.5)+'px) url(\''+uri+'\') blur('+b+'px) brightness(1.12) saturate(1.8)';
  }

  function set(el, f, bg, sh) {
    if (!el) return;
    el.style.setProperty('backdrop-filter', f, 'important');
    el.style.setProperty('-webkit-backdrop-filter', f, 'important');
    if (bg) el.style.setProperty('background', bg, 'important');
    if (sh) el.style.setProperty('box-shadow', sh, 'important');
  }

  var cache = {};
  function cf(k, fn) { if (!cache[k]) cache[k] = fn(); return cache[k]; }

  var INSET = '1px 1px 1px 0 rgba(255,255,255,.62) inset,-1px -1px 1px 0 rgba(255,255,255,.62) inset,0 0 20px rgba(0,0,0,.04)';

  function sheet() {
    var el = document.getElementById('chat-glass-bg');
    if (!el) return;
    var w = window.innerWidth, h = Math.round(window.innerHeight * .88);
    set(el, cf('s'+w+'x'+h, function(){ return gfilter(w,h,20,18,55,3,8); }), 'rgba(255,255,255,.20)', INSET);
  }

  function bubble() {
    var el = document.querySelector('.liquid-glass__backdrop');
    if (!el) return;
    var sz = window.innerWidth <= 768 ? 60 : 68;
    set(el, cf('b'+sz, function(){ return gfilter(sz,sz,sz,10,80,2,10); }), null, null);
  }

  function panel() {
    if (window.innerWidth <= 768) return;
    var el = document.querySelector('.chat-panel');
    if (!el) return;
    set(el, cf('p', function(){ return gfilter(360,540,28,15,50,2,8); }),
      'rgba(238,244,255,.32)',
      '1px 1px 1px 0 rgba(255,255,255,.60) inset,-1px -1px 1px 0 rgba(255,255,255,.60) inset,0 20px 60px rgba(15,45,92,.16)');
  }

  function init() { sheet(); bubble(); panel(); }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  var rt;
  window.addEventListener('resize', function() {
    cache = {}; clearTimeout(rt); rt = setTimeout(init, 200);
  }, { passive: true });
}());
