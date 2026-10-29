(() => {
  'use strict';

  const host = document.querySelector('#network-canvas');
  if (!host) return;

  if (host.__organicNetworkDestroy) {
    host.__organicNetworkDestroy();
  }

  const config = {
    background: 'transparent',

    nodes: {
      initialCount: 280,
      maxCount: 380,
      minSize: 5,
      maxSize: 13,
      hubProbability: 0.09,
      hubMinSize: 9,
      opacity: 0.82,
      growthEnabled: true,
      growthInterval: 3500,
      growthBatch: 2
    },

    communities: {
      count: 14,
      spreadX: 0.085,
      spreadY: 0.14,
      coreProbability: 0.72,
      coreScale: 0.45
    },

    edges: {
      minNeighbors: 2,
      maxNeighbors: 5,
      maxDegree: 10,
      localDistance: 120,
      opacity: 0.30,
      bridgeOpacity: 0.22,
      width: 0.9,
      growthInterval: 3000,
      growthBatch: 2
    },

    motion: {
      enabled: true,
      upwardSpeed: 0.20,
      sway: 7,
      swayFrequency: 0.00035,
      nodeJitter: 2.5,
      nodeFrequency: 0.00028,
      wrapMargin: 120
    },

    centrality: {
      enabled: true,
      low: '#828282',
      middle: '#b47b82',
      high: '#b52735',
      percentile: 0.90,
      gamma: 0.72,
      sampleSources: 90,
      updateInterval: 3500,
      smoothing: 0.06
    },

    interaction: {
      enabled: true,
      radius: 150,
      edgeOpacity: 0.75,
      nodeOpacity: 1
    }
  };

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  let canvas;

  if (host.tagName === 'CANVAS') {
    canvas = host;
  } else {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');

    host.style.position = 'relative';
    host.style.overflow = 'hidden';

    if (host.getBoundingClientRect().height < 50) {
      host.style.height = 'clamp(280px, 38vw, 400px)';
    }

    canvas.style.cssText = [
      'display:block',
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'pointer-events:auto'
    ].join(';');

    host.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W = 1;
  let H = 1;
  let dpr = 1;

  let nodes = [];
  let edges = [];
  let communities = [];
  let adjacency = [];
  let edgeKeys = new Set();

  let frame = 0;
  let running = true;
  let topologyVersion = 0;
  let centralityVersion = -1;

  let lastTime = 0;
  let lastNodeGrowth = 0;
  let lastEdgeGrowth = 0;
  let lastCentralityUpdate = 0;

  const mouse = {
    x: -10000,
    y: -10000,
    active: false
  };

  const random = (a, b) =>
    a + Math.random() * (b - a);

  const randomInt = (a, b) =>
    Math.floor(random(a, b + 1));

  const clamp = (x, a, b) =>
    Math.max(a, Math.min(b, x));

  const lerp = (a, b, t) =>
    a + (b - a) * t;

  function gaussian() {
    const u = Math.max(Math.random(), 1e-8);
    const v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v);
  }

  const anchors = [
    [0.04, 0.10],
    [0.26, 0.06],
    [0.52, 0.13],
    [0.78, 0.06],
    [0.97, 0.22],

    [0.08, 0.46],
    [0.33, 0.39],
    [0.60, 0.51],
    [0.87, 0.42],

    [0.02, 0.87],
    [0.24, 0.94],
    [0.49, 0.84],
    [0.75, 0.93],
    [0.98, 0.84]
  ];

  function hexToRgb(hex) {
    const h = hex.replace('#', '');

    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  }

  const lowRGB = hexToRgb(config.centrality.low);
  const midRGB = hexToRgb(config.centrality.middle);
  const highRGB = hexToRgb(config.centrality.high);

  function blendColor(a, b, t) {
    return [
      lerp(a[0], b[0], t),
      lerp(a[1], b[1], t),
      lerp(a[2], b[2], t)
    ];
  }

  function centralityColor(value) {
    const t = clamp(value, 0, 1);

    if (t <= 0.5) {
      return blendColor(lowRGB, midRGB, t * 2);
    }

    return blendColor(
      midRGB,
      highRGB,
      (t - 0.5) * 2
    );
  }

  function createCommunities() {
    communities = [];

    for (let i = 0; i < config.communities.count; i++) {
      const anchor = anchors[i % anchors.length];

      communities.push({
        id: i,
        x: anchor[0] * W,
        y: anchor[1] * H,
        phase: random(0, Math.PI * 2),
        speed: random(0.75, 1.25),
        angle: random(0, Math.PI * 2),
        sx: random(0.65, 1.20),
        sy: random(0.65, 1.20),
        offsetY: 0,
        members: []
      });
    }
  }

  function nodeRadius() {
    const c = config.nodes;

    if (Math.random() < c.hubProbability) {
      return random(c.hubMinSize, c.maxSize);
    }

    const u = Math.pow(Math.random(), 1.15);

    return lerp(c.minSize, c.hubMinSize, u);
  }

  function createNode(communityId, reference = null) {
    const community = communities[communityId];

    let x;
    let y;

    if (reference) {
      const angle = random(0, Math.PI * 2);
      const distance = random(15, 55);

      x = reference.x + Math.cos(angle) * distance;
      y = reference.y + Math.sin(angle) * distance;
    } else {
      const core =
        Math.random() < config.communities.coreProbability;

      const scale = core
        ? random(0.15, config.communities.coreScale)
        : random(0.55, 1.30);

      const dx = gaussian() *
        W * config.communities.spreadX *
        community.sx * scale;

      const dy = gaussian() *
        H * config.communities.spreadY *
        community.sy * scale;

      const ca = Math.cos(community.angle);
      const sa = Math.sin(community.angle);

      x = community.x + dx * ca - dy * sa;
      y = community.y + dx * sa + dy * ca;
    }

    const node = {
      id: nodes.length,
      community: communityId,

      x,
      y,
      px: x,
      py: y,

      radius: nodeRadius(),

      phase: random(0, Math.PI * 2),
      phase2: random(0, Math.PI * 2),
      speed: random(0.7, 1.3),

      betweenness: 0,
      centrality: 0,
      targetCentrality: 0,

      color: [...lowRGB],
      targetColor: [...lowRGB]
    };

    nodes.push(node);
    adjacency.push(new Set());
    community.members.push(node.id);

    topologyVersion++;

    return node;
  }

  function createInitialNodes() {
    nodes = [];
    adjacency = [];

    communities.forEach(c => {
      c.members = [];
    });

    const total = config.nodes.initialCount;

    const weights = communities.map(() =>
      random(0.7, 1.4)
    );

    const sum = weights.reduce((a, b) => a + b, 0);

    const counts = weights.map(w =>
      Math.floor(total * w / sum)
    );

    let remaining =
      total - counts.reduce((a, b) => a + b, 0);

    while (remaining > 0) {
      counts[randomInt(0, counts.length - 1)]++;
      remaining--;
    }

    communities.forEach((community, i) => {
      for (let j = 0; j < counts[i]; j++) {
        createNode(community.id);
      }
    });
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function addEdge(a, b, bridge = false) {
    if (a === b) return false;

    const u = Math.min(a, b);
    const v = Math.max(a, b);
    const key = `${u}:${v}`;

    if (edgeKeys.has(key)) return false;

    if (
      adjacency[u].size >= config.edges.maxDegree ||
      adjacency[v].size >= config.edges.maxDegree
    ) {
      return false;
    }

    edgeKeys.add(key);

    adjacency[u].add(v);
    adjacency[v].add(u);

    edges.push({
      a: u,
      b: v,
      bridge,
      opacity: bridge
        ? config.edges.bridgeOpacity
        : config.edges.opacity * random(0.75, 1.15)
    });

    topologyVersion++;

    return true;
  }

  function nearestCandidates(node, candidates, limit = 10) {
    return candidates
      .filter(other => other.id !== node.id)
      .map(other => ({
        id: other.id,
        distance: distance(node, other)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  function connectNode(node) {
    const group = communities[node.community];

    const candidates = nearestCandidates(
      node,
      group.members
        .filter(id => id !== node.id)
        .map(id => nodes[id]),
      12
    );

    const target = randomInt(
      config.edges.minNeighbors,
      config.edges.maxNeighbors
    );

    let connected = 0;

    for (const candidate of candidates) {
      if (connected >= target) break;

      if (
        candidate.distance < config.edges.localDistance ||
        connected < config.edges.minNeighbors
      ) {
        if (addEdge(node.id, candidate.id)) {
          connected++;
        }
      }
    }
  }

  function connectCommunities() {
    const links = [];

    for (let i = 0; i < communities.length; i++) {
      for (let j = i + 1; j < communities.length; j++) {
        links.push({
          a: i,
          b: j,
          distance: Math.hypot(
            communities[i].x - communities[j].x,
            communities[i].y - communities[j].y
          )
        });
      }
    }

    links.sort((a, b) => a.distance - b.distance);

    const parent = communities.map((_, i) => i);

    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }

    function connectClosest(aId, bId) {
      const A = communities[aId].members;
      const B = communities[bId].members;

      let bestA = -1;
      let bestB = -1;
      let bestD = Infinity;

      for (const a of A) {
        if (
          adjacency[a].size >= config.edges.maxDegree
        ) continue;

        for (const b of B) {
          if (
            adjacency[b].size >= config.edges.maxDegree
          ) continue;

          const d = distance(nodes[a], nodes[b]);

          if (d < bestD) {
            bestD = d;
            bestA = a;
            bestB = b;
          }
        }
      }

      if (bestA < 0) return false;

      return addEdge(bestA, bestB, true);
    }

    for (const link of links) {
      const ra = find(link.a);
      const rb = find(link.b);

      if (ra !== rb) {
        if (connectClosest(link.a, link.b)) {
          parent[ra] = rb;
        }
      }
    }

    for (const link of links) {
      if (Math.random() < 0.12) {
        connectClosest(link.a, link.b);
      }
    }
  }

  function createInitialEdges() {
    edges = [];
    edgeKeys = new Set();
    adjacency = nodes.map(() => new Set());

    for (const node of nodes) {
      connectNode(node);
    }

    connectCommunities();
  }

  function addNewNodes() {
    if (!config.nodes.growthEnabled) return;

    const available =
      config.nodes.maxCount - nodes.length;

    if (available <= 0) return;

    const amount = Math.min(
      available,
      config.nodes.growthBatch
    );

    for (let i = 0; i < amount; i++) {
      const communityId = randomInt(
        0,
        communities.length - 1
      );

      const group = communities[communityId];

      const reference = group.members.length
        ? nodes[
            group.members[
              randomInt(0, group.members.length - 1)
            ]
          ]
        : null;

      const node = createNode(communityId, reference);

      connectNode(node);

      if (reference) {
        addEdge(node.id, reference.id);
      }
    }
  }

  function addNewEdges() {
    for (let i = 0; i < config.edges.growthBatch; i++) {
      const node = nodes[randomInt(0, nodes.length - 1)];

      if (
        adjacency[node.id].size >= config.edges.maxDegree
      ) continue;

      const crossCommunity = Math.random() < 0.15;

      const candidates = nodes.filter(n =>
        n.id !== node.id &&
        !adjacency[node.id].has(n.id) &&
        adjacency[n.id].size < config.edges.maxDegree &&
        (
          crossCommunity
            ? n.community !== node.community
            : n.community === node.community
        )
      );

      if (!candidates.length) continue;

      const nearby = nearestCandidates(
        node,
        candidates,
        5
      );

      if (!nearby.length) continue;

      addEdge(
        node.id,
        nearby[0].id,
        crossCommunity
      );
    }
  }

  function calculateBetweenness() {
    const N = nodes.length;
    if (N < 3) return;

    const sampleCount = Math.min(
      N,
      config.centrality.sampleSources
    );

    const sources = Array.from(
      { length: N },
      (_, i) => i
    );

    for (let i = N - 1; i > 0; i--) {
      const j = randomInt(0, i);

      [sources[i], sources[j]] =
        [sources[j], sources[i]];
    }

    const CB = new Float64Array(N);

    for (let k = 0; k < sampleCount; k++) {
      const s = sources[k];

      const stack = [];
      const pred = Array.from(
        { length: N },
        () => []
      );

      const sigma = new Float64Array(N);
      const dist = new Int32Array(N).fill(-1);

      sigma[s] = 1;
      dist[s] = 0;

      const queue = [s];

      for (let head = 0; head < queue.length; head++) {
        const v = queue[head];
        stack.push(v);

        for (const w of adjacency[v]) {
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
            (sigma[v] / sigma[w]) *
            (1 + delta[w]);
        }

        if (w !== s) {
          CB[w] += delta[w];
        }
      }
    }

    const normalization =
      (N / sampleCount) /
      ((N - 1) * (N - 2));

    const values = [];

    nodes.forEach((node, i) => {
      node.betweenness = CB[i] * normalization;

      if (node.betweenness > 0) {
        values.push(node.betweenness);
      }
    });

    values.sort((a, b) => a - b);

    const index = Math.floor(
      (values.length - 1) *
      config.centrality.percentile
    );

    const threshold = values.length
      ? values[Math.max(0, index)]
      : 1;

    for (const node of nodes) {
      const t = node.betweenness > 0
        ? Math.pow(
            clamp(
              node.betweenness / (threshold || 1),
              0,
              1
            ),
            config.centrality.gamma
          )
        : 0;

      node.targetCentrality = t;
      node.targetColor = centralityColor(t);
    }

    centralityVersion = topologyVersion;
  }

  function updateColors() {
    const smoothing = config.centrality.smoothing;

    for (const node of nodes) {
      node.centrality = lerp(
        node.centrality,
        node.targetCentrality,
        smoothing
      );

      for (let i = 0; i < 3; i++) {
        node.color[i] = lerp(
          node.color[i],
          node.targetColor[i],
          smoothing
        );
      }
    }
  }

  function updatePositions(t, dt) {
    const motion = config.motion;
    const animate = motion.enabled && !reducedMotion;

    for (const group of communities) {
      if (animate) {
        group.offsetY -=
          motion.upwardSpeed * group.speed * dt / 16.67;

        const margin = motion.wrapMargin;
        const cycle = H + margin * 2;

        if (group.offsetY < -cycle) {
          group.offsetY += cycle;
        }
      }
    }

    for (const node of nodes) {
      const group = communities[node.community];

      if (!animate) {
        node.px = node.x;
        node.py = node.y;
        continue;
      }

      const wave =
        t * motion.swayFrequency * group.speed;

      const swayX =
        Math.sin(wave + group.phase) *
        motion.sway;

      const localX =
        Math.sin(
          t * motion.nodeFrequency *
          node.speed + node.phase
        ) * motion.nodeJitter;

      const localY =
        Math.cos(
          t * motion.nodeFrequency * 0.8 +
          node.phase2
        ) * motion.nodeJitter;

      let y = node.y + group.offsetY;

      const margin = motion.wrapMargin;
      const cycle = H + margin * 2;

      y = (
        ((y + margin) % cycle + cycle) % cycle
      ) - margin;

      node.px = node.x + swayX + localX;
      node.py = y + localY;
    }
  }

  function drawEdges() {
    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];

      if (!a || !b) continue;

      const d = Math.hypot(
        a.px - b.px,
        a.py - b.py
      );

      if (d > Math.max(W, H) * 0.65) {
        continue;
      }

      const strength = Math.max(
        a.centrality,
        b.centrality
      );

      const color = centralityColor(strength);

      let opacity =
        edge.opacity + strength * 0.20;

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
          const influence =
            1 - proximity / config.interaction.radius;

          opacity = Math.max(
            opacity,
            influence *
              config.interaction.edgeOpacity
          );
        }
      }

      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);

      ctx.lineWidth =
        config.edges.width + strength * 0.6;

      ctx.strokeStyle = `rgba(
        ${Math.round(color[0])},
        ${Math.round(color[1])},
        ${Math.round(color[2])},
        ${clamp(opacity, 0, 0.85)}
      )`;

      ctx.stroke();
    }
  }

  function drawNodes() {
    for (const node of nodes) {
      let opacity = config.nodes.opacity;

      if (mouse.active && config.interaction.enabled) {
        const distance = Math.hypot(
          node.px - mouse.x,
          node.py - mouse.y
        );

        if (distance < config.interaction.radius) {
          const influence =
            1 - distance / config.interaction.radius;

          opacity = lerp(
            opacity,
            config.interaction.nodeOpacity,
            influence
          );
        }
      }

      ctx.beginPath();

      ctx.arc(
        node.px,
        node.py,
        node.radius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = `rgba(
        ${Math.round(node.color[0])},
        ${Math.round(node.color[1])},
        ${Math.round(node.color[2])},
        ${opacity}
      )`;

      ctx.fill();
    }
  }

  function updateTopology(t) {
    if (reducedMotion) return;

    if (
      t - lastNodeGrowth >=
      config.nodes.growthInterval
    ) {
      addNewNodes();
      lastNodeGrowth = t;
    }

    if (
      t - lastEdgeGrowth >=
      config.edges.growthInterval
    ) {
      addNewEdges();
      lastEdgeGrowth = t;
    }

    if (
      config.centrality.enabled &&
      topologyVersion !== centralityVersion &&
      t - lastCentralityUpdate >=
        config.centrality.updateInterval
    ) {
      calculateBetweenness();
      lastCentralityUpdate = t;
    }
  }

  function render(t) {
    if (!running) return;

    const dt = lastTime
      ? clamp(t - lastTime, 0, 50)
      : 16.67;

    lastTime = t;

    ctx.clearRect(0, 0, W, H);

    if (config.background !== 'transparent') {
      ctx.fillStyle = config.background;
      ctx.fillRect(0, 0, W, H);
    }

    updateTopology(t);
    updatePositions(t, dt);
    updateColors();

    drawEdges();
    drawNodes();

    if (!reducedMotion) {
      frame = requestAnimationFrame(render);
    }
  }

  function rebuildNetwork() {
    topologyVersion = 0;
    centralityVersion = -1;

    createCommunities();
    createInitialNodes();
    createInitialEdges();

    if (config.centrality.enabled) {
      calculateBetweenness();

      for (const node of nodes) {
        node.centrality =
          node.targetCentrality;

        node.color = [...node.targetColor];
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();

    const nextW = Math.max(1, rect.width);
    const nextH = Math.max(1, rect.height);

    const nextDpr = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    if (
      Math.abs(nextW - W) < 1 &&
      Math.abs(nextH - H) < 1 &&
      nextDpr === dpr &&
      nodes.length
    ) {
      return;
    }

    W = nextW;
    H = nextH;
    dpr = nextDpr;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    rebuildNetwork();

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

  canvas.addEventListener(
    'pointermove',
    onPointerMove
  );

  canvas.addEventListener(
    'pointerleave',
    onPointerLeave
  );

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

    if (canvas !== host && canvas.parentNode) {
      canvas.remove();
    }

    delete host.__organicNetworkDestroy;
  };

  resize();

  const now = performance.now();

  lastTime = now;
  lastNodeGrowth = now;
  lastEdgeGrowth = now;
  lastCentralityUpdate = now;

  render(now);
})();
