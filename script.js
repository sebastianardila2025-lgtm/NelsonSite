// Chat Widget
(function() {
  var widget    = document.getElementById('chat-widget');
  var bubble    = document.getElementById('chat-bubble');
  var panel     = document.getElementById('chat-panel');
  var closeBtn  = document.getElementById('chat-close');
  var messages  = document.getElementById('chat-messages');
  var input     = document.getElementById('chat-input');
  var sendBtn   = document.getElementById('chat-send');
  var leadForm  = document.getElementById('chat-lead-form');
  var inputRow  = document.querySelector('.chat-input-row');

  if (!widget) return;

  // On mobile: move panel to <body> so position:fixed works correctly in Safari
  // (nested position:fixed inside a position:fixed parent breaks on iOS)
  if (panel && window.innerWidth <= 768) {
    document.body.appendChild(panel);
  }

  // Lead data stored in memory for the session
  var leadData   = null;
  var isOpen     = false;
  var openTimer  = null;
  var closeTimer = null;

  // ── View helpers ──
  function showLeadForm() {
    leadForm.style.display  = 'flex';
    messages.style.display  = 'none';
    inputRow.style.display  = 'none';
  }

  function showChat() {
    leadForm.style.display  = 'none';
    messages.style.display  = 'flex';
    inputRow.style.display  = 'flex';
    scrollMessages();
  }

  // Initialize: lead form visible, messages/input hidden
  showLeadForm();

  // ── Open / close with mac-style animations ──
  var overlay  = document.getElementById('chat-overlay');
  var glassBg  = document.getElementById('chat-glass-bg');
  if (overlay) {
    overlay.addEventListener('click', function() { closePanel(); });
  }

  function isMobile() { return window.innerWidth <= 768; }

  function showOverlay() {
    if (!isMobile()) return;
    if (overlay) { overlay.style.display = 'block'; }
    if (glassBg) {
      glassBg.style.display = 'block';
      // Tell glass-element the exact pixel dimensions so the SVG displacement
      // filter is generated at the correct size for this viewport
      glassBg.setAttribute('width',  String(window.innerWidth));
      glassBg.setAttribute('height', String(Math.round(window.innerHeight * 0.88)));
    }
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (overlay) overlay.classList.add('is-visible');
        if (glassBg)  glassBg.classList.add('is-visible');
      });
    });
  }

  function hideOverlay() {
    if (overlay) overlay.classList.remove('is-visible');
    if (glassBg)  glassBg.classList.remove('is-visible');
    setTimeout(function() {
      if (overlay) overlay.style.display = 'none';
      if (glassBg)  glassBg.style.display  = 'none';
    }, 420);
  }

  function openPanel(forceLeadForm) {
    if (isOpen) return;
    isOpen = true;
    clearTimeout(closeTimer);
    panel.style.display = 'block';
    showOverlay();
    panel.classList.remove('is-closing', 'is-open');
    widget.classList.add('chat-widget--open');
    panel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (!isOpen) return;
        panel.classList.add('is-opening');
        clearTimeout(openTimer);
        openTimer = setTimeout(function() {
          panel.classList.remove('is-opening');
          panel.classList.add('is-open');
        }, 420);
      });
    });

    if (!leadData || forceLeadForm) {
      showLeadForm();
      setTimeout(function() {
        var n = document.getElementById('lead-name');
        if (n) n.focus();
      }, 380);
    } else {
      showChat();
      setTimeout(function() { input.focus(); }, 380);
    }
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    clearTimeout(openTimer);
    panel.classList.remove('is-opening', 'is-open');
    panel.classList.add('is-closing');
    panel.setAttribute('aria-hidden', 'true');
    hideOverlay();
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function() {
      panel.classList.remove('is-closing');
      panel.style.display = 'none';
      widget.classList.remove('chat-widget--open');
    }, 360);
  }

  // touchstart fires immediately on iOS (no 300 ms delay);
  // click fires ~300 ms later — guard with a flag to avoid double-fire
  var touchHandled = false;
  bubble.addEventListener('touchstart', function(e) {
    e.preventDefault();
    touchHandled = true;
    if (isOpen) { closePanel(); } else { openPanel(false); }
  }, { passive: false });
  bubble.addEventListener('click', function() {
    if (touchHandled) { touchHandled = false; return; }
    if (isOpen) { closePanel(); } else { openPanel(false); }
  });

  var closeBtnTouched = false;
  closeBtn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    closeBtnTouched = true;
    closePanel();
  }, { passive: false });
  closeBtn.addEventListener('click', function() {
    if (closeBtnTouched) { closeBtnTouched = false; return; }
    closePanel();
  });

  // Exposed globally so FAQ "Consultar ahora" button can trigger it
  window.openChatWithLeadForm = function() {
    openPanel(!leadData);
  };

  // ── Lead form submit ──
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.getElementById('chat-lead-submit').addEventListener('click', submitLeadForm);
  ['lead-name', 'lead-email', 'lead-phone'].forEach(function(id) {
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); submitLeadForm(); }
    });
  });

  function submitLeadForm() {
    var nameVal  = document.getElementById('lead-name').value.trim();
    var emailVal = document.getElementById('lead-email').value.trim();
    var phoneVal = document.getElementById('lead-phone').value.trim();
    var errorEl  = document.getElementById('chat-lead-error');

    if (!nameVal) {
      errorEl.textContent = 'Por favor ingresa tu nombre completo.';
      document.getElementById('lead-name').focus();
      return;
    }
    if (!emailVal || !emailRe.test(emailVal)) {
      errorEl.textContent = 'Ingresa un correo electrónico válido.';
      document.getElementById('lead-email').focus();
      return;
    }
    if (!phoneVal) {
      errorEl.textContent = 'Por favor ingresa tu número de teléfono.';
      document.getElementById('lead-phone').focus();
      return;
    }

    errorEl.textContent = '';
    leadData = { name: nameVal, email: emailVal, phone: phoneVal };

    showChat();
    var typingEl = showTyping();
    setTimeout(function() {
      typingEl.remove();
      addMessage(getWelcome(leadData.name), 'bot');
      input.focus();
    }, 820);
  }

  // ── Assistant identity (random per session) ────────────────────────────────
  var assistantNames = ['Carlos', 'Santiago', 'Andrés', 'Camilo', 'Juanita', 'Valentina', 'Felipe', 'Manuela'];
  var assistantName  = assistantNames[Math.floor(Math.random() * assistantNames.length)];

  // Name-question patterns — answered locally without API call
  var nameQuestionRe = /cómo te llamas|como te llamas|cuál es tu nombre|cual es tu nombre|tu nombre|quién eres|quien eres|cómo te dicen|como te dicen/i;
  var nameReplies = [
    'Me llamo <strong>{name}</strong>, asistente de VoltGrid Ingeniería. ¿En qué te puedo orientar hoy?',
    '¡Hola! Soy <strong>{name}</strong> — el asistente de VoltGrid. Cuéntame tu consulta.',
    'Mi nombre es <strong>{name}</strong>. Estoy aquí para ayudarte con servicios de VoltGrid Ingeniería. ¿Qué necesitas?',
  ];
  var nameReplyIdx = 0;
  function getNameReply() {
    var tpl = nameReplies[nameReplyIdx++ % nameReplies.length];
    return tpl.replace(/{name}/g, assistantName);
  }

  // ── AI reply via /api/chat ──────────────────────────────────────────────────
  // Smart local fallback — answers from knowledge base when API is unavailable
  var localRules = [
    {
      test: /qu[eé] ofrecen|qu[eé] hacen|servicios|qu[eé] hace voltgrid|a qu[eé] se dedican/i,
      reply: 'VoltGrid Ingeniería ofrece los siguientes servicios:<br><br>⚡ <strong>Certificación RETIE</strong> — inspección técnica, verificación normativa y acompañamiento en el proceso.<br>🔌 <strong>Instalaciones eléctricas</strong> — residenciales, comerciales e industriales.<br>☀️ <strong>Energía solar</strong> — análisis de viabilidad, diseño e instalación fotovoltaica.<br>📋 <strong>Asesorías técnicas</strong> — cumplimiento RETIE, diseño eléctrico y diagnóstico de fallas.<br><br>¿Te gustaría saber más sobre alguno?'
    },
    {
      test: /retie|certificaci[oó]n|inspecci[oó]n|norma|cumplimiento/i,
      reply: 'Realizamos <strong>certificación RETIE</strong> para garantizar que las instalaciones eléctricas cumplan la normativa vigente en Colombia. Incluye inspección técnica, verificación de cumplimiento, recomendaciones de mejora y acompañamiento en todo el proceso.<br><br>¿Es para un proyecto residencial, comercial o industrial?'
    },
    {
      test: /solar|fotovoltai|paneles|energ[ií]a solar/i,
      reply: 'Ofrecemos soluciones completas en <strong>energía solar fotovoltaica</strong>: análisis de viabilidad, diseño del sistema, instalación y recomendaciones de uso eficiente.<br><br>Podemos ayudarte a reducir costos de energía tanto en viviendas como en empresas. ¿Cuéntame de tu proyecto?'
    },
    {
      test: /instalaci[oó]n el[eé]ctrica|instalar|cableado|el[eé]ctrico/i,
      reply: 'Diseñamos, ejecutamos y optimizamos <strong>instalaciones eléctricas</strong> para viviendas, locales comerciales, oficinas y proyectos industriales. Incluye instalaciones nuevas, mantenimiento, adecuaciones y ampliaciones.'
    },
    {
      test: /asesor[ií]a|diagn[oó]stico|falla|optimizaci[oó]n/i,
      reply: 'Brindamos <strong>asesorías técnicas especializadas</strong> en cumplimiento RETIE, diseño de sistemas eléctricos, diagnóstico de fallas y optimización energética. El objetivo es ayudarte a tomar decisiones técnicas seguras y eficientes.'
    },
    {
      test: /proceso|pasos|c[oó]mo funciona|c[oó]mo inician|c[oó]mo empiezan/i,
      reply: 'Nuestro proceso es sencillo:<br><br>1️⃣ <strong>Contacto inicial</strong> — nos describes tu proyecto.<br>2️⃣ <strong>Evaluación</strong> — analizamos y realizamos visita técnica si es necesario.<br>3️⃣ <strong>Cotización</strong> — propuesta clara con alcance, tiempos y costos.<br>4️⃣ <strong>Ejecución</strong> — realizamos el trabajo técnico.<br>5️⃣ <strong>Seguimiento</strong> — verificamos el cumplimiento y brindamos acompañamiento.<br><br>¿Quieres empezar?'
    },
    {
      test: /tiempo|cu[aá]nto tarda|demora|d[ií]as|plazo/i,
      reply: 'Los tiempos dependen del tipo de proyecto. En instalaciones residenciales pequeñas, la certificación RETIE puede tardar entre 2 y 5 días hábiles. Proyectos más grandes requieren más tiempo por inspecciones y validaciones adicionales.<br><br>Para darte un tiempo exacto, cuéntanos sobre tu proyecto.'
    },
    {
      test: /precio|costo|cu[aá]nto cuesta|tarifa|cobran|cotizaci[oó]n|presupuesto/i,
      reply: 'Los precios varían según el tipo y tamaño del proyecto. Para darte una cotización precisa y sin compromisos, contáctanos por <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> o déjanos tu número y te respondemos a la brevedad. 📲'
    },
    {
      test: /bogot[aá]|d[oó]nde|ubicaci[oó]n|cobertura|municipio|cundinamarca/i,
      reply: 'Prestamos servicios en toda la ciudad de <strong>Bogotá</strong> y municipios de <strong>Cundinamarca</strong> dependiendo del tipo de proyecto. Para zonas fuera de estas áreas, realizamos una evaluación previa. 📍'
    },
    {
      test: /contacto|whatsapp|tel[eé]fono|llamar|correo|email|escribir/i,
      reply: 'Puedes contactarnos directamente por <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> o al correo <strong>voltgridingenieria@gmail.com</strong>. Te respondemos a la brevedad. 📧'
    },
    {
      test: /residencial|casa|apartamento|hogar|vivienda/i,
      reply: 'Sí, trabajamos con proyectos <strong>residenciales</strong>: instalaciones nuevas, mantenimiento, certificación RETIE y sistemas de energía solar para casas y apartamentos. ¿Tienes un proyecto específico en mente?'
    },
    {
      test: /comercial|empresa|oficina|local|industrial/i,
      reply: 'Atendemos proyectos <strong>comerciales e industriales</strong>: instalaciones eléctricas, certificación RETIE, asesorías técnicas y soluciones en energía solar adaptadas a cada negocio. ¿Cuéntame sobre tu proyecto?'
    },
    {
      test: /hola|buenos|buenas|hi\b|hey/i,
      reply: '¡Hola! ¿En qué te puedo ayudar hoy? Puedo orientarte sobre nuestros servicios de RETIE, instalaciones eléctricas y energía solar. ⚡'
    },
    {
      test: /gracias|perfecto|genial|excelente|listo/i,
      reply: '¡Con mucho gusto! Si tienes más preguntas, aquí estoy. VoltGrid te ayuda. 😊'
    },
    {
      test: /cu[aá]ntos a[ñn]os|qu[eé] edad|eres humano|eres una? (ia|inteligencia|m[aá]quina|robot|bot)|eres (real|persona)|sientes|piensas|tienes sentimientos/i,
      reply: 'Soy un asistente virtual, así que no tengo edad ni emociones como tal 😄 Pero estoy aquí para ayudarte con todo lo relacionado a VoltGrid Ingeniería: RETIE, instalaciones eléctricas y energía solar. ¿En qué te puedo orientar?'
    },
    {
      test: /cu[aá]l es tu (trabajo|funci[oó]n|prop[oó]sito|rol)|para qu[eé] sirves|en qu[eé] me ayudas/i,
      reply: 'Estoy aquí para orientarte sobre los servicios de VoltGrid Ingeniería: certificación RETIE, instalaciones eléctricas, energía solar y asesorías técnicas. ¿Sobre cuál te gustaría saber más?'
    },
  ];
  var genericFallbacks = [
    'Para esa consulta específica, te recomiendo hablar directamente con nuestro equipo. Escríbenos por <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> y te atendemos de inmediato. 📲',
    'Esa pregunta la puede responder mejor uno de nuestros asesores. ¿Te gustaría que te contactemos por <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>?',
  ];
  var genericIdx = 0;

  // Lead intent detector (mirrors server-side logic)
  var leadIntentRe = /cotiz|presupuesto|cu[aá]nto cuesta|precio|contratar|quiero (aplicar|instalar|hacer|pedir|solicitar|comprar)|me gustar[ií]a|quisiera (instalar|aplicar|contratar|hacer)|agendar|necesito un (servicio|t[eé]cnico|instalador|ingeniero)/i;
  function localLeadIntent(text) { return leadIntentRe.test(text); }

  // Returns a matched reply or null (null = let AI handle it)
  function getLocalMatch(text) {
    for (var i = 0; i < localRules.length; i++) {
      if (localRules[i].test.test(text)) return localRules[i].reply;
    }
    return null;
  }

  // Used only when the API call itself fails (network error, no key, etc.)
  function getApiFallback(text) {
    var match = getLocalMatch(text);
    return match || genericFallbacks[genericIdx++ % genericFallbacks.length];
  }

  // Varied welcome messages shown after lead form submission
  var welcomeVariants = [
    '¡Bienvenido, <strong>{name}</strong>! VoltGrid te ayuda. Cuéntame qué servicio necesitas y te oriento paso a paso. ⚡',
    'Listo, <strong>{name}</strong>. Energía clara para decisiones seguras. ¿Sobre qué puedo orientarte hoy?',
    'Gracias, <strong>{name}</strong>. Impulsando soluciones con precisión — cuéntame tu consulta.',
    'Perfecto, <strong>{name}</strong>. Estoy aquí para ayudarte con RETIE, instalaciones eléctricas o energía solar. ¿Por dónde empezamos?',
  ];
  var welcomeIdx = 0;
  function getWelcome(name) {
    var tpl = welcomeVariants[welcomeIdx++ % welcomeVariants.length];
    return tpl.replace(/{name}/g, name);
  }

  // Sends a user message to the AI backend and calls cb(replyHTML, leadIntent)
  var isSending = false;
  function askAI(text, cb) {
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, leadName: leadData ? leadData.name : null, assistantName: assistantName }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) { cb(data.reply || getApiFallback(text), !!data.leadIntent); })
    .catch(function()   { cb(getApiFallback(text), false); });
  }

  function scrollMessages() {
    setTimeout(function() { messages.scrollTop = messages.scrollHeight; }, 50);
  }

  function addMessage(html, type) {
    var div = document.createElement('div');
    div.className = 'chat-msg chat-msg--' + type;
    div.innerHTML = html;
    messages.appendChild(div);
    scrollMessages();
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'chat-msg chat-msg--typing';
    div.innerHTML = '<div class="chat-typing-dots"><span></span><span></span><span></span></div>';
    messages.appendChild(div);
    scrollMessages();
    return div;
  }

  function sendMessage(text) {
    text = text.trim();
    if (!text) return;
    addMessage(text, 'user');
    input.value = '';
    var chips = messages.querySelector('.chat-suggestions');
    if (chips) chips.style.display = 'none';

    // Intercept name questions — no API call needed
    if (nameQuestionRe.test(text)) {
      var typingShort = showTyping();
      setTimeout(function() {
        typingShort.remove();
        addMessage(getNameReply(), 'bot');
      }, 600);
      return;
    }

    // Check local rules first — instant answer, no API call needed
    var localMatch = getLocalMatch(text);
    if (localMatch) {
      var typingLocal = showTyping();
      var hasIntent = localLeadIntent(text);
      setTimeout(function() {
        typingLocal.remove();
        addMessage(localMatch, 'bot');
        if (hasIntent) {
          setTimeout(function() {
            addMessage('Parece que tienes un proyecto en mente. ¿Te gustaría que uno de nuestros asesores te contacte? Escríbenos por <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> y te atendemos de inmediato. 📲', 'bot');
          }, 700);
        }
        input.focus();
      }, 500);
      return;
    }

    // No local match — send to AI for open-ended questions
    var typingEl = showTyping();
    isSending = true;
    input.disabled = true;
    sendBtn.disabled = true;
    askAI(text, function(reply, leadIntent) {
      isSending = false;
      input.disabled = false;
      sendBtn.disabled = false;
      typingEl.remove();
      addMessage(reply, 'bot');
      // If the user shows buying/contact intent, offer a WhatsApp nudge
      if (leadIntent) {
        setTimeout(function() {
          addMessage('¿Te gustaría hablar con un asesor? Escríbenos directamente por <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> para atención inmediata. 📲', 'bot');
        }, 700);
      }
      input.focus();
    });
  }

  sendBtn.addEventListener('click', function() { sendMessage(input.value); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(input.value); }
  });

  messages.addEventListener('click', function(e) {
    var chip = e.target.closest('.chat-suggestion');
    if (chip) sendMessage(chip.getAttribute('data-msg'));
  });
})();

