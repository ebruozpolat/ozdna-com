// Slim site nav — single source of truth for topbar links
(function initSiteNav() {
  const nav = document.querySelector('.nav-links');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav) return;

  const path = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  const isTr = document.documentElement.lang === 'tr' || path.startsWith('/tr/');
  const prefix = isTr ? '/tr' : '';
  const docsHref = isTr ? '/docs/tr/' : '/docs/';
  const onComply = path.includes('/products/comply/');

  const items = [
    {
      href: `${prefix}/products/comply/`,
      label: 'ComplyDNA',
      active: path.includes('/products/comply/'),
    },
    {
      href: `${prefix}/products/detect/`,
      label: 'Ozdna',
      active: path.includes('/products/detect/'),
    },
    {
      href: `${prefix}/architecture/`,
      label: isTr ? 'Platform' : 'Platform',
      active: path.includes('/architecture/'),
    },
    {
      href: docsHref,
      label: isTr ? 'Dokümantasyon' : 'Docs',
      active: path.startsWith('/docs/'),
    },
    {
      href: `${prefix}/pricing/`,
      label: isTr ? 'Fiyatlandırma' : 'Pricing',
      active: path.includes('/pricing/'),
    },
  ];

  nav.replaceChildren();

  for (const item of items) {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    if (item.active) link.classList.add('active');
    nav.appendChild(link);
  }

  const { en, tr, current } = langSwitchUrls(path);
  const langBox = document.createElement('div');
  langBox.className = 'lang-switch';
  langBox.setAttribute('aria-label', isTr ? 'Site dili' : 'Site language');
  langBox.innerHTML = `<a href="${en}" hreflang="en" lang="en"${current === 'en' ? ' class="active"' : ''}>EN</a><span class="lang-switch-sep" aria-hidden="true">|</span><a href="${tr}" hreflang="tr" lang="tr"${current === 'tr' ? ' class="active"' : ''}>TR</a>`;
  nav.appendChild(langBox);

  const cta = document.createElement('a');
  cta.className = 'nav-cta';
  cta.href = onComply ? `${prefix}/#waitlist?intent=comply` : `${prefix}/#waitlist`;
  cta.textContent = isTr ? 'Erken Erişim' : 'Get Early Access';
  nav.appendChild(cta);

  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    }
  });
})();

function langSwitchUrls(pathname) {
  let path = pathname || '/';
  if (path !== '/' && !path.endsWith('/')) path += '/';

  if (path === '/docs/' || path.startsWith('/docs/tr')) {
    const onTr = path.startsWith('/docs/tr');
    return { en: '/docs/', tr: '/docs/tr/', current: onTr ? 'tr' : 'en' };
  }

  if (path === '/tr/' || path.startsWith('/tr/')) {
    const en = path === '/tr/' ? '/' : path.replace(/^\/tr/, '') || '/';
    return { en, tr: path, current: 'tr' };
  }

  const tr = path === '/' ? '/tr/' : `/tr${path}`;
  return { en: path, tr, current: 'en' };
}

// Waitlist form — show success on Netlify redirect or local demo
const params = new URLSearchParams(window.location.search);

['utm_source', 'utm_campaign', 'utm_medium'].forEach((key) => {
  const value = params.get(key);
  const field = document.getElementById(key);
  if (value && field instanceof HTMLInputElement) {
    field.value = value;
  }
});

if (params.get('intent') === 'comply') {
  const role = document.getElementById('role');
  if (role instanceof HTMLSelectElement) role.value = 'regtech';
  document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

if (params.get('submitted') === 'true') {
  const form = document.querySelector('.waitlist-form');
  const success = document.getElementById('form-success');
  form?.style.setProperty('display', 'none');
  success?.classList.add('visible');
  window.ozdnaTrack?.('Waitlist Signup', { method: 'netlify' });
  history.replaceState({}, '', window.location.pathname + '#waitlist');
}
