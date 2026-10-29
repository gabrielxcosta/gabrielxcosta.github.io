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
      initialCount: 350,
      maxCount: 950,
      minSize: 10,
      maxSize: 40,
      hubProbability: 0.3,
      hubMinSize: 25,
      opacity: 0.84,
      growthInterval: 1400,
      growthBatch: 6,
      growthEnabled: true
    },

    communities: {
      count: 18,
      spreadX: 0.075,
      spreadY: 0.14,
      irregularity: 0.92,
      drift: 10
    },

    edges: {
      localDistance: 155,
      minNeighbors: 3,
      maxNeighbors: 8,
      opacity: 0.42,
      width: 1.6,
      bridgeProbability: 0.65,
      bridgeOpacity: 0.34,
      growthInterval: 1100,
      maxNewEdges: 5,
      maxTotalDegree: 14
    },

    motion: {
      enabled: true,
      speed: 0.15,
      sway: 9,
      frequency: 0.00038,
      nodeJitter: 3.5
    },

    centrality: {
      enabled: true,
      low: '#828282',
      middle: '#c56b76',
      high: '#b52735',
      gamma: 0.62,
      percentile: 0.75,
      updateInterval: 2400,
      sampleSources: 160,
      smoothing: 0.075,
      zeroColor: '#828282'
    },

    interaction: {
      enabled: true,
      radius: 190,
      edgeOpacity: 0.70,
      nodeOpacity: 1,
      highlightStrength: 0.30
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
      host.style.height = 'clamp(300px, 42vw, 440px)';
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
  let centralityBusy = false;

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

  const gaussian = () => {
    const u = Math.max(Math.random(), 1e-8);
    const v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v);
  };

  const anchors = [
    [0.00, 0.04],
    [0.17, 0.02],
    [0.35, 0.10],
    [0.56, 0.04],
    [0.77, 0.03],
    [1.00, 0.10],

    [0.04, 0.38],
    [0.24, 0.34],
    [0.46, 0.45],
    [0.68, 0.32],
    [0.88, 0.43],
    [1.00, 0.58],

    [0.00, 0.88],
    [0.17, 0.94],
    [0.37, 0.85],
    [0.58, 0.96],
    [0.79, 0.86],
    [1.00, 0.96]
  ];

  const hexToRgb = hex => {
    const value = hex.replace('#', '');

    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  };

  const colorLow = hexToRgb(config.centrality.low);
  const colorMiddle = hexToRgb(config.centrality.middle);
  const colorHigh = hexToRgb(config.centrality.high);

  function interpolateColor(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
  }

  function centralityColor(value) {
    const t = clamp(value, 0, 1);

    if (t <= 0.5) {
      return interpolateColor(
        colorLow,
        colorMiddle,
        t * 2
      );
    }

    return interpolateColor(
      colorMiddle,
      colorHigh,
      (t - 0.5) * 2
    );
  }

  function createCommunities() {
    communities = [];

    for (let i = 0; i < config.communities.count; i++) {
      const anchor = anchors[i % anchors.length];

      communities.push({
        id: i,
        x: anchor[0] * W + gaussian() * W * 0.018,
        y: anchor[1] * H + gaussian() * H * 0.025,
        phase: random(0, Math.PI * 2),
        speed: random(0.55, 1.35),
        sx: random(0.50, 1.25),
        sy: random(0.50, 1.20),
        angle: random(0, Math.PI * 2),
        members: []
      });
    }
  }

  function nodeRadius() {
    const c = config.nodes;

    if (Math.random() < c.hubProbability) {
      return random(c.hubMinSize, c.maxSize);
    }

    const u = Math.pow(Math.random(), 1.25);

    return c.minSize +
      u * (c.hubMinSize - c.minSize);
  }

  function createNode(communityId, nearNode = null) {
    const community = communities[communityId];

    const ca = Math.cos(community.angle);
    const sa = Math.sin(community.angle);

    const scale = Math.random() < 0.76
      ? random(0.15, 0.60)
      : random(0.65, 1.35);

    const dx = gaussian() *
      W * config.communities.spreadX *
      community.sx * scale;

    const dy = gaussian() *
      H * config.communities.spreadY *
      community.sy * scale;

    let x = community.x + dx * ca - dy * sa;
    let y = community.y + dx * sa + dy * ca;

    if (nearNode) {
      const angle = random(0, Math.PI * 2);
      const distance = random(16, 65);

      x = nearNode.x + Math.cos(angle) * distance;
      y = nearNode.y + Math.sin(angle) * distance;
    }

    x = clamp(x, -W * 0.025, W * 1.025);
    y = clamp(y, -H * 0.05, H * 1.05);

    const radius = nodeRadius();

    const node = {
      id: nodes.length,
      community: communityId,

      x,
      y,
      px: x,
      py: y,

      radius,

      phase: random(0, Math.PI * 2),
      phase2: random(0, Math.PI * 2),

      speed: random(0.65, 1.45),
      drift: random(0.55, 1.35),

      betweenness: 0,
      targetCentrality: 0,
      visualCentrality: 0,

      color: [...colorLow],
      targetColor: [...colorLow]
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
      random(0.70, 1.45)
    );

    const sum = weights.reduce((a, b) => a + b, 0);

    const counts = weights.map(w =>
      Math.floor(total * w / sum)
    );

    let remainder =
      total - counts.reduce((a, b) => a + b, 0);

    while (remainder > 0) {
      counts[randomInt(0, counts.length - 1)]++;
      remainder--;
    }

    for (let i = 0; i < communities.length; i++) {
      for (let j = 0; j < counts[i]; j++) {
        createNode(i);
      }
    }
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
      adjacency[u].size >= config.edges.maxTotalDegree ||
      adjacency[v].size >= config.edges.maxTotalDegree
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
        : config.edges.opacity * random(0.65, 1.30)
    });

    topologyVersion++;

    return true;
  }

  function nearestCandidates(node, candidates, limit = 12) {
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
    const community = communities[node.community];

    const candidates = nearestCandidates(
      node,
      community.members
        .filter(id => id !== node.id)
        .map(id => nodes[id]),
      config.edges.maxNeighbors + 8
    );

    const targetDegree = randomInt(
      config.edges.minNeighbors,
      config.edges.maxNeighbors
    );

    let connected = 0;

    for (const candidate of candidates) {
      if (connected >= targetDegree) break;

      if (
        candidate.distance <= config.edges.localDistance ||
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
        const a = communities[i];
        const b = communities[j];

        links.push({
          a: i,
          b: j,
          distance: Math.hypot(a.x - b.x, a.y - b.y)
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
          adjacency[a].size >= config.edges.maxTotalDegree
        ) continue;

        for (const b of B) {
          if (
            adjacency[b].size >= config.edges.maxTotalDegree
          ) continue;

          const d = distance(nodes[a], nodes[b]);

          if (d < bestD) {
            bestD = d;
            bestA = a;
            bestB = b;
          }
        }
      }

      if (bestA < 0 || bestB < 0) return false;

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
      if (
        Math.random() <
        config.edges.bridgeProbability * 0.22
      ) {
        connectClosest(link.a, link.b);
      }
    }
  }

  function createInitialEdges() {
    edges = [];
    edgeKeys = new Set();

    adjacency = nodes.map(() => new Set());

    for (const community of communities) {
      const members = community.members.map(id => nodes[id]);

      for (const node of members) {
        connectNode(node);
      }
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

      const community = communities[communityId];

      const reference = community.members.length
        ? nodes[
            community.members[
              randomInt(0, community.members.length - 1)
            ]
          ]
        : null;

      const node = createNode(communityId, reference);

      connectNode(node);

      if (reference) {
        addEdge(node.id, reference.id);
      }

      if (Math.random() < 0.35) {
        const other = communities
          .filter(c => c.id !== communityId)
          .sort((a, b) =>
            Math.hypot(
              a.x - community.x,
              a.y - community.y
            ) -
            Math.hypot(
              b.x - community.x,
              b.y - community.y
            )
          )[0];

        if (other && other.members.length) {
          const candidates = nearestCandidates(
            node,
            other.members.map(id => nodes[id]),
            4
          );

          if (candidates.length) {
            addEdge(
              node.id,
              candidates[0].id,
              true
            );
          }
        }
      }
    }
  }

  function addNewEdges() {
    if (!nodes.length) return;

    const amount = randomInt(
      1,
      config.edges.maxNewEdges
    );

    for (let i = 0; i < amount; i++) {
      const node = nodes[randomInt(0, nodes.length - 1)];

      if (
        adjacency[node.id].size >=
        config.edges.maxTotalDegree
      ) continue;

      const crossCommunity = Math.random() < 0.20;

      let candidates;

      if (crossCommunity) {
        candidates = nodes.filter(n =>
          n.community !== node.community &&
          adjacency[n.id].size <
            config.edges.maxTotalDegree &&
          !adjacency[node.id].has(n.id)
        );
      } else {
        candidates = communities[node.community]
          .members
          .map(id => nodes[id])
          .filter(n =>
            n.id !== node.id &&
            adjacency[n.id].size <
              config.edges.maxTotalDegree &&
            !adjacency[node.id].has(n.id)
          );
      }

      if (!candidates.length) continue;

      const nearby = nearestCandidates(
        node,
        candidates,
        8
      );

      if (!nearby.length) continue;

      const selection = nearby[
        randomInt(0, Math.min(3, nearby.length - 1))
      ];

      addEdge(
        node.id,
        selection.id,
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

    const sources = [];

    const shuffled = Array.from(
      { length: N },
      (_, i) => i
    );

    for (let i = N - 1; i > 0; i--) {
      const j = randomInt(0, i);

      [shuffled[i], shuffled[j]] =
        [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < sampleCount; i++) {
      sources.push(shuffled[i]);
    }

    const CB = new Float64Array(N);

    for (const s of sources) {
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

    for (let i = 0; i < N; i++) {
      const value = CB[i] * normalization;

      nodes[i].betweenness = value;

      if (value > 0) {
        values.push(value);
      }
    }

    values.sort((a, b) => a - b);

    const percentileIndex = Math.floor(
      (values.length - 1) *
      config.centrality.percentile
    );

    const threshold = values.length
      ? values[Math.max(0, percentileIndex)]
      : 1;

    for (const node of nodes) {
      let normalized = 0;

      if (node.betweenness > 0) {
        normalized = Math.pow(
          clamp(
            node.betweenness / (threshold || 1),
            0,
            1
          ),
          config.centrality.gamma
        );
      }

      node.targetCentrality = normalized;
      node.targetColor = centralityColor(normalized);
    }

    centralityVersion = topologyVersion;
  }

  function updateDynamicColors() {
    for (const node of nodes) {
      const smoothing =
        config.centrality.smoothing;

      node.visualCentrality = lerp(
        node.visualCentrality,
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
        Math.sin(wave + c.phase) *
        motion.sway;

      const swayY =
        Math.cos(wave * 0.73 + c.phase) *
        motion.sway * 0.48;

      const localX =
        Math.sin(
          t * 0.00034 * n.speed + n.phase
        ) * motion.nodeJitter;

      const localY =
        Math.cos(
          t * 0.00028 * n.drift + n.phase2
        ) * motion.nodeJitter;

      const rise =
        Math.sin(
          t * 0.00013 * n.drift + n.phase
        ) * motion.speed * 16;

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

        if (
          proximity <
          config.interaction.radius
        ) {
          const strength =
            1 -
            proximity / config.interaction.radius;

          opacity = Math.max(
            opacity,
            strength *
              config.interaction.edgeOpacity
          );
        }
      }

      const strength = Math.max(
        a.visualCentrality,
        b.visualCentrality
      );

      const [r, g, blue] = centralityColor(strength);

      const visibleOpacity = clamp(
        opacity + strength * 0.28,
        0,
        0.85
      );

      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);

      ctx.lineWidth =
        config.edges.width + strength * 1.1;

      ctx.strokeStyle =
        `rgba(${r},${g},${blue},${visibleOpacity})`;

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

      const r = Math.round(n.color[0]);
      const g = Math.round(n.color[1]);
      const b = Math.round(n.color[2]);

      ctx.beginPath();

      ctx.arc(
        n.px,
        n.py,
        n.radius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        `rgba(${r},${g},${b},${clamp(opacity, 0, 1)})`;

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
        config.centrality.updateInterval &&
      !centralityBusy
    ) {
      centralityBusy = true;

      try {
        calculateBetweenness();
      } finally {
        centralityBusy = false;
        lastCentralityUpdate = t;
      }
    }
  }

  function render(t) {
    if (!running) return;

    ctx.clearRect(0, 0, W, H);

    if (
      config.background !== 'transparent'
    ) {
      ctx.fillStyle = config.background;
      ctx.fillRect(0, 0, W, H);
    }

    updateTopology(t);
    updatePositions(t);
    updateDynamicColors();

    drawNodes();
    drawEdges();

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
        node.visualCentrality =
          node.targetCentrality;

        node.color = [
          ...node.targetColor
        ];
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

    ctx.setTransform(
      dpr, 0,
      0, dpr,
      0, 0
    );

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

    if (
      canvas !== host &&
      canvas.parentNode
    ) {
      canvas.remove();
    }

    delete host.__organicNetworkDestroy;
  };

  resize();

  lastNodeGrowth = performance.now();
  lastEdgeGrowth = performance.now();
  lastCentralityUpdate = performance.now();

  render(performance.now());
})();