// Premium Hamburger Navigation
(function() {
  var hamburger = document.getElementById('nav-hamburger');
  var panel     = document.getElementById('nav-panel');
  var overlay   = document.getElementById('nav-overlay');

  if (!hamburger || !panel) return;

  var isOpen = false;

  function openNav() {
    isOpen = true;
    hamburger.classList.add('is-active');
    panel.classList.add('is-open');
    overlay.classList.add('is-visible');
    hamburger.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = '';
  }

  function closeNav() {
    isOpen = false;
    hamburger.classList.remove('is-active');
    panel.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    hamburger.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', function(e) {
    e.stopPropagation();
    if (isOpen) { closeNav(); } else { openNav(); }
  });

  overlay.addEventListener('click', closeNav);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) { closeNav(); hamburger.focus(); }
  });

  panel.addEventListener('click', function(e) {
    if (e.target.tagName === 'A') { closeNav(); }
  });
})();

// FAQ accordion
function toggleFaq(btn) {
    const item = btn.closest('.faq-item');
    const answer = item.querySelector('.faq-answer');
    const icon = item.querySelector('.faq-icon');
    const isOpen = item.classList.contains('faq-item--open');

    document.querySelectorAll('.faq-item--open').forEach(function(openItem) {
        openItem.classList.remove('faq-item--open');
        openItem.querySelector('.faq-answer').style.display = 'none';
    });

    if (!isOpen) {
        item.classList.add('faq-item--open');
        answer.style.display = 'block';
    }
}

