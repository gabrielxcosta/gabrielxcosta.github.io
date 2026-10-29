
(() => {
  'use strict';

  const host = document.querySelector('#network-canvas');
  if (!host) return;

  const config = {
    color: '#828282',
    background: 'transparent',

    nodes: {
      count: 350,
      minSize: 4.5,
      maxSize: 11.5,
      hubProbability: 0.12,
      hubMinSize: 7.5,
      opacity: 0.85
    },

    communities: {
      count: 13,
      minNodes: 15,
      maxNodes: 42,
      spreadX: 0.085,
      spreadY: 0.16,
      irregularity: 0.90
    },

    edges: {
      localDistance: 135,
      maxNeighbors: 7,
      opacity: 0.23,
      width: 0.75,
      bridgeProbability: 0.55,
      bridgeOpacity: 0.16
    },

    motion: {
      enabled: true,
      speed: 0.16,
      sway: 8,
      frequency: 0.00042,
      nodeJitter: 2.8
    },

    interaction: {
      enabled: true,
      radius: 145,
      edgeOpacity: 0.75,
      nodeOpacity: 1
    },

    centrality: {
      low: '#828282',
      high: '#b52735',
      gamma: 0.65
    }
  };

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (host.__organicNetworkDestroy) {
    host.__organicNetworkDestroy();
  }

  let canvas;
  const wrapper = host;

  if (host.tagName === 'CANVAS') {
    canvas = host;
  } else {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');

    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';

    if (wrapper.getBoundingClientRect().height < 50) {
      wrapper.style.height = 'clamp(260px, 38vw, 380px)';
    }

    canvas.style.cssText = [
      'display:block',
      'width:100%',
      'height:100%',
      'position:absolute',
      'inset:0',
      'pointer-events:auto'
    ].join(';');

    wrapper.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W = 1;
  let H = 1;
  let dpr = 1;
  let nodes = [];
  let edges = [];
  let communities = [];
  let edgeKeys = new Set();
  let frame = 0;
  let running = true;

  const mouse = {
    x: -10000,
    y: -10000,
    active: false
  };

  const random = (a, b) =>
    a + Math.random() * (b - a);

  const clamp = (x, a, b) =>
    Math.max(a, Math.min(b, x));

  const gaussian = () => {
    const u = Math.max(Math.random(), 1e-8);
    const v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v);
  };

  const anchors = [
    [0.02, 0.08], [0.25, 0.06],
    [0.49, 0.12], [0.80, 0.04],
    [0.98, 0.18],
    [0.09, 0.42], [0.40, 0.39],
    [0.72, 0.43], [0.95, 0.56],
    [0.02, 0.88], [0.27, 0.94],
    [0.62, 0.88], [0.96, 0.95]
  ];

  function createCommunities() {
    communities = [];

    for (let i = 0; i < config.communities.count; i++) {
      const anchor = anchors[i % anchors.length];

      communities.push({
        id: i,
        x: anchor[0] * W + gaussian() * W * 0.025,
        y: anchor[1] * H + gaussian() * H * 0.035,
        phase: random(0, Math.PI * 2),
        speed: random(0.65, 1.3),
        sx: random(0.55, 1.2),
        sy: random(0.55, 1.2)
      });
    }
  }

  function nodeRadius() {
    const c = config.nodes;

    if (Math.random() < c.hubProbability) {
      return random(c.hubMinSize, c.maxSize);
    }

    const u = Math.pow(Math.random(), 1.35);

    return c.minSize +
      u * (c.hubMinSize - c.minSize);
  }

  function createNodes() {
    nodes = [];

    const total = Math.max(
      config.nodes.count,
      config.communities.count *
        config.communities.minNodes
    );

    const weights = communities.map(() =>
      random(
        config.communities.minNodes,
        config.communities.maxNodes
      )
    );

    const weightSum = weights.reduce((a, b) => a + b, 0);

    const counts = weights.map(w =>
      Math.max(3, Math.floor(total * w / weightSum))
    );

    let remainder = total -
      counts.reduce((a, b) => a + b, 0);

    while (remainder > 0) {
      counts[Math.floor(random(0, counts.length))]++;
      remainder--;
    }

    for (const community of communities) {
      const count = counts[community.id];
      const angle = random(0, Math.PI * 2);
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      for (let j = 0; j < count; j++) {
        const irregular = config.communities.irregularity;

        let dx = gaussian() *
          W * config.communities.spreadX *
          community.sx;

        let dy = gaussian() *
          H * config.communities.spreadY *
          community.sy;

        const scale = Math.random() < 0.72
          ? random(0.20, 0.65)
          : random(0.70, 1.50);

        dx *= scale;
        dy *= scale;

        const rx = dx * ca - dy * sa;
        const ry = dx * sa + dy * ca;

        const x = community.x +
          rx * (0.7 + irregular * 0.3);

        const y = community.y +
          ry * (0.7 + irregular * 0.3);

        nodes.push({
          id: nodes.length,
          community: community.id,
          x,
          y,
          radius: nodeRadius(),
          betweenness: 0,
          fillColor: config.centrality.low,
          phase: random(0, Math.PI * 2),
          phase2: random(0, Math.PI * 2),
          speed: random(0.6, 1.4),
          drift: random(0.5, 1.4),
          px: x,
          py: y
        });
      }
    }
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function addEdge(a, b, bridge = false) {
    if (a === b) return;

    const u = Math.min(a, b);
    const v = Math.max(a, b);
    const key = u + ':' + v;

    if (edgeKeys.has(key)) return;

    edgeKeys.add(key);

    edges.push({
      a: u,
      b: v,
      bridge,
      opacity: bridge
        ? config.edges.bridgeOpacity
        : config.edges.opacity * random(0.65, 1.3)
    });
  }

  function calculateBetweenness() {
    const N = nodes.length;
    const adj = Array.from({ length: N }, () => []);

    for (const e of edges) {
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    }

    const CB = new Float64Array(N);

    for (let s = 0; s < N; s++) {
      const stack = [];
      const pred = Array.from({ length: N }, () => []);
      const sigma = new Float64Array(N);
      const dist = new Int32Array(N).fill(-1);

      sigma[s] = 1;
      dist[s] = 0;

      const queue = [s];

      for (let head = 0; head < queue.length; head++) {
        const v = queue[head];
        stack.push(v);

        for (const w of adj[v]) {
          if (dist[w] < 0) {
            dist[w] = dist[v] + 1;
            queue.push(w);
          }

          if (dist[w] === dist[v] + 1) {
            sigma[w] += sigma[v];
            pred[w].push(v);
          }
        }
      }

      const delta = new Float64Array(N);

      while (stack.length) {
        const w = stack.pop();

        for (const v of pred[w]) {
          delta[v] +=
            (sigma[v] / sigma[w]) * (1 + delta[w]);
        }

        if (w !== s) {
          CB[w] += delta[w];
        }
      }
    }

    const norm = N > 2
      ? (N - 1) * (N - 2)
      : 1;

    nodes.forEach((n, i) => {
      n.betweenness = CB[i] / norm;
    });
  }

  function hexToRgb(hex) {
    const value = hex.replace('#', '');

    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  }

  function getNodeColor(betweenness, maxBetweenness) {
    const t = Math.pow(
      clamp(betweenness / (maxBetweenness || 1), 0, 1),
      config.centrality.gamma
    );

    const start = hexToRgb(config.centrality.low);
    const end = hexToRgb(config.centrality.high);

    const rgb = start.map((v, i) =>
      Math.round(v + (end[i] - v) * t)
    );

    return `rgb(${rgb.join(',')})`;
  }

  function updateCentralityColors() {
    calculateBetweenness();

    const maxBetweenness = Math.max(
      0,
      ...nodes.map(n => n.betweenness)
    );

    nodes.forEach(n => {
      n.fillColor = getNodeColor(
        n.betweenness,
        maxBetweenness
      );
    });
  }

  function createEdges() {
    edges = [];
    edgeKeys = new Set();

    const byCommunity = communities.map(c =>
      nodes.filter(n => n.community === c.id)
    );

    for (const group of byCommunity) {
      for (const node of group) {
        const candidates = group
          .filter(other => other.id !== node.id)
          .map(other => ({
            node: other,
            d: distance(node, other)
          }))
          .sort((a, b) => a.d - b.d);

        const degree = Math.floor(
          random(2, config.edges.maxNeighbors + 1)
        );

        let connected = 0;

        for (const candidate of candidates) {
          if (connected >= degree) break;

          if (
            candidate.d < config.edges.localDistance ||
            connected === 0
          ) {
            addEdge(node.id, candidate.node.id);
            connected++;
          }
        }
      }
    }

    for (let i = 0; i < communities.length; i++) {
      const nearby = communities
        .filter(c => c.id !== i)
        .map(c => ({
          id: c.id,
          d: Math.hypot(
            communities[i].x - c.x,
            communities[i].y - c.y
          )
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);

      for (const target of nearby) {
        if (
          Math.random() >
          config.edges.bridgeProbability
        ) {
          continue;
        }

        const A = byCommunity[i];
        const B = byCommunity[target.id];

        if (!A.length || !B.length) continue;

        let bestA = A[0];
        let bestB = B[0];
        let bestD = Infinity;

        for (const a of A) {
          for (const b of B) {
            const d = distance(a, b);

            if (d < bestD) {
              bestD = d;
              bestA = a;
              bestB = b;
            }
          }
        }

        addEdge(bestA.id, bestB.id, true);
      }
    }

    updateCentralityColors();
  }

  function updatePositions(t) {
    const motion = config.motion;

    for (const n of nodes) {
      if (!motion.enabled || reducedMotion) {
        n.px = n.x;
        n.py = n.y;
        continue;
      }

      const c = communities[n.community];
      const wave = t * motion.frequency * c.speed;

      const swayX =
        Math.sin(wave + c.phase) * motion.sway;

      const swayY =
        Math.cos(wave * 0.73 + c.phase) *
        motion.sway * 0.48;

      const localX =
        Math.sin(t * 0.00034 * n.speed + n.phase) *
        motion.nodeJitter;

      const localY =
        Math.cos(t * 0.00028 * n.drift + n.phase2) *
        motion.nodeJitter;

      const rise =
        Math.sin(t * 0.00013 * n.drift + n.phase) *
        motion.speed * 16;

      n.px = n.x + swayX + localX;
      n.py = n.y + swayY + localY - rise;
    }
  }

  function drawEdges() {
    ctx.lineWidth = config.edges.width;

    for (const e of edges) {
      const a = nodes[e.a];
      const b = nodes[e.b];

      if (!a || !b) continue;

      let opacity = e.opacity;

      if (mouse.active && config.interaction.enabled) {
        const da = Math.hypot(
          a.px - mouse.x,
          a.py - mouse.y
        );

        const db = Math.hypot(
          b.px - mouse.x,
          b.py - mouse.y
        );

        const proximity = Math.min(da, db);

        if (proximity < config.interaction.radius) {
          const strength =
            1 - proximity / config.interaction.radius;

          opacity = Math.max(
            opacity,
            strength * config.interaction.edgeOpacity
          );
        }
      }

      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);

      ctx.strokeStyle = `rgba(130,130,130,${clamp(
        opacity, 0, 1
      )})`;

      ctx.stroke();
    }
  }

  function drawNodes() {
    for (const n of nodes) {
      let opacity = config.nodes.opacity;

      if (mouse.active && config.interaction.enabled) {
        const d = Math.hypot(
          n.px - mouse.x,
          n.py - mouse.y
        );

        if (d < config.interaction.radius) {
          const strength =
            1 - d / config.interaction.radius;

          opacity += strength *
            (config.interaction.nodeOpacity - opacity);
        }
      }

      ctx.beginPath();
      ctx.arc(n.px, n.py, n.radius, 0, Math.PI * 2);

      ctx.globalAlpha = clamp(opacity, 0, 1);
      ctx.fillStyle = n.fillColor;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function render(t) {
    if (!running) return;

    ctx.clearRect(0, 0, W, H);

    if (config.background !== 'transparent') {
      ctx.fillStyle = config.background;
      ctx.fillRect(0, 0, W, H);
    }

    updatePositions(t);
    drawEdges();
    drawNodes();

    if (!reducedMotion) {
      frame = requestAnimationFrame(render);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();

    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createCommunities();
    createNodes();
    createEdges();

    if (reducedMotion) {
      render(0);
    }
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();

    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;

    if (reducedMotion) {
      render(0);
    }
  }

  function onPointerLeave() {
    mouse.active = false;

    if (reducedMotion) {
      render(0);
    }
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  host.__organicNetworkDestroy = () => {
    running = false;
    cancelAnimationFrame(frame);
    observer.disconnect();

    canvas.removeEventListener(
      'pointermove',
      onPointerMove
    );

    canvas.removeEventListener(
      'pointerleave',
      onPointerLeave
    );
  };

  resize();
  render(0);
})();
