(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  document.addEventListener('DOMContentLoaded', () => {
    initProgressBar();
    initReadingTime();
    buildTOC();
    if (window.hljs) window.hljs.highlightAll();
    decorateCodeBlocks();
    initCodeTabs();
    initMath();
    enableSmoothAnchors();
  });

  function initProgressBar() {
    const bar = $('#progress');
    const article = $('#article');
    if (!bar || !article) return;
    const onScroll = () => {
      const rect = article.getBoundingClientRect();
      const total = article.scrollHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(window.scrollY - article.offsetTop, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      bar.style.transform = `scaleX(${p})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initReadingTime() {
    const target = $('[data-reading-time]');
    const article = $('#article');
    if (!target || !article) return;
    const text = article.innerText || '';
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 220));
    target.textContent = `${minutes} min read`;
  }

  function slugify(str) {
    return str
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-');
  }

  function buildTOC() {
    const container = $('#toc-list');
    const article = $('#article');
    if (!container || !article) return;

    const headers = $$('.prose h2, .prose h3', article);
    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.paddingLeft = '0';

    headers.forEach(h => {
      if (!h.id) h.id = slugify(h.textContent);
      const li = document.createElement('li');
      li.style.marginLeft = h.tagName === 'H3' ? '0.6rem' : '0';
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
    });
    container.appendChild(list);

    // Active section highlight
    const links = $$('a', container);
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          const a = map.get(e.target.id);
          if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 });

    headers.forEach(h => io.observe(h));
  }

  function decorateCodeBlocks() {
    // wrap <pre><code> in .code-block, add copy/run, language badge
    $$('.prose pre > code').forEach(code => {
      const pre = code.parentElement;
      if (pre.closest('.tab-panel') && pre.closest('.code-tabs')) {
        // Será envuelto por initCodeTabs
        return;
      }
      wrapCode(pre);
    });
  }

  function languageFrom(el) {
    const cls = el.className || '';
    const m = cls.match(/language-([\w-]+)/i);
    return el.dataset.lang || (m ? m[1] : 'text');
  }

  function wrapCode(pre) {
    if (pre.parentElement.classList.contains('code-block')) return;
    const lang = languageFrom(pre.querySelector('code') || pre);
    const run = pre.dataset.run === 'js' || pre.dataset.exec === 'js';

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    const badge = document.createElement('span');
    badge.className = 'lang-badge';
    badge.textContent = lang.toUpperCase();

    const bar = document.createElement('div');
    bar.className = 'code-toolbar';

    const copy = document.createElement('button');
    copy.className = 'copy-btn';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
      const txt = pre.innerText;
      navigator.clipboard.writeText(txt).then(() => {
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy'), 1200);
      });
    });
    bar.appendChild(copy);

    let output, runBtn;
    if (run) {
      runBtn = document.createElement('button');
      runBtn.className = 'run-btn';
      runBtn.type = 'button';
      runBtn.textContent = 'Run';
      runBtn.addEventListener('click', () => runJS(pre.innerText, output));
      bar.appendChild(runBtn);
      output = document.createElement('div');
      output.className = 'code-output';
      output.textContent = 'Output...';
    }

    const parent = pre.parentElement;
    parent.replaceChild(wrapper, pre);
    wrapper.appendChild(badge);
    wrapper.appendChild(bar);
    wrapper.appendChild(pre);
    if (output) wrapper.appendChild(output);
  }

  function runJS(src, outputEl) {
    if (!outputEl) return;
    outputEl.textContent = '';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const logs = [];
    const html = `
      <script>
        const _logs = [];
        console.log = (...a)=>{ parent.postMessage({type:'runner-log', data: a.join(' ')}, '*'); };
        console.error = (...a)=>{ parent.postMessage({type:'runner-err', data: a.join(' ')}, '*'); };
        try { ${src} } catch(e){ console.error(e.message); }
        parent.postMessage({type:'runner-done'}, '*');
      <\/script>
    `;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();

    const onMsg = (e) => {
      if (e.data?.type === 'runner-log') {
        appendLine(outputEl, e.data.data);
      } else if (e.data?.type === 'runner-err') {
        appendLine(outputEl, e.data.data);
      } else if (e.data?.type === 'runner-done') {
        window.removeEventListener('message', onMsg);
        iframe.remove();
      }
    };
    window.addEventListener('message', onMsg);
    function appendLine(el, t) {
      const div = document.createElement('div');
      div.textContent = t;
      el.appendChild(div);
    }
  }

  function initCodeTabs() {
    $$('.code-tabs').forEach(box => {
      if (box.dataset.ready) return;
      const pres = $$('pre', box);
      // wrap pres into panels
      const bar = document.createElement('div');
      bar.className = 'tab-bar';

      const panels = pres.map((pre, i) => {
        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        pre.parentElement.replaceChild(panel, pre);
        panel.appendChild(pre);
        wrapCode(pre); // añade badge/copy/run
        const lang = pre.dataset.lang || languageFrom(pre.querySelector('code') || pre);
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.type = 'button';
        btn.textContent = lang;
        btn.addEventListener('click', () => setActive(i));
        bar.appendChild(btn);
        return { panel, btn };
      });

      const content = document.createElement('div');
      panels.forEach(p => content.appendChild(p.panel));

      box.prepend(bar);
      box.appendChild(content);

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
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${id}`);
      }
    });
  }
})();