// Counter animation
function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var duration = 1800;
    var start = null;
    function step(timestamp) {
        if (!start) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target;
    }
    requestAnimationFrame(step);
}

function initCounters() {
    var grid = document.getElementById('metrics-grid');
    if (!grid) return;
    var triggered = false;
    var observer = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting && !triggered) {
            triggered = true;
            grid.querySelectorAll('.counter').forEach(animateCounter);
            observer.disconnect();
        }
    }, { threshold: 0.25 });
    observer.observe(grid);
}

// Smooth scrolling for navigation
function scrollToContact() {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Scroll animations
function handleScrollAnimation() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const elementBottom = element.getBoundingClientRect().bottom;
        const windowHeight = window.innerHeight;
        
        if (elementTop < windowHeight * 0.8 && elementBottom > 0) {
            element.classList.add('animated');
        }
    });
}

// Navbar scroll effect
function handleNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
}

// Add animation classes to elements
function addAnimationClasses() {
    const sections = document.querySelectorAll('section:not(#scroll-section)');
    sections.forEach((section, index) => {
        section.classList.add('animate-on-scroll');
        section.style.animationDelay = `${index * 0.1}s`;
    });
    
    const serviceCards = document.querySelectorAll('.service-card');
    serviceCards.forEach((card, index) => {
        card.classList.add('animate-on-scroll');
        card.style.animationDelay = `${index * 0.15}s`;
    });
    
    const approachItems = document.querySelectorAll('.approach-item');
    approachItems.forEach((item, index) => {
        item.classList.add('animate-on-scroll');
        item.style.animationDelay = `${index * 0.1}s`;
    });
}

