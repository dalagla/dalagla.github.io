/* helpers.js — TOC, copy, tabs, progreso, anchors, KaTeX (sin ejecución) */
(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  document.addEventListener('DOMContentLoaded', () => {
    initProgressBar();
    initReadingTime();
    initCodeTabs();        // 1) primero tabs
    decorateCodeBlocks();  // 2) luego el resto de bloques
    if (window.hljs) window.hljs.highlightAll();
    buildTOC();
    initMath();
    enableSmoothAnchors();
  });

  function initProgressBar() {
    const bar = $('#progress'), article = $('#article');
    if (!bar || !article) return;
    const onScroll = () => {
      const total = article.scrollHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(window.scrollY - article.offsetTop, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      bar.style.transform = `scaleX(${p})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initReadingTime() {
    const t = $('[data-reading-time]'), a = $('#article');
    if (!t || !a) return;
    const words = (a.innerText || '').trim().split(/\s+/).length;
    t.textContent = `${Math.max(1, Math.round(words / 220))} min read`;
  }

  const languageFrom = (el) => {
    const code = el.tagName === 'PRE' ? el.querySelector('code') : el;
    const cls = (code?.className || '').toLowerCase();
    const m = cls.match(/language-([\w-]+)/i);
    return el.dataset.lang || (m ? m[1] : 'text');
  };

  function decorateCodeBlocks() {
    $$('.prose pre').forEach(pre => {
      if (pre.closest('.code-tabs')) return; // no doble wrap
      wrapCode(pre);
    });
  }

  function wrapCode(pre) {
    if (pre.parentElement.classList.contains('code-block')) return;
    const lang = languageFrom(pre);

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';

    const badge = document.createElement('span');
    badge.className = 'lang-badge';
    badge.textContent = (lang || 'text').toUpperCase();

    const bar = document.createElement('div');
    bar.className = 'code-toolbar';

    const copy = document.createElement('button');
    copy.className = 'copy-btn';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.innerText).then(() => {
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy'), 1200);
      });
    });
    bar.appendChild(copy);

    const parent = pre.parentElement;
    parent.replaceChild(wrapper, pre);
    wrapper.appendChild(badge);
    wrapper.appendChild(bar);
    wrapper.appendChild(pre);
  }

  function initCodeTabs() {
    $$('.code-tabs').forEach(box => {
      if (box.dataset.ready) return;
      const pres = Array.from(box.querySelectorAll(':scope > pre'));
      if (!pres.length) return;

      const bar = document.createElement('div');
      bar.className = 'tab-bar';

      const panelsWrap = document.createElement('div');
      const panels = pres.map((pre, i) => {
        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.appendChild(pre);
        panelsWrap.appendChild(panel);

        wrapCode(pre);

        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.type = 'button';
        btn.textContent = (pre.dataset.lang || languageFrom(pre)).toString();
        btn.addEventListener('click', () => setActive(i));
        bar.appendChild(btn);

        return { panel, btn };
      });

      box.textContent = '';
      box.appendChild(bar);
      box.appendChild(panelsWrap);

      function setActive(idx) {
        panels.forEach((p, i) => {
          p.btn.classList.toggle('active', i === idx);
          p.panel.classList.toggle('active', i === idx);
        });
      }
      setActive(0);
      box.dataset.ready = '1';
    });
  }

  function buildTOC() {
    const container = $('#toc-list'), article = $('#article');
    if (!container || !article) return;
    const headers = $$('.prose h2, .prose h3', article);
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none'; ul.style.paddingLeft = '0';
    headers.forEach(h => {
      if (!h.id) h.id = h.textContent.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');
      const li = document.createElement('li');
      li.style.marginLeft = h.tagName === 'H3' ? '0.6rem' : '0';
      const a = document.createElement('a');
      a.href = `#${h.id}`; a.textContent = h.textContent;
      li.appendChild(a); ul.appendChild(li);
    });
    container.appendChild(ul);

    const links = $$('a', container);
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          const a = map.get(e.target.id); if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 });
    headers.forEach(h => io.observe(h));
  }

  function initMath() {
    if (window.renderMathInElement) {
      const el = document.getElementById('article');
      window.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false
      });
    }
  }

  function enableSmoothAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const t = document.getElementById(id);
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior:'smooth', block:'start' }); history.replaceState(null, '', `#${id}`); }
    });
  }
})();
