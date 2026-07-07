/**
 * ozDNA Architecture — interactive diagram
 * Hover or click nodes to inspect layers. Uses CSS variables for theme-aware SVG.
 */
(function () {
  'use strict';

  var LAYERS = {
    developer: {
      title: 'Developer',
      tag: 'Client',
      description: 'Your application, agent, or internal tool sends authenticated requests to the ozDNA API — web, mobile, server-side, or batch jobs.',
      details: ['Bearer token auth', 'REST + webhooks', 'Sandbox & production keys']
    },
    gateway: {
      title: 'ozDNA Gateway',
      tag: 'Entry point',
      description: 'Every request passes through the gateway first — authentication, rate limits, audit hooks, and request ID assignment before any inference runs.',
      details: ['API key validation', 'Per-key quotas', 'X-Request-Id tracing']
    },
    router: {
      title: 'Model Router',
      tag: 'Routing',
      description: 'Cost-aware model selection with fallback chains. Route by task complexity, latency budget, or cost ceiling — primary and secondary models per workflow.',
      details: ['Fallback chains', 'Cost ceiling rules', 'A/B model tests']
    },
    prompts: {
      title: 'Prompt Registry',
      tag: 'Prompts',
      description: 'Versioned prompts scoped by workflow and vertical mode. Deploy, rollback, and environment-scoped prompt sets without redeploying application code.',
      details: ['Version history', 'Environment scopes', 'Prompt hash audit']
    },
    rag: {
      title: 'RAG Layer',
      tag: 'Retrieval',
      description: 'Corpus ingestion, hybrid retrieval, freshness checks, and eval hooks — vertical modes (academic, legal, financial) with domain-specific corpora.',
      details: ['Chunk + embed pipeline', 'Hybrid search', 'Freshness dashboards']
    },
    providers: {
      title: 'Providers',
      tag: 'Inference',
      description: 'Unified abstraction over multiple LLM providers. ozDNA routes inference to the best-fit provider per workflow — no single-vendor lock-in at the application layer.',
      details: ['OpenAI', 'Anthropic', 'Google', 'Mistral', 'OpenRouter']
    },
    analytics: {
      title: 'Analytics',
      tag: 'Usage',
      description: 'Per-request event tracking — tokens, latency, model ID, and workflow attribution. Dashboards by account, workflow, and model for finance and engineering.',
      details: ['Usage events', 'Cost per workflow', 'Exportable metrics']
    },
    billing: {
      title: 'Billing',
      tag: 'Metering',
      description: 'Quota enforcement and plan metering at the gateway. Map real LLM spend to user-facing credits and catch quota exhaustion before overage.',
      details: ['Plan quotas', '402 on exhaustion', 'Enterprise metering roadmap']
    },
    observability: {
      title: 'Observability',
      tag: 'Ops',
      description: 'Structured logs, audit trails, and trace correlation across gateway → router → RAG → provider. Foundation for enterprise export and on-call paging.',
      details: ['JSON audit logs', 'Prompt hash capture', 'Health endpoints']
    }
  };

  var FLOW_ORDER = [
    'developer', 'gateway', 'router', 'prompts', 'rag', 'providers',
    'analytics', 'billing', 'observability'
  ];

  function init() {
    var root = document.getElementById('arch-interactive');
    if (!root) return;

    var panel = root.querySelector('[data-arch-panel]');
    var nodes = root.querySelectorAll('[data-arch-node]');
    var defaultId = root.getAttribute('data-default-node') || 'gateway';

    function setActive(id) {
      if (!LAYERS[id]) return;
      var layer = LAYERS[id];

      nodes.forEach(function (node) {
        var active = node.getAttribute('data-arch-node') === id;
        node.classList.toggle('is-active', active);
        node.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      root.querySelectorAll('[data-arch-edge]').forEach(function (edge) {
        var from = edge.getAttribute('data-from');
        var to = edge.getAttribute('data-to');
        var idx = FLOW_ORDER.indexOf(id);
        var fromIdx = FLOW_ORDER.indexOf(from);
        var toIdx = FLOW_ORDER.indexOf(to);
        var lit = fromIdx <= idx && toIdx <= idx;
        edge.classList.toggle('is-lit', lit);
      });

      if (panel) {
        panel.querySelector('[data-arch-tag]').textContent = layer.tag;
        panel.querySelector('[data-arch-title]').textContent = layer.title;
        panel.querySelector('[data-arch-desc]').textContent = layer.description;
        var list = panel.querySelector('[data-arch-details]');
        list.innerHTML = layer.details.map(function (d) {
          return '<li>' + escapeHtml(d) + '</li>';
        }).join('');
      }
    }

    nodes.forEach(function (node) {
      var id = node.getAttribute('data-arch-node');
      node.addEventListener('click', function () { setActive(id); });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActive(id);
        }
      });
    });

    setActive(defaultId);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