// Initialize animations on page load
document.addEventListener('DOMContentLoaded', function() {
    addAnimationClasses();
    handleScrollAnimation();
    handleNavbarScroll();
    initCounters();

    // FAQ Consult Button — mouse-tracking glow (desktop only)
    var isTouchDevice = window.matchMedia('(hover: none)').matches;
    if (!isTouchDevice) {
        document.querySelectorAll('.faq-consult-btn').forEach(function(btn) {
            btn.addEventListener('mousemove', function(e) {
                var rect = btn.getBoundingClientRect();
                var x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%';
                var y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
                btn.style.setProperty('--mx', x);
                btn.style.setProperty('--my', y);
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.setProperty('--mx', '50%');
                btn.style.setProperty('--my', '50%');
            });
        });
    }

    // Dynamic Island touch lift for mobile
    document.querySelectorAll('.service-card, .metric-card, .sector-card, .about-card, .contact-card, .faq-cta-box').forEach(function(el) {
        el.addEventListener('touchstart', function() {
            el.classList.add('is-active');
        }, { passive: true });
        el.addEventListener('touchend', function() {
            setTimeout(function() { el.classList.remove('is-active'); }, 180);
        }, { passive: true });
        el.addEventListener('touchcancel', function() {
            el.classList.remove('is-active');
        }, { passive: true });
    });
    
    
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// Scroll and resize event listeners are registered below with debouncing

// Add loading animation
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
    
    // Animate hero content
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.classList.add('fade-in-up');
    }
});

