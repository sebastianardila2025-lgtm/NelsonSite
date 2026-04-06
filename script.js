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
  var overlay = document.getElementById('chat-overlay');
  if (overlay) {
    overlay.addEventListener('click', function() { closePanel(); });
  }

  function isMobile() { return window.innerWidth <= 768; }

  function showOverlay() {
    if (!overlay || !isMobile()) return;
    overlay.style.display = 'block';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { overlay.classList.add('is-visible'); });
    });
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    setTimeout(function() { overlay.style.display = 'none'; }, 340);
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
    panel.classList.add('is-opening');
    clearTimeout(openTimer);
    openTimer = setTimeout(function() {
      panel.classList.remove('is-opening');
      panel.classList.add('is-open');
    }, 420);

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

  bubble.addEventListener('click', function() {
    if (isOpen) { closePanel(); } else { openPanel(false); }
  });
  closeBtn.addEventListener('click', closePanel);

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
      addMessage('Gracias, <strong>' + leadData.name + '</strong>. Ya puedes escribirnos tu consulta y te ayudaremos lo antes posible. 😊', 'bot');
      input.focus();
    }, 820);
  }

  // ── Rule-based replies ──
  var rules = [
    { test: /servicio|ofrecen|hacen|haceis/i, reply: 'Ofrecemos: ✅ Inspecciones RETIE · ✅ Instalaciones eléctricas · ✅ Sistemas de energía solar fotovoltaica. ¿Te gustaría más detalles sobre alguno?' },
    { test: /retie|inspección|inspeccion|certificacion|certificación/i, reply: 'Realizamos inspecciones y certificación RETIE para instalaciones residenciales, comerciales e industriales en Bogotá. ¿Quieres que un técnico te contacte?' },
    { test: /solar|fotovoltaico|paneles|fotovoltaica/i, reply: '¡Sí! Diseñamos e instalamos sistemas fotovoltaicos para reducir tus costos de energía. ¿Es para uso residencial o comercial?' },
    { test: /precio|costo|cuesta|tarifa|cobran/i, reply: 'Los precios dependen del tipo de proyecto. Para darte una cotización precisa, escríbenos por WhatsApp o déjanos tu número. 📲' },
    { test: /contacto|whatsapp|teléfono|telefono|llamar|email|correo/i, reply: 'Puedes contactarnos por WhatsApp: <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">+57 1 234 5678</a> o al correo voltgridingenieria@gmail.com 📧' },
    { test: /bogota|bogotá|ubicacion|ubicación|donde|dónde/i, reply: 'Estamos ubicados en Bogotá, Colombia, y atendemos proyectos en toda la ciudad y alrededores. 📍' },
    { test: /hola|hello|buenas|buenos|hi\b/i, reply: '¡Hola! 👋 ¿En qué te puedo ayudar hoy? Cuéntame sobre tu proyecto eléctrico o solar.' },
    { test: /gracias|thanks|perfecto|genial|excelente/i, reply: '¡Con gusto! Si tienes más preguntas, estoy aquí. 😊' },
  ];

  var fallbacks = [
    'Entiendo. Para una respuesta más detallada, escríbenos por WhatsApp: <a href="https://wa.me/571234567890" target="_blank" style="color:#c9a84c;font-weight:600;">+57 1 234 5678</a>',
    'Esa pregunta la puede responder mejor nuestro equipo técnico. ¿Te gustaría que te contactemos?',
    'Gracias por tu mensaje. Nuestro equipo estará encantado de ayudarte. 📲',
  ];
  var fallbackIdx = 0;

  function getBotReply(text) {
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].test.test(text)) return rules[i].reply;
    }
    return fallbacks[fallbackIdx++ % fallbacks.length];
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
    var typingEl = showTyping();
    setTimeout(function() {
      typingEl.remove();
      addMessage(getBotReply(text), 'bot');
    }, 900 + Math.random() * 400);
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
