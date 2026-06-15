// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

toggle?.addEventListener('click', () => {
  const open = navLinks?.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

navLinks?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  });
});

// Waitlist form — show success on Netlify redirect or local demo
const params = new URLSearchParams(window.location.search);
if (params.get('submitted') === 'true') {
  const form = document.querySelector('.waitlist-form');
  const success = document.getElementById('form-success');
  form?.style.setProperty('display', 'none');
  success?.classList.add('visible');
  history.replaceState({}, '', window.location.pathname + '#bekleme-listesi');
}