// Form validation (if contact form is added later)
function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        if (input.hasAttribute('required') && !input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }
    });
    
    return isValid;
}

// Phone number formatting
function formatPhoneNumber(input) {
    const phoneNumber = input.value.replace(/\D/g, '');
    const phoneNumberLength = phoneNumber.length;
    
    if (phoneNumberLength < 4) {
        return phoneNumber;
    } else if (phoneNumberLength < 7) {
        return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    } else {
        return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    }
}

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Add CSS for ripple effect
const rippleCSS = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .loaded .hero-content {
        animation: fadeInUp 1s ease-out;
    }
    
    input.error, textarea.error {
        border-color: #e53e3e !important;
        box-shadow: 0 0 0 1px #e53e3e !important;
    }
`;

// Inject ripple CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = rippleCSS;
document.head.appendChild(styleSheet);

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to scroll handlers
const debouncedScrollAnimation = debounce(handleScrollAnimation, 10);
const debouncedNavbarScroll = debounce(handleNavbarScroll, 10);

window.addEventListener('scroll', debouncedScrollAnimation, { passive: true });
window.addEventListener('scroll', debouncedNavbarScroll, { passive: true });
window.addEventListener('resize', debouncedScrollAnimation, { passive: true });

// Lazy loading for images (if added later)
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Initialize lazy loading
lazyLoadImages();

// Analytics tracking (placeholder)
function trackEvent(eventName, properties = {}) {
    // Placeholder for analytics implementation
    console.log('Event tracked:', eventName, properties);
}

// Track button clicks
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn')) {
        const buttonText = e.target.textContent.trim();
        trackEvent('Button Click', { button: buttonText });
    }
});

// Track scroll depth
let maxScroll = 0;
window.addEventListener('scroll', function() {
    const scrollPercentage = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    if (scrollPercentage > maxScroll) {
        maxScroll = scrollPercentage;
        
        // Track milestones
        if (maxScroll >= 25 && maxScroll < 26) {
            trackEvent('Scroll Milestone', { depth: '25%' });
        } else if (maxScroll >= 50 && maxScroll < 51) {
            trackEvent('Scroll Milestone', { depth: '50%' });
        } else if (maxScroll >= 75 && maxScroll < 76) {
            trackEvent('Scroll Milestone', { depth: '75%' });
        } else if (maxScroll >= 90 && maxScroll < 91) {
            trackEvent('Scroll Milestone', { depth: '90%' });
        }
    }
});

// Accessibility improvements
function addAccessibilityFeatures() {
    // Add ARIA labels to external links
    const externalLinks = document.querySelectorAll('a[target="_blank"]');
    externalLinks.forEach(link => {
        if (!link.getAttribute('aria-label')) {
            link.setAttribute('aria-label', `${link.textContent} (abre en nueva pestaña)`);
        }
    });
    
    // Add keyboard navigation for service cards
    const serviceCards = document.querySelectorAll('.service-card');
    serviceCards.forEach((card, index) => {
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'article');
        card.setAttribute('aria-label', `Servicio ${index + 1}: ${card.querySelector('.service-title').textContent}`);
    });
}

// Initialize accessibility features
addAccessibilityFeatures();

// ── Lead Capture Form ──
(function() {
  var form    = document.getElementById('lead-capture-form');
  var success = document.getElementById('lf-success');
  var errEl   = document.getElementById('lf-error');
  if (!form) return;

  function clearErrors() {
    errEl.textContent = '';
    form.querySelectorAll('.lf-input--error').forEach(function(el) {
      el.classList.remove('lf-input--error');
    });
  }

  function setError(el, msg) {
    el.classList.add('lf-input--error');
    errEl.textContent = msg;
    el.focus();
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    clearErrors();

    var nombre   = document.getElementById('lf-nombre');
    var telefono = document.getElementById('lf-telefono');
    var tipo     = document.getElementById('lf-tipo');

    if (!nombre.value.trim()) {
      setError(nombre, 'Por favor ingresa tu nombre.');
      return;
    }
    if (!telefono.value.trim()) {
      setError(telefono, 'Por favor ingresa tu número de contacto.');
      return;
    }
    if (!tipo.value) {
      setError(tipo, 'Por favor selecciona el tipo de proyecto.');
      return;
    }

    form.style.display = 'none';
    success.style.display = 'flex';
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();

// Console branding
console.log('%cVoltGrid Ingeniería', 'font-size: 20px; font-weight: bold; color: #0d2341;');
console.log('%cPrecisión técnica para cumplir, seguridad para confiar', 'font-size: 14px; color: #d4af37;');
