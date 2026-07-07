/**
 * ozDNA SDK page — language tab switcher
 */
(function () {
  'use strict';

  function init() {
    var root = document.getElementById('sdk-page');
    if (!root) return;

    var tabs = root.querySelectorAll('[data-sdk-tab]');
    var panels = root.querySelectorAll('[data-sdk-panel]');

    function activate(id) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-sdk-tab') === id;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(function (panel) {
        var on = panel.getAttribute('data-sdk-panel') === id;
        panel.classList.toggle('is-active', on);
        panel.hidden = !on;
      });
      if (history.replaceState) {
        history.replaceState(null, '', '#' + id);
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activate(tab.getAttribute('data-sdk-tab'));
      });
    });

    var hash = location.hash.replace('#', '');
    var valid = ['python', 'nodejs', 'go', 'java', 'rest'];
    activate(valid.indexOf(hash) >= 0 ? hash : 'python');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
