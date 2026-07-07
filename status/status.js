/**
 * ozDNA Status Page — client renderer
 * Static HTML is the default. When live monitoring ships, set STATUS_FEED_URL
 * to the production endpoint; this module will hydrate components from JSON.
 */
(function () {
  'use strict';

  /** @type {string} Future live endpoint — static feed until backend exists */
  var STATUS_FEED_URL = '/status/feed.json';

  var STATUS_LABELS = {
    operational: 'Operational',
    degraded: 'Degraded Performance',
    partial_outage: 'Partial Outage',
    major_outage: 'Major Outage',
    maintenance: 'Maintenance'
  };

  var OVERALL_LABELS = {
    operational: 'All systems operational',
    degraded: 'Some systems degraded',
    partial_outage: 'Partial system outage',
    major_outage: 'Major system outage',
    maintenance: 'Scheduled maintenance'
  };

  /**
   * @param {HTMLElement} root
   * @param {{ updated_at: string, overall: string, components: Array, incidents?: Array }} data
   */
  function renderStatus(root, data) {
    var overallEl = root.querySelector('[data-status-overall]');
    var updatedEl = root.querySelector('[data-status-updated]');
    var listEl = root.querySelector('[data-status-components]');
    var incidentsEl = root.querySelector('[data-status-incidents]');

    if (overallEl && data.overall) {
      overallEl.className = 'status-overall status-overall--' + data.overall;
      var label = overallEl.querySelector('[data-status-overall-label]');
      if (label) label.textContent = OVERALL_LABELS[data.overall] || data.overall;
    }

    if (updatedEl && data.updated_at) {
      updatedEl.textContent = 'Updated ' + formatUpdated(data.updated_at);
      updatedEl.hidden = false;
    }

    if (listEl && Array.isArray(data.components)) {
      listEl.innerHTML = data.components.map(renderComponent).join('');
    }

    if (incidentsEl && Array.isArray(data.incidents)) {
      if (data.incidents.length === 0) {
        incidentsEl.innerHTML = '<p class="status-empty">No incidents reported in the last 90 days.</p>';
      } else {
        incidentsEl.innerHTML = data.incidents.map(renderIncident).join('');
      }
    }
  }

  function renderComponent(c) {
    var status = c.status || 'operational';
    var label = STATUS_LABELS[status] || status;
    return (
      '<article class="status-component" data-component-id="' + escapeAttr(c.id) + '">' +
        '<div class="status-component-main">' +
          '<span class="status-indicator status-indicator--' + escapeAttr(status) + '" aria-hidden="true"></span>' +
          '<div class="status-component-copy">' +
            '<h2 class="status-component-name">' + escapeHtml(c.name) + '</h2>' +
            (c.description ? '<p class="status-component-desc">' + escapeHtml(c.description) + '</p>' : '') +
          '</div>' +
        '</div>' +
        '<span class="status-badge status-badge--' + escapeAttr(status) + '">' + escapeHtml(label) + '</span>' +
      '</article>'
    );
  }

  function renderIncident(inc) {
    return (
      '<article class="status-incident">' +
        '<time class="status-incident-date" datetime="' + escapeAttr(inc.started_at || '') + '">' +
          escapeHtml(formatUpdated(inc.started_at || '')) +
        '</time>' +
        '<h3 class="status-incident-title">' + escapeHtml(inc.title || 'Incident') + '</h3>' +
        (inc.summary ? '<p class="status-incident-summary">' + escapeHtml(inc.summary) + '</p>' : '') +
      '</article>'
    );
  }

  function formatUpdated(iso) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC'
      }).format(new Date(iso)) + ' UTC';
    } catch (_) {
      return iso;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function loadFeed(url) {
    return fetch(url, { credentials: 'omit', cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Status feed unavailable');
      return res.json();
    });
  }

  function init() {
    var root = document.getElementById('status-root');
    if (!root) return;

    var feedUrl = root.getAttribute('data-feed-url') || STATUS_FEED_URL;

    loadFeed(feedUrl)
      .then(function (data) { renderStatus(root, data); })
      .catch(function () {
        /* Static HTML in index.html remains visible */
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
