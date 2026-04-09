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

  // ── Avatar (random per session from 6 icons) ───────────────────────────────
  var avatarFiles = [
    'chat-avatars/avatar-1-agent.png',
    'chat-avatars/avatar-2-bulb.png',
    'chat-avatars/avatar-3-tower.png',
    'chat-avatars/avatar-4-factory.png',
    'chat-avatars/avatar-5-brain.png',
    'chat-avatars/avatar-6-compass.png',
  ];
  var avatarImg = document.getElementById('chat-avatar-img');
  if (avatarImg) {
    avatarImg.src = avatarFiles[Math.floor(Math.random() * avatarFiles.length)];
  }

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
  // Smart local rules — cover the most common chat scenarios without the API.
  // Order matters: more specific rules first to avoid false matches.
  var localRules = [

    // ── Emergencias eléctricas ────────────────────────────────────────────────
    {
      test: /corto.?circuito|chispa[s]?|huele a quemado|olor a quemado|se incendi|humo en (el|un) (tomacorriente|breaker|interruptor|cable|panel)|est[aá] quemad/i,
      reply: '⚠️ <strong>Esto suena a una emergencia eléctrica.</strong> Por seguridad, desconecta el breaker general si puedes hacerlo sin riesgo y no toques cables expuestos.<br><br>Contáctanos de inmediato por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> para orientación rápida con nuestro equipo técnico. 🚨'
    },
    {
      test: /se fue la luz|no hay luz|sin energ[ií]a|cortaron la luz|apag[oó]n|se fue la energ[ií]a|no tengo energ[ií]a|se tripp?[oó]|se trip[oó]|se fue el servicio/i,
      reply: 'Si la interrupción es en toda la zona, puede ser una falla del proveedor de energía — revisa con tus vecinos. Si solo es en tu inmueble, es posible que un breaker haya saltado o haya una falla interna.<br><br>Si necesitas una revisión técnica, contáctanos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. 🔦'
    },
    {
      test: /urgente|emergencia|r[aá]pido|lo antes posible|lo m[aá]s pronto|cuanto antes|necesito ayuda ya|auxilio/i,
      reply: 'Entendemos que es urgente. Escríbenos directamente por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> para que nuestro equipo te atienda a la brevedad. Estamos disponibles para ayudarte. ⚡'
    },

    // ── Saludos ───────────────────────────────────────────────────────────────
    {
      test: /^(hola|hola!|ola|buenas?|buenos? d[ií]as?|buenos? tardes?|buenos? noches?|hi\b|hey\b|saludos|buen d[ií]a|qu[eé] tal|qu[eé] hubo|qu[eé] m[aá]s|qu[eé] hay)/i,
      reply: '¡Hola! Bienvenido a VoltGrid Ingeniería. ¿En qué te puedo ayudar hoy? Puedo orientarte sobre certificación RETIE, instalaciones eléctricas y energía solar. ⚡'
    },

    // ── Despedidas ────────────────────────────────────────────────────────────
    {
      test: /adi[oó]s|chao|hasta luego|hasta pronto|nos vemos|bye\b|hasta ma[ñn]ana|cu[ií]date|hasta cualquier rato/i,
      reply: '¡Hasta pronto! Si en algún momento necesitas orientación sobre tus proyectos eléctricos o de energía solar, aquí estamos. VoltGrid te ayuda. 😊⚡'
    },

    // ── Agradecimientos ───────────────────────────────────────────────────────
    {
      test: /gracias|muchas gracias|mil gracias|te agradezco|muy amable|excelente|perfecto|genial|est[aá] bien|listo|ok\b|okay\b|claro|entendido|understood/i,
      reply: '¡Con mucho gusto! Si tienes más preguntas, aquí estoy. VoltGrid te ayuda. 😊'
    },

    // ── Servicios generales ───────────────────────────────────────────────────
    {
      test: /qu[eé] ofrece[sn]?|qu[eé] hacen|qu[eé] hace voltgrid|a qu[eé] se dedican|qu[eé] tienen disponible|qu[eé] tipos? de (trabajo|servicio)|en qu[eé] (se especializan|trabajan|ayudan)|tienen electricistas?|tienen ingenieros?|qu[eé] manejan/i,
      reply: 'VoltGrid Ingeniería ofrece los siguientes servicios:<br><br>⚡ <strong>Certificación RETIE</strong> — inspección y acompañamiento normativo.<br>🔌 <strong>Instalaciones eléctricas</strong> — residenciales, comerciales e industriales.<br>☀️ <strong>Energía solar</strong> — análisis, diseño e instalación fotovoltaica.<br>📋 <strong>Asesorías técnicas</strong> — diseño eléctrico, diagnóstico de fallas y optimización.<br>🔧 <strong>Mantenimiento</strong> — revisiones periódicas y correctivas.<br><br>¿Te gustaría saber más sobre alguno?'
    },

    // ── RETIE ─────────────────────────────────────────────────────────────────
    {
      test: /retie|certificaci[oó]n (el[eé]ctrica|retie)|me exigen|exige la norma|reglamento t[eé]cnico|norma (el[eé]ctrica|retie)|inspecci[oó]n (el[eé]ctrica|retie)|cumplimiento (retie|normativo)|me piden (retie|inspecci[oó]n|certificado)|paz y salvo el[eé]ctrico/i,
      reply: 'Realizamos <strong>certificación RETIE</strong> para garantizar que las instalaciones eléctricas cumplan la normativa vigente en Colombia. El servicio incluye inspección técnica, verificación de cumplimiento, recomendaciones de mejora y acompañamiento completo en el proceso.<br><br>¿Es para un inmueble residencial, comercial o industrial?'
    },

    // ── Energía solar ─────────────────────────────────────────────────────────
    {
      test: /solar|fotovoltai|paneles? (solares?)?|energ[ií]a solar|sistema solar|autoconsumo|generaci[oó]n propia|factura (de energ[ií]a|de luz) (alta|cara|muy (alta|cara))|bajar (la factura|el recibo|el consumo)|ahorro de energ[ií]a|independencia energ[eé]tica/i,
      reply: 'Ofrecemos soluciones completas en <strong>energía solar fotovoltaica</strong>: análisis de viabilidad, diseño del sistema, instalación y recomendaciones de uso eficiente.<br><br>Es una excelente forma de reducir tu factura de energía a largo plazo, tanto en viviendas como en negocios. ¿Es para uso residencial o comercial?'
    },

    // ── Instalaciones eléctricas ──────────────────────────────────────────────
    {
      test: /instalaci[oó]n el[eé]ctrica|instalar (tomacorriente|interruptor|breaker|panel|luz|cable|red el[eé]ctrica)|cableado|red el[eé]ctrica|puntos (de luz|el[eé]ctricos)|toma.?corriente|rosetas?|ampliaci[oó]n el[eé]ctrica|adecuaci[oó]n el[eé]ctrica|obra el[eé]ctrica/i,
      reply: 'Diseñamos, ejecutamos y optimizamos <strong>instalaciones eléctricas</strong> para viviendas, locales comerciales, oficinas y proyectos industriales. Incluye instalaciones nuevas, mantenimiento, adecuaciones, ampliaciones y optimización de redes existentes.<br><br>¿Cuéntame sobre tu proyecto?'
    },

    // ── Mantenimiento ─────────────────────────────────────────────────────────
    {
      test: /mantenimiento|revisi[oó]n (el[eé]ctrica|de la instalaci[oó]n|peri[oó]dica)|inspecci[oó]n de (la instalaci[oó]n|redes|cables)|chequeo|verificaci[oó]n el[eé]ctrica|rutina el[eé]ctrica/i,
      reply: 'Sí, realizamos <strong>mantenimiento eléctrico</strong> preventivo y correctivo: revisión de instalaciones, detección de fallas, verificación de breakers y paneles, y adecuaciones necesarias. Es importante hacerlo periódicamente para garantizar seguridad.<br><br>¿Es para una casa, local o empresa?'
    },

    // ── Diagnóstico / fallas ──────────────────────────────────────────────────
    {
      test: /diagn[oó]stico|falla|averia|da[ñn]o el[eé]ctrico|no (funciona|enciende|prende)|problem[a]? el[eé]ctrico|por qu[eé] (se va|salta|se dispara) (el breaker|el taco|el interruptor)|asesor[ií]a t[eé]cnica|revisi[oó]n de (fallas?|da[ñn]os?)/i,
      reply: 'Brindamos <strong>diagnóstico y asesoría técnica</strong> para identificar fallas eléctricas, problemas con breakers o paneles, y evaluar el estado general de la instalación. Nuestro objetivo es darte una solución segura y eficiente.<br><br>¿Quieres que un técnico te contacte?'
    },

    // ── Proceso / cómo funciona ───────────────────────────────────────────────
    {
      test: /c[oó]mo (es el proceso|funciona|trabajan|contratar|empezar|iniciar|solicitar|pedir|agendar)|pasos? (para|a seguir)|proceso (de trabajo|de servicio|de contrataci[oó]n)|qu[eé] (hago|tengo que hacer|necesito hacer) para (empezar|contratar|solicitar)/i,
      reply: 'Nuestro proceso es claro y sencillo:<br><br>1️⃣ <strong>Contacto</strong> — nos describes tu proyecto por WhatsApp o formulario.<br>2️⃣ <strong>Evaluación</strong> — analizamos y agendamos visita técnica si aplica.<br>3️⃣ <strong>Cotización</strong> — propuesta detallada con alcance, tiempos y costos.<br>4️⃣ <strong>Ejecución</strong> — realizamos el trabajo con personal calificado.<br>5️⃣ <strong>Seguimiento</strong> — verificamos resultados y brindamos acompañamiento.<br><br>¿Quieres empezar ahora?'
    },

    // ── Tiempos / duración ────────────────────────────────────────────────────
    {
      test: /cu[aá]nto (tarda|demora|se demora|tiempo toma|tiempo lleva)|cu[aá]ntos d[ií]as|plazo de entrega|en cu[aá]nto tiempo|cu[aá]ndo estar[ií]a listo|tiempo de ejecuci[oó]n|cu[aá]ndo (pueden|pueden venir|empiezan)/i,
      reply: 'Los tiempos varían según el tipo de proyecto:<br><br>🔹 <strong>Certificación RETIE residencial</strong>: 2–5 días hábiles.<br>🔹 <strong>Instalaciones pequeñas</strong>: 1–3 días.<br>🔹 <strong>Proyectos comerciales o industriales</strong>: depende del alcance.<br><br>Para darte un tiempo exacto, cuéntanos sobre tu proyecto o escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>.'
    },

    // ── Precios / cotización ──────────────────────────────────────────────────
    {
      test: /precio|costo|cu[aá]nto (cobran|cuesta|vale|sale)|tarifa|cobran|cotizaci[oó]n|presupuesto|son caros?|es caro|qu[eé] tan costoso|maneja[sn]? precios|valor del servicio/i,
      reply: 'Los precios dependen del tipo, tamaño y complejidad de cada proyecto. Para darte una <strong>cotización precisa y sin compromisos</strong>, escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> con los detalles de tu proyecto. 📲'
    },

    // ── Formas de pago ────────────────────────────────────────────────────────
    {
      test: /forma[s]? de pago|m[eé]todos? de pago|pagan?|aceptan (tarjeta|efectivo|transferencia|nequi|daviplata|pse)|pago contra entrega|financiamiento|cr[eé]dito|cuotas|abono/i,
      reply: 'Para información sobre métodos de pago disponibles, te recomendamos consultarlo directamente con nuestro equipo por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. Así te confirmamos las opciones para tu proyecto específico. 💳'
    },

    // ── Cobertura / ubicación ─────────────────────────────────────────────────
    {
      test: /bogot[aá]|d[oó]nde (est[aá]n|quedan|operan|trabajan)|ubicaci[oó]n|cobertura|municipio|cundinamarca|soacha|ch[ií]a|zipaquir[aá]|facatativ[aá]|funza|madrid|mosquera|la calera|bosa|suba|usme|kennedy|engativ[aá]|van a |atienden en|trabajan en/i,
      reply: 'Prestamos servicios en toda la ciudad de <strong>Bogotá</strong> y municipios de <strong>Cundinamarca</strong> según el tipo de proyecto. Para zonas más lejanas, realizamos una evaluación previa de viabilidad. 📍<br><br>¿En qué zona o municipio necesitas el servicio?'
    },

    // ── Visita técnica ────────────────────────────────────────────────────────
    {
      test: /visita (t[eé]cnica|a (mi casa|el local|la empresa|el inmueble|el sitio))|pueden venir|ir al lugar|desplazarse|vienen a ver|hacen visita|revisi[oó]n en (sitio|el lugar)|inspecci[oó]n en (sitio|el lugar)/i,
      reply: 'Sí, realizamos <strong>visitas técnicas</strong> para evaluar el estado de las instalaciones y definir el alcance del trabajo. En muchos casos es parte del proceso de cotización.<br><br>Escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> para agendar. 📅'
    },

    // ── Horario / disponibilidad ──────────────────────────────────────────────
    {
      test: /horario|trabajan (los fines de semana|s[aá]bado|domingo|festivos?)|disponibilidad|cu[aá]ndo atienden|en qu[eé] horario|est[aá]n disponibles|atienden hoy/i,
      reply: 'Para conocer nuestra disponibilidad y horarios de atención actualizados, escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. Nuestro equipo te confirma cuándo pueden atenderte. 🗓️'
    },

    // ── Garantía ──────────────────────────────────────────────────────────────
    {
      test: /garant[ií]a|qu[eé] pasa si (algo sale mal|falla|hay un problema)|responden por|responsabilidad|posventa|servicio postventa|qu[eé] incluye la garant[ií]a/i,
      reply: 'En VoltGrid Ingeniería nos comprometemos con la calidad de cada trabajo. Para conocer los términos de garantía aplicables a tu servicio específico, te recomendamos consultarlo con nuestro equipo por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. 🛡️'
    },

    // ── Documentos / certificados ─────────────────────────────────────────────
    {
      test: /documentos?|certificados?|qu[eé] (entregan|dan|incluye)|factura|soporte|informe t[eé]cnico|memoria t[eé]cnica|planos?|reportes?/i,
      reply: 'Al finalizar el servicio entregamos los documentos técnicos correspondientes según el tipo de trabajo (informe de inspección, certificado RETIE, memoria técnica, etc.). Para saber exactamente qué aplica a tu caso, escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. 📄'
    },

    // ── Requisitos para contratar ─────────────────────────────────────────────
    {
      test: /qu[eé] (necesito|requiero|debo tener|me piden|documentos necesito)|requisitos|qu[eé] me piden|c[oó]mo (me preparo|empiezo)|qu[eé] informaci[oó]n necesitan/i,
      reply: 'Para la mayoría de servicios solo necesitamos información básica de tu proyecto: ubicación del inmueble, tipo de uso (residencial, comercial, industrial) y descripción de lo que necesitas.<br><br>Nuestro equipo te guía en el proceso desde el primer contacto. ¿Quieres empezar ahora por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>?'
    },

    // ── Ahorro / rentabilidad solar ───────────────────────────────────────────
    {
      test: /cu[aá]nto (ahorro|bajo|reduzco|bajo|economizo)|es rentable (la solar|los paneles|la energ[ií]a solar)|retorno de inversi[oó]n|ROI|cu[aá]ndo se paga|se paga solo|vale la pena (la solar|los paneles)/i,
      reply: 'La energía solar puede reducir tu factura entre un <strong>50% y 90%</strong> dependiendo del sistema y tu consumo actual. El tiempo de retorno de inversión en Colombia suele estar entre 4 y 8 años, con una vida útil de los paneles de más de 25 años.<br><br>Para calcular el ahorro exacto para tu caso, escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. ☀️'
    },

    // ── Cuántos paneles necesito ──────────────────────────────────────────────
    {
      test: /cu[aá]ntos? paneles? (necesito|son necesarios|requiero|me hacen falta)|capacidad del sistema|kw|kilo.?watt|potencia del sistema/i,
      reply: 'El número de paneles depende de tu consumo eléctrico mensual (kWh) y el espacio disponible. En promedio, una casa en Bogotá necesita entre 6 y 16 paneles para cubrir su consumo.<br><br>Para una propuesta personalizada, escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> con tu última factura de energía. ☀️'
    },

    // ── Proyectos residenciales ───────────────────────────────────────────────
    {
      test: /residencial|mi casa|mi apartamento|mi hogar|mi vivienda|para la casa|en casa|inmueble residencial/i,
      reply: 'Trabajamos con todo tipo de proyectos <strong>residenciales</strong>: instalaciones nuevas, mantenimiento eléctrico, certificación RETIE y sistemas de energía solar para casas y apartamentos.<br><br>¿Qué servicio específico necesitas?'
    },

    // ── Proyectos comerciales / industriales ──────────────────────────────────
    {
      test: /comercial|mi empresa|mi negocio|mi local|mi oficina|industrial|bodega|f[aá]brica|planta/i,
      reply: 'Atendemos proyectos <strong>comerciales e industriales</strong>: instalaciones eléctricas, certificación RETIE, asesorías técnicas y energía solar adaptada a cada negocio. Contamos con experiencia en locales, oficinas, bodegas e instalaciones industriales.<br><br>¿Cuéntame sobre tu proyecto?'
    },

    // ── Contacto / hablar con alguien ─────────────────────────────────────────
    {
      test: /contacto|whatsapp|tel[eé]fono|n[uú]mero|llamar|correo|email|escribir|comunicarme|hablar con (un|alguien|el|una|el equipo)|asesor humano|persona real|t[eé]cnico|representante|agente/i,
      reply: 'Puedes contactar a nuestro equipo directamente por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> o escribirnos al correo <strong>voltgridingenieria@gmail.com</strong>. Te atendemos a la brevedad. 📧'
    },

    // ── Referencias / trabajos anteriores ─────────────────────────────────────
    {
      test: /referencias?|trabajos? anteriores?|trabajos? realizados?|portafolio|fotos? de (trabajos?|proyectos?)|pueden mostrar|ejemplos? de|clientes? anteriores?|testimonios?|opiniones?|rese[ñn]as?/i,
      reply: 'Para ver ejemplos de nuestros trabajos y referencias, te invitamos a escribirnos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. Nuestro equipo con gusto compartirá información de proyectos anteriores según el tipo de servicio que necesitas. 📸'
    },

    // ── Confiabilidad / certificaciones empresa ───────────────────────────────
    {
      test: /confiable[s]?|son buenos?|son serios?|seguros?|est[aá]n certificados?|tienen licencia|est[aá]n registrados?|respaldo|calidad|profesionales?|qu[eé] tan buenos?|puedo confiar/i,
      reply: 'VoltGrid Ingeniería trabaja bajo la <strong>normativa RETIE</strong> vigente en Colombia, garantizando que cada instalación cumpla los estándares de seguridad y calidad. Contamos con personal técnico calificado y acompañamiento en cada etapa del proyecto. 🛡️<br><br>¿Te gustaría más información sobre nuestro proceso?'
    },

    // ── Experiencia / trayectoria empresa ────────────────────────────────────
    {
      test: /cu[aá]ntos? a[ñn]os (tiene[sn]?|lleva[sn]?|operan|en el mercado|de experiencia|laborando|trabajando|fundad)|experiencia|trayectoria|desde cu[aá]ndo (existen|trabajan|est[aá]n|operan)|hace cu[aá]nto/i,
      reply: 'VoltGrid Ingeniería tiene experiencia en el sector eléctrico en Colombia, con un enfoque en calidad técnica y cumplimiento normativo. Para conocer más sobre nuestra trayectoria, escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>. 💼'
    },

    // ── Queja / problema con servicio ────────────────────────────────────────
    {
      test: /queja|reclamo|problem[a]? con (el servicio|su trabajo|la instalaci[oó]n)|no (funcion[oó]|qued[oó] bien|est[aá] bien)|mal trabajo|insatisfecho|inconveniente/i,
      reply: 'Lamentamos escuchar eso. En VoltGrid Ingeniería nos importa la satisfacción de cada cliente. Por favor escríbenos directamente por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> para revisar tu caso y encontrar una solución lo antes posible. 🙏'
    },

    // ── Identidad del bot ─────────────────────────────────────────────────────
    {
      test: /cu[aá]ntos? a[ñn]os tienes|qu[eé] edad tienes|eres humano|eres (una? )?(ia|inteligencia artificial|m[aá]quina|robot|bot)|eres (real|persona)|sientes|piensas|tienes sentimientos|eres (un programa|software)/i,
      reply: 'Soy un asistente virtual 🤖 No tengo edad ni emociones, pero estoy aquí para ayudarte con todo lo relacionado a VoltGrid Ingeniería. ¿En qué te puedo orientar?'
    },

    // ── Propósito del bot ─────────────────────────────────────────────────────
    {
      test: /cu[aá]l es tu (trabajo|funci[oó]n|prop[oó]sito|rol|objetivo)|para qu[eé] (sirves|est[aá]s)|en qu[eé] (me ayudas|puedes ayudar)|qu[eé] (puedes hacer|sabes hacer|puedes responder)/i,
      reply: 'Estoy aquí para orientarte sobre los servicios de VoltGrid Ingeniería: certificación RETIE, instalaciones eléctricas, energía solar, asesorías técnicas y más. También puedo ayudarte a iniciar el proceso de contacto con nuestro equipo. ¿Sobre qué te gustaría saber?'
    },
  ];
  var genericFallbacks = [
    'Para esa consulta específica, te recomiendo hablar directamente con nuestro equipo. Escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> y te atendemos de inmediato. 📲',
    'Esa pregunta la puede responder mejor uno de nuestros asesores. ¿Te gustaría que te contactemos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a>?',
  ];
  var genericIdx = 0;

  // Lead intent detector (mirrors server-side logic)
  var leadIntentRe = /cotiz|presupuesto|cu[aá]nto cuesta|precio|contratar|quiero (aplicar|instalar|hacer|pedir|solicitar|comprar|poner)|me gustar[ií]a|quisiera (instalar|aplicar|contratar|hacer|poner)|agendar|necesito un (servicio|t[eé]cnico|instalador|ingeniero)/i;
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
            addMessage('Parece que tienes un proyecto en mente. ¿Te gustaría que uno de nuestros asesores te contacte? Escríbenos por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> y te atendemos de inmediato. 📲', 'bot');
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
          addMessage('¿Te gustaría hablar con un asesor? Escríbenos directamente por <a href="https://wa.me/573057639585" target="_blank" style="color:#c9a84c;font-weight:600;">WhatsApp</a> para atención inmediata. 📲', 'bot');
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
    var email    = document.getElementById('lf-email');
    var tipo     = document.getElementById('lf-tipo');
    var mensaje  = document.getElementById('lf-mensaje');
    var submitBtn = form.querySelector('.lf-submit');

    if (!nombre.value.trim()) {
      setError(nombre, 'Por favor ingresa tu nombre.');
      return;
    }
    if (!telefono.value.trim()) {
      setError(telefono, 'Por favor ingresa tu número de contacto.');
      return;
    }
    if (!email.value.trim()) {
      setError(email, 'Por favor ingresa tu correo electrónico.');
      return;
    }
    // Simple email format validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value.trim())) {
      setError(email, 'Por favor ingresa un correo válido.');
      return;
    }
    if (!tipo.value) {
      setError(tipo, 'Por favor selecciona el tipo de proyecto.');
      return;
    }

    // Disable button while submitting
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre:   nombre.value.trim(),
        whatsapp: telefono.value.trim(),
        email:    email.value.trim(),
        servicio: tipo.value,
        mensaje:  mensaje ? mensaje.value.trim() : '',
      }),
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.ok) {
        form.style.display = 'none';
        success.style.display = 'flex';
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Build WhatsApp message and redirect after 3 seconds
        setTimeout(function() {
          var sectorLabel = tipo.options[tipo.selectedIndex].text || tipo.value;
          var waMsg = 'Hola, soy ' + nombre.value.trim() + '. Acabo de enviar una solicitud en VoltGrid.\n\nTipo de proyecto: ' + sectorLabel + '\nMensaje: ' + (mensaje.value.trim() || 'No especificó');
          var encoded = encodeURIComponent(waMsg);
          window.location.href = 'https://wa.me/573057639585?text=' + encoded;
        }, 3000);
      } else {
        errEl.textContent = data.error || 'Ocurrió un error. Inténtalo de nuevo.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Solicitar asesoría';
      }
    })
    .catch(function() {
      errEl.textContent = 'No se pudo enviar la solicitud. Verifica tu conexión e inténtalo de nuevo.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Solicitar asesoría';
    });
  });
})();

// Console branding
console.log('%cVoltGrid Ingeniería', 'font-size: 20px; font-weight: bold; color: #0d2341;');
console.log('%cPrecisión técnica para cumplir, seguridad para confiar', 'font-size: 14px; color: #d4af37;');
