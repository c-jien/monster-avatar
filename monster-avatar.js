/*
 * Monster avatars: deterministic, procedurally generated SVG portraits from a name.
 *
 *   name ──normalize──▶ key ──hash(key + trait)──▶ one seeded PRNG per trait ──▶ traits ──▶ SVG string
 *
 * - Pure, dependency-free, no DOM, no Math.random: the same name renders the same
 *   monster in every browser, on the server and in tests.
 * - Every trait reads from its own PRNG stream (seeded by `name + trait`), so adding an
 *   option to one trait later only reshuffles that trait, not the whole avatar.
 * - Discrete traits (body kind, eyes, mouth, top, hat, face/neck accessory, pattern,
 *   backdrop) combine with continuous parameters (hue, proportions, outline wobble,
 *   eye spacing, gaze, tilt), so the space is effectively unbounded.
 * - Output is a 100×100 square SVG. The app crops it to a circle; everything
 *   important stays inside the inscribed circle.
 */
(function (root) {
  "use strict";

  const VERSION = 1;
  const TAU = Math.PI * 2;

  // ---------- hashing & randomness ----------

  function normalizeName(name) {
    return String(name == null ? "" : name).normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  }

  // FNV-1a over UTF-16 code units, then a murmur3 finalizer for avalanche.
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  // mulberry32
  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stream(key, trait) {
    const next = prng(hash32(`v${VERSION}\u0000${key}\u0000${trait}`));
    const r = {
      next,
      float: (a, b) => a + (b - a) * next(),
      int: (a, b) => a + Math.floor((b - a + 1) * next()),
      chance: (p) => next() < p,
      sign: () => (next() < 0.5 ? -1 : 1),
      pick: (list) => list[Math.floor(next() * list.length)],
      // entries: [[value, weight], ...]
      weighted(entries) {
        const total = entries.reduce((sum, e) => sum + e[1], 0);
        let x = next() * total;
        for (const [value, weight] of entries) if ((x -= weight) < 0) return value;
        return entries[entries.length - 1][0];
      },
    };
    return r;
  }

  // ---------- svg helpers ----------

  const n = (v) => +v.toFixed(2);
  const hsl = (h, s, l, a) => {
    const hh = n(((h % 360) + 360) % 360), ss = n(clamp(s, 0, 100)), ll = n(clamp(l, 0, 100));
    return a == null ? `hsl(${hh},${ss}%,${ll}%)` : `hsla(${hh},${ss}%,${ll}%,${a})`;
  };
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function attrs(o) {
    let out = "";
    for (const k in o) if (o[k] != null && o[k] !== false) out += ` ${k}="${typeof o[k] === "number" ? n(o[k]) : o[k]}"`;
    return out;
  }
  const tag = (name, a, inner) => (inner == null ? `<${name}${attrs(a)}/>` : `<${name}${attrs(a)}>${inner}</${name}>`);
  const path = (d, a) => tag("path", Object.assign({ d }, a));
  const circle = (cx, cy, r, a) => tag("circle", Object.assign({ cx, cy, r }, a));
  const ellipse = (cx, cy, rx, ry, a) => tag("ellipse", Object.assign({ cx, cy, rx, ry }, a));
  const P = (x, y) => `${n(x)},${n(y)}`;

  // Smooth closed path through points (Catmull-Rom → cubic Bézier).
  function smoothClosed(pts) {
    const len = pts.length;
    let d = `M${P(pts[0][0], pts[0][1])}`;
    for (let i = 0; i < len; i++) {
      const p0 = pts[(i - 1 + len) % len], p1 = pts[i], p2 = pts[(i + 1) % len], p3 = pts[(i + 2) % len];
      d += `C${P(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ${P(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)} ${P(p2[0], p2[1])}`;
    }
    return d + "Z";
  }

  // ---------- shapes ----------

  // Superellipse blob with harmonic wobble, optional pinched/pointed top and fuzzy edge.
  function makeBlob(o) {
    const { cx, cy, rx, ry, exp, pinch, wobble, fuzz } = o;
    const pointAt = (t, fuzzPhase) => {
      const c = Math.cos(t), s = Math.sin(t);
      let r = Math.pow(Math.pow(Math.abs(c), exp) + Math.pow(Math.abs(s), exp), -1 / exp);
      for (const [k, a, ph] of wobble) r *= 1 + a * Math.sin(k * t + ph);
      if (fuzzPhase != null) r *= fuzzPhase ? 1 : 1 - fuzz;
      let x = c * r * rx, y = s * r * ry;
      if (s < 0 && pinch) {
        const u = -s;
        x *= 1 - pinch * u * u * 0.32;
        y -= pinch * ry * 0.2 * Math.pow(u, 8);
      }
      return [cx + x, cy + y];
    };
    const count = fuzz ? 44 : 20;
    const pts = [];
    for (let i = 0; i < count; i++) pts.push(pointAt(-Math.PI / 2 + (i / count) * TAU, fuzz ? i % 2 === 0 : null));
    const d = smoothClosed(pts);

    // Dense outline samples for geometry queries.
    const samples = [];
    for (let i = 0; i < 240; i++) samples.push(pointAt((i / 240) * TAU, null));
    let top = samples[0];
    for (const p of samples) if (p[1] < top[1]) top = p;

    function span(y) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < samples.length; i++) {
        const a = samples[i], b = samples[(i + 1) % samples.length];
        if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) {
          const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
          lo = Math.min(lo, x); hi = Math.max(hi, x);
        }
      }
      return lo === Infinity ? [cx, cx] : [lo, hi];
    }
    return { d, top: top[1], topX: top[0], cx, cy, rx, ry, span, edge: (y, side) => span(y)[side < 0 ? 0 : 1] };
  }

  function blobParams(r, base) {
    const wobble = [];
    const k = r.int(1, 3);
    for (let i = 0; i < k; i++) wobble.push([r.pick([2, 3, 4, 5]), r.float(0, 0.045), r.float(0, TAU)]);
    return Object.assign({
      exp: r.weighted([[2, 3], [2.4, 3], [3, 2], [3.8, 1]]) + r.float(-0.15, 0.15),
      pinch: r.chance(0.28) ? r.float(0.4, 1) : 0,
      wobble,
      fuzz: r.chance(0.16) ? r.float(0.04, 0.07) : 0,
    }, base);
  }

  // Shadowed body: base shade, body colour offset up-left inside the clip, shine, ink outline.
  function shadedShape(id, shape, pal, extra) {
    return (
      `<clipPath id="${id}">${path(shape.d)}</clipPath>` +
      `<g clip-path="url(#${id})">` +
      path(shape.d, { fill: pal.shade }) +
      path(shape.d, { fill: pal.body, transform: "translate(-3.2,-3.4)" }) +
      (extra || "") +
      `</g>` +
      path(shape.d, { fill: "none", stroke: pal.ink, "stroke-width": 2.4, "stroke-linejoin": "round" })
    );
  }

  // ---------- palette ----------

  function makePalette(r, theme) {
    const hue = r.float(0, 360);
    const sat = r.float(46, 72);
    let lig = r.float(58, 72);
    if (hue > 38 && hue < 85) lig = Math.max(lig, 66); // avoid olive/mustard mud
    if (hue > 200 && hue < 280) lig = Math.max(lig, 62);
    const scheme = r.pick(["analog", "comp", "split"]);
    const bgHue = scheme === "analog" ? hue + r.sign() * r.float(35, 60) : scheme === "comp" ? hue + 180 + r.float(-20, 20) : hue + r.sign() * r.float(140, 160);
    const bgSat = r.float(30, 55);
    const dark = theme === "dark";
    const bgL = dark ? r.float(19, 25) : r.float(86, 92);
    const accentHue = hue + r.sign() * r.float(110, 170);
    return {
      hue,
      body: hsl(hue, sat, lig),
      shade: hsl(hue + r.float(-10, 10), sat * 0.95, lig - 14),
      light: hsl(hue, sat * 0.75, Math.min(lig + 17, 93)),
      ink: hsl(hue, 38, 13),
      eyeWhite: hsl(hue, 35, 98),
      bg: hsl(bgHue, bgSat, bgL),
      bgAlt: hsl(bgHue, bgSat, dark ? bgL + 6 : bgL - 6),
      accent: hsl(accentHue, r.float(58, 78), r.float(50, 60)),
      accentShade: hsl(accentHue, 60, 38),
      accent2: hsl(accentHue + r.sign() * 60, r.float(55, 75), r.float(60, 72)),
      gold: "hsl(43,88%,58%)",
      bone: "hsl(40,38%,91%)",
      blush: hsl(hue > 300 || hue < 30 ? 340 : 352, 85, 72, 0.55),
      tongue: "hsl(352,72%,62%)",
      leaf: "hsl(128,42%,46%)",
      iris: hsl(hue + 180, 80, 62),
    };
  }

  // ---------- trait tables ----------

  const EYE_LAYOUTS = [["pair", 60], ["cyclops", 16], ["triple", 9], ["visor", 6], ["stalks", 9]];
  const EYE_STYLES = [["round", 24], ["dot", 14], ["sleepy", 10], ["happy", 8], ["wide", 10], ["slit", 8], ["angry", 8], ["lashes", 8]];
  const MOUTHS = [["smile", 16], ["grin", 12], ["fangs", 12], ["teeth", 8], ["o", 7], ["flat", 7], ["wavy", 8], ["cat", 9], ["tongue", 10], ["beak", 5]];
  const TOPS = [["none", 12], ["horns", 13], ["antennae", 11], ["ears-round", 10], ["ears-pointy", 10], ["ears-floppy", 8], ["sprout", 7], ["tuft", 9], ["curl", 6], ["fin", 7]];
  const HATS = [["none", 50], ["beanie", 7], ["cap", 6], ["crown", 5], ["party", 5], ["tophat", 5], ["bow", 5], ["flower", 5], ["halo", 3], ["headband", 5], ["headphones", 4]];
  // Which top features each hat can coexist with.
  const HAT_TOPS = {
    beanie: ["none", "ears-floppy", "horns"],
    cap: ["none", "ears-floppy", "ears-round"],
    crown: ["none", "ears-round", "ears-pointy", "ears-floppy", "horns"],
    party: ["none", "ears-round", "ears-pointy", "ears-floppy", "horns"],
    tophat: ["none", "ears-round", "ears-pointy", "ears-floppy", "horns"],
    bow: ["none", "horns", "antennae", "ears-round", "ears-pointy", "ears-floppy", "fin"],
    flower: ["none", "horns", "antennae", "ears-round", "ears-pointy", "ears-floppy", "fin"],
    halo: ["none", "ears-round", "ears-pointy", "ears-floppy", "horns"],
    headband: TOPS.map((t) => t[0]).concat("stalks"),
    headphones: ["none", "tuft", "curl", "horns", "fin"],
  };
  const FACE_ACC = [["none", 64], ["glasses", 10], ["shades", 7], ["monocle", 5], ["mustache", 6], ["bandaid", 8]];
  const NECK_ACC = [["none", 58], ["scarf", 10], ["bowtie", 9], ["bandana", 9], ["collar", 8], ["beads", 6]];
  const PATTERNS = [["none", 30], ["spots", 16], ["stripes", 12], ["belly", 16], ["patch", 9], ["freckles", 10], ["gradient", 7]];
  const BACKDROPS = [["disc", 36], ["none", 22], ["rings", 14], ["dots", 14], ["rays", 14]];

  // ---------- public configuration ----------

  function deepFreeze(value) {
    for (const child of Object.values(value)) if (child && typeof child === "object") deepFreeze(child);
    return Object.freeze(value);
  }
  const choice = (label, table) => ({ label, type: "enum", values: table.map(([value]) => value) });
  const traitSchema = deepFreeze({
    kind: choice("Body", [["blob"], ["bust"]]),
    eyes: choice("Eye layout", EYE_LAYOUTS),
    eyeStyle: choice("Eye style", EYE_STYLES),
    mouth: choice("Mouth", MOUTHS),
    top: choice("Top feature", TOPS.concat([["stalks"]])),
    hat: choice("Hat", HATS),
    face: choice("Face accessory", FACE_ACC),
    neck: choice("Neck accessory", NECK_ACC),
    earring: { label: "Earring", type: "boolean", values: [false, true] },
    pattern: choice("Pattern", PATTERNS),
    cheeks: { label: "Cheeks", type: "boolean", values: [false, true] },
    backdrop: choice("Backdrop", BACKDROPS),
  });
  function rule(left, right, accepts) {
    return { traits: [left, right], allowed: traitSchema[left].values.flatMap(a =>
      traitSchema[right].values.filter(b => accepts(a, b)).map(b => [a, b])) };
  }
  // Declarative constraints are exported so editors can explain unavailable choices.
  const traitCompatibility = deepFreeze([
    rule("eyes", "top", (eyes, top) => (eyes === "stalks") === (top === "stalks")),
    rule("hat", "top", (hat, top) => hat === "none" || HAT_TOPS[hat].includes(top)),
    rule("face", "eyes", (face, eyes) => face === "glasses" ? eyes === "pair" :
      face === "shades" ? ["pair", "cyclops"].includes(eyes) :
      face === "monocle" ? ["pair", "cyclops", "triple"].includes(eyes) : true),
    rule("earring", "hat", (earring, hat) => !earring || hat !== "headphones"),
    rule("earring", "top", (earring, top) => !earring || top !== "ears-floppy"),
    rule("pattern", "eyes", (pattern, eyes) => pattern !== "patch" || ["pair", "cyclops", "triple"].includes(eyes)),
  ]);

  function record(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${label} must be a plain object`);
    return value;
  }
  function keys(value, allowed, label) {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unknown ${label}: ${key}`);
  }
  function validateOptions(options = {}) {
    record(options, "options");
    keys(options, ["size", "theme", "idPrefix", "seedMode", "traits", "colors"], "option");
    if (options.size !== undefined && (!Number.isFinite(options.size) || options.size <= 0)) throw new TypeError("size must be a positive finite number");
    if (options.theme !== undefined && !["light", "dark"].includes(options.theme)) throw new TypeError("theme must be light or dark");
    if (options.seedMode !== undefined && !["name", "raw"].includes(options.seedMode)) throw new TypeError("seedMode must be name or raw");
    if (options.idPrefix !== undefined && (typeof options.idPrefix !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(options.idPrefix)))
      throw new TypeError("idPrefix must start with a letter and contain only letters, digits, underscores or hyphens");
    const traits = options.traits === undefined ? {} : record(options.traits, "traits");
    keys(traits, Object.keys(traitSchema), "trait");
    for (const [key, value] of Object.entries(traits)) if (!traitSchema[key].values.includes(value)) throw new TypeError(`Invalid trait ${key}: ${String(value)}`);
    const colors = options.colors === undefined ? {} : record(options.colors, "colors");
    keys(colors, ["body", "accent", "background", "ink"], "color");
    for (const [key, value] of Object.entries(colors)) if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value))
      throw new TypeError(`Color ${key} must be #RGB or #RRGGBB`);
    return { ...options, traits: { ...traits }, colors: { ...colors } };
  }
  function seedKey(seed, mode) {
    if (mode === "raw") {
      if (typeof seed !== "string" || !seed.length) throw new TypeError("raw seed must be a nonempty string");
      return seed;
    }
    return normalizeName(seed) || "?";
  }

  function resolveTraits(key, overrides) {
    const base = generatedTraits(key);
    if (!Object.keys(overrides).length) return base;
    const result = { ...base, ...overrides };
    const fields = [...new Set(traitCompatibility.flatMap(rule => rule.traits))];
    const assigned = {};
    let best, bestCost = Infinity;
    // Find the compatible result changing the fewest generated traits. Original
    // legacy combinations stay untouched unless a related choice changes.
    function search(index, cost) {
      if (cost >= bestCost) return;
      if (index === fields.length) { best = { ...assigned }; bestCost = cost; return; }
      const field = fields[index];
      const values = Object.hasOwn(overrides, field) ? [overrides[field]] :
        [base[field], ...traitSchema[field].values.filter(v => v !== base[field])];
      for (const value of values) {
        assigned[field] = value;
        const valid = traitCompatibility.every(({ traits: [a, b], allowed }) =>
          !Object.hasOwn(assigned, a) || !Object.hasOwn(assigned, b) ||
          (!Object.hasOwn(overrides, a) && !Object.hasOwn(overrides, b) && assigned[a] === base[a] && assigned[b] === base[b]) ||
          allowed.some(([x, y]) => assigned[a] === x && assigned[b] === y));
        if (valid) search(index + 1, cost + (!Object.hasOwn(overrides, field) && value !== base[field] ? 1 : 0));
        delete assigned[field];
      }
    }
    search(0, 0);
    if (!best) throw new RangeError(`Incompatible traits: ${Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    return { ...result, ...best };
  }
  function monsterTraits(seed, options) {
    const opts = validateOptions(options);
    return resolveTraits(seedKey(seed, opts.seedMode), opts.traits);
  }

  function hexHsl(hex) {
    const expanded = hex.length === 4 ? [...hex.slice(1)].map(c => c + c).join("") : hex.slice(1);
    const [r, g, b] = [0, 2, 4].map(i => parseInt(expanded.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, light = (max + min) / 2;
    const hue = !delta ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return [hue * 60, delta ? delta / (1 - Math.abs(2 * light - 1)) * 100 : 0, light * 100];
  }
  function applyColors(palette, colors, theme) {
    if (colors.body) {
      const [h, s, l] = hexHsl(colors.body);
      Object.assign(palette, { hue: h, body: colors.body, shade: hsl(h, s * 0.95, l - 14), light: hsl(h, s * 0.75, l + 17) });
    }
    if (colors.accent) {
      const [h, s, l] = hexHsl(colors.accent);
      Object.assign(palette, { accent: colors.accent, accentShade: hsl(h, s, l - 14), accent2: hsl(h + 60, s, l + 10) });
    }
    if (colors.background) {
      const [h, s, l] = hexHsl(colors.background);
      Object.assign(palette, { bg: colors.background, bgAlt: hsl(h, s, l + (theme === "dark" ? 6 : -6)) });
    }
    if (colors.ink) palette.ink = colors.ink;
    return palette;
  }

  function restoreAvatar(config, presentation = {}) {
    record(config, "config");
    keys(config, ["version", "seed", "seedMode", "theme", "traits", "colors"], "configuration field");
    if (config.version !== VERSION) throw new RangeError(`Unsupported avatar version: ${String(config.version)}`);
    if (typeof config.seed !== "string" || !["name", "raw"].includes(config.seedMode) || !["light", "dark"].includes(config.theme))
      throw new TypeError("config requires a string seed, seedMode and theme");
    record(config.traits, "config.traits");
    record(config.colors, "config.colors");
    record(presentation, "presentation");
    keys(presentation, ["size", "idPrefix"], "presentation option");
    return monsterAvatar(config.seed, { seedMode: config.seedMode, theme: config.theme, traits: config.traits, colors: config.colors, ...presentation });
  }

  // ---------- main ----------

  function generatedTraits(key) {
    const R = (t) => stream(key, t);
    const layout = R("eyes.layout").weighted(EYE_LAYOUTS);
    let hat = R("hat").weighted(HATS);
    let top = layout === "stalks" ? "stalks" : R("top").weighted(TOPS);
    if (hat !== "none" && !HAT_TOPS[hat].includes(top)) {
      // Prefer keeping the body feature; drop the hat unless the dice say otherwise.
      if (R("hat.resolve").chance(0.5)) top = R("top.resolve").pick(HAT_TOPS[hat].filter((t) => t !== "stalks") || ["none"]);
      else hat = "none";
      if (top === "stalks" && hat !== "headband") hat = "none";
    }
    return {
      key,
      kind: R("kind").weighted([["blob", 5], ["bust", 5]]),
      eyes: layout,
      eyeStyle: R("eyes.style").weighted(EYE_STYLES),
      mouth: R("mouth").weighted(MOUTHS),
      top,
      hat,
      face: R("acc.face").weighted(FACE_ACC),
      neck: R("acc.neck").weighted(NECK_ACC),
      earring: R("acc.ear").chance(0.12),
      pattern: R("pattern").weighted(PATTERNS),
      cheeks: R("cheeks").chance(0.45),
      backdrop: R("backdrop").weighted(BACKDROPS),
    };
  }

  function monsterAvatar(name, options) {
    const opts = validateOptions(options);
    const traits = resolveTraits(seedKey(name, opts.seedMode), opts.traits);
    const key = traits.key;
    const R = (t) => stream(key, t);
    const id = (opts.idPrefix || "m" + hash32(key).toString(36)) + "-";
    const pal = applyColors(makePalette(R("palette"), opts.theme), opts.colors, opts.theme);
    const back = [], mid = [], front = [];

    // --- body & head geometry ---
    const g = R("geometry");
    let head, torso = null;
    if (traits.kind === "blob") {
      // Leave headroom inside the circle crop when something sticks out of the top.
      const tall = ["horns", "antennae", "sprout", "stalks", "ears-pointy", "tuft", "fin", "curl"].includes(traits.top) || ["crown", "party", "tophat", "halo"].includes(traits.hat);
      const rx = g.float(27, 35), ry = g.float(52, 60), topY = tall ? g.float(24, 29) : g.float(15, 23);
      head = makeBlob(blobParams(R("shape.head"), { cx: 50, cy: topY + ry, rx, ry }));
    } else {
      const trx = g.float(34, 44);
      torso = makeBlob(blobParams(R("shape.torso"), { cx: 50, cy: g.float(76, 83) + 40, rx: trx, ry: 40, pinch: 0, fuzz: 0 }));
      const rx = g.float(24, 33), ry = g.float(23, 28);
      head = makeBlob(blobParams(R("shape.head"), { cx: 50, cy: g.float(45, 50), rx, ry }));
    }
    const s = head.rx / 30; // feature scale
    const hx = head.topX, hy = head.top;

    // --- face layout ---
    const f = R("face.layout");
    const eyeY = traits.kind === "blob" ? hy + f.float(24, 31) : head.cy - head.ry * f.float(0, 0.12);
    const [spanL, spanR] = head.span(eyeY);
    const halfW = (spanR - spanL) / 2;
    const faceX = (spanL + spanR) / 2 + f.float(-2, 2);
    const look = { x: f.float(-1, 1), y: f.float(-0.6, 0.6) };
    let mouthW = s * f.float(7, 12.5);
    let mouthY = eyeY + s * f.float(11, 15.5);
    if (torso) mouthY = Math.min(mouthY, head.cy + head.ry - mouthW * 0.8 - 4);

    // --- backdrop ---
    const bg = R("backdrop.detail");
    let backdrop = tag("rect", { width: 100, height: 100, fill: pal.bg });
    if (traits.backdrop === "disc") backdrop += circle(50 + bg.float(-6, 6), 50 + bg.float(-4, 8), bg.float(30, 40), { fill: pal.bgAlt });
    else if (traits.backdrop === "rings") {
      const cx = 50 + bg.float(-8, 8), cy = 50 + bg.float(-8, 8);
      for (let i = 1; i <= 3; i++) backdrop += circle(cx, cy, i * bg.float(13, 16), { fill: "none", stroke: pal.bgAlt, "stroke-width": 3.5 });
    } else if (traits.backdrop === "dots") {
      const step = bg.float(9, 12), off = bg.float(0, step);
      backdrop += `<pattern id="${id}dots" width="${n(step)}" height="${n(step * 2)}" x="${n(off)}" y="${n(off)}" patternUnits="userSpaceOnUse">` +
        circle(step / 4, step / 2, 1.6, { fill: pal.bgAlt }) + circle(step * 0.75, step * 1.5, 1.6, { fill: pal.bgAlt }) + `</pattern>` +
        tag("rect", { width: 100, height: 100, fill: `url(#${id}dots)` });
    } else if (traits.backdrop === "rays") {
      const cx = 50, cy = bg.float(50, 70), count = bg.pick([10, 12, 14, 16]), rot = bg.float(0, TAU);
      let d = "";
      for (let i = 0; i < count; i++) {
        const a = rot + (i / count) * TAU, w = (TAU / count) * 0.28;
        d += `M${P(cx, cy)}L${P(cx + Math.cos(a - w) * 90, cy + Math.sin(a - w) * 90)}L${P(cx + Math.cos(a + w) * 90, cy + Math.sin(a + w) * 90)}Z`;
      }
      backdrop += path(d, { fill: pal.bgAlt });
    }

    // --- top features (behind the head unless noted) ---
    const t = R("top.detail");
    const inkLine = (w) => ({ fill: "none", stroke: pal.ink, "stroke-width": w || 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" });
    const inkFill = (fill, w) => ({ fill, stroke: pal.ink, "stroke-width": w || 2.2, "stroke-linejoin": "round" });

    if (traits.top === "horns") {
      const color = t.chance(0.65) ? pal.bone : pal.accentShade;
      const y0 = hy + s * t.float(4, 8), reach = s * t.float(8, 14), rise = s * t.float(13, 20), bend = t.sign();
      for (const side of [-1, 1]) {
        const bx = head.edge(y0, side) - side * 5 * s, w = 3.8 * s;
        const tip = [bx + side * reach, y0 - rise];
        const c = [bx + side * (reach * (bend > 0 ? 1.1 : -0.2)), y0 - rise * 0.45];
        back.push(path(`M${P(bx - w, y0 + 2)}Q${P(c[0] - w * 0.5, c[1])} ${P(tip[0], tip[1])}Q${P(c[0] + w * 0.5, c[1] + 2)} ${P(bx + w, y0 + 2)}Z`, inkFill(color)));
      }
    } else if (traits.top === "antennae") {
      const single = t.chance(0.3), color = t.pick([pal.accent, pal.gold, pal.accent2]);
      const sides = single ? [0] : [-1, 1];
      const spread = s * t.float(6, 10), rise = s * t.float(12, 17), lean = s * t.float(3, 7);
      for (const side of sides) {
        const bx = hx + side * spread, by = hy + 4;
        const tx = bx + side * lean + (single ? t.float(-4, 4) : 0), ty = hy - rise;
        back.push(path(`M${P(bx, by)}Q${P(bx, ty + 4)} ${P(tx, ty)}`, inkLine(2.2)));
        back.push(circle(tx, ty, 3.6 * s, inkFill(color, 2)));
      }
    } else if (traits.top === "ears-round") {
      const r = s * t.float(8, 11), y = hy + s * t.float(5, 9);
      for (const side of [-1, 1]) {
        const x = head.edge(y, side) - side * 1;
        back.push(circle(x, y - r * 0.35, r, inkFill(pal.body)) + circle(x, y - r * 0.35, r * 0.52, { fill: pal.shade }));
      }
    } else if (traits.top === "ears-pointy") {
      const y1 = hy + s * 2, y2 = hy + s * t.float(12, 16), out = s * t.float(3, 8), up = s * t.float(8, 13);
      for (const side of [-1, 1]) {
        const x1 = head.edge(y1, side) - side * 6, x2 = head.edge(y2, side) - side * 3;
        const ax = (x1 + x2) / 2 + side * out, ay = hy - up;
        back.push(path(`M${P(x1, y1)}L${P(ax, ay)}L${P(x2, y2)}Z`, inkFill(pal.body)));
        back.push(path(`M${P(x1 * 0.75 + ax * 0.25, y1 + 2)}L${P(ax * 0.8 + x2 * 0.2, ay + 5)}L${P(x2 * 0.7 + ax * 0.3, y2 - 2)}Z`, { fill: pal.blush }));
      }
    } else if (traits.top === "ears-floppy") {
      const y = hy + s * t.float(4, 8), len = s * t.float(18, 26), w = s * t.float(9, 13);
      for (const side of [-1, 1]) {
        const bx = head.edge(y, side) - side * 4;
        back.push(path(`M${P(bx, y - 2)}C${P(bx + side * w * 1.6, y - 4)} ${P(bx + side * w * 1.4, y + len)} ${P(bx + side * w * 0.6, y + len)}C${P(bx, y + len)} ${P(bx - side * 2, y + len * 0.5)} ${P(bx, y + 6)}Z`, inkFill(pal.shade)));
      }
    } else if (traits.top === "sprout") {
      const lean = t.float(-4, 4), h = s * t.float(10, 14);
      const tx = hx + lean, ty = hy - h;
      back.push(path(`M${P(hx, hy + 3)}Q${P(hx, ty + 3)} ${P(tx, ty)}`, inkLine(2.2)));
      for (const side of [-1, 1]) {
        const lx = tx + side * 5.5 * s, ly = ty - 1;
        back.push(ellipse(lx, ly, 6 * s, 3 * s, Object.assign(inkFill(pal.leaf, 1.8), { transform: `rotate(${side * -30} ${n(lx)} ${n(ly)})` })));
      }
    } else if (traits.top === "tuft") {
      const count = t.int(3, 5), w = s * t.float(7, 11), h = s * t.float(6, 11), color = t.chance(0.5) ? pal.shade : pal.accent;
      let d = `M${P(hx - w, hy + 5)}`;
      for (let i = 0; i < count; i++) {
        const x0 = hx - w + ((2 * w) / count) * i;
        d += `Q${P(x0 + w / count * 0.3, hy - h * t.float(0.6, 1))} ${P(x0 + w / count * t.float(0.7, 1.4), hy - h * t.float(0.7, 1.1))}L${P(x0 + (2 * w) / count, hy + 3)}`;
      }
      back.push(path(d + "Z", inkFill(color)));
    } else if (traits.top === "curl") {
      const dir = t.sign();
      front.push(path(`M${P(hx, hy + 1)}C${P(hx - dir * 2, hy - 9)} ${P(hx + dir * 9, hy - 11)} ${P(hx + dir * 7, hy - 4)}C${P(hx + dir * 5.5, hy - 1)} ${P(hx + dir * 2, hy - 3)} ${P(hx + dir * 3.5, hy - 6)}`, inkLine(2.4)));
    } else if (traits.top === "fin") {
      const w = s * t.float(8, 12), h = s * t.float(7, 11), bumps = t.int(2, 4);
      let d = `M${P(hx - w, hy + 6)}`;
      for (let i = 0; i < bumps; i++) {
        const x1 = hx - w + ((2 * w) / bumps) * (i + 1), peak = h * (1 - Math.abs((i + 0.5) / bumps - 0.5));
        d += `Q${P(x1 - w / bumps, hy - peak * 1.6)} ${P(x1, hy + (i === bumps - 1 ? 6 : -peak * 0.3))}`;
      }
      back.push(path(d + "Z", inkFill(pal.accent)));
    } else if (traits.top === "stalks") {
      const spread = s * t.float(6, 9), rise = s * t.float(11, 15), r = s * t.float(5, 6.5);
      for (const side of [-1, 1]) {
        const bx = hx + side * spread, tx = bx + side * s * t.float(3, 7), ty = hy - rise;
        back.push(path(`M${P(bx, hy + 4)}Q${P(bx, ty + 5)} ${P(tx, ty)}`, inkLine(3)));
        back.push(drawEye(traits.eyeStyle, tx, ty, r, side));
      }
    }

    // --- torso ---
    if (torso) {
      const tp = R("pattern.torso");
      let extra = "";
      if (traits.pattern === "belly") extra = ellipse(50, torso.top + 30, torso.rx * 0.55, 26, { fill: pal.light });
      else if (traits.pattern === "stripes") extra = stripes(torso, tp);
      else if (traits.pattern === "spots") extra = spots(torso, tp, torso.top + 4, 100);
      mid.push(shadedShape(id + "torso", torso, pal, extra));
    }

    // --- head & pattern ---
    const pr = R("pattern.detail");
    let headExtra = "";
    if (traits.pattern === "spots") headExtra = spots(head, pr, hy, traits.kind === "blob" ? 100 : head.cy + head.ry);
    else if (traits.pattern === "stripes") headExtra = stripes(head, pr);
    else if (traits.pattern === "belly" && traits.kind === "blob") headExtra = ellipse(faceX, mouthY + 26, halfW * 0.72, 22, { fill: pal.light });
    else if (traits.pattern === "gradient") {
      headExtra = `<linearGradient id="${id}grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.accent2}" stop-opacity="0.85"/><stop offset="0.55" stop-color="${pal.accent2}" stop-opacity="0"/></linearGradient>` +
        tag("rect", { x: 0, y: hy - 2, width: 100, height: 60, fill: `url(#${id}grad)` });
    }
    // shine
    const shineY = hy + s * 8, shineX = head.edge(shineY, -1) + 6 * s;
    headExtra += path(`M${P(shineX, shineY + 7 * s)}Q${P(shineX, shineY)} ${P(shineX + 7 * s, shineY - 2 * s)}`, { fill: "none", stroke: "#fff", "stroke-opacity": 0.55, "stroke-width": 2.6, "stroke-linecap": "round" });
    mid.push(shadedShape(id + "head", head, pal, headExtra));

    // --- face ---
    const face = [];
    const ey = R("eyes.detail");
    const eyes = []; // [x, y, r, side]
    if (traits.eyes === "pair") {
      let r = s * ey.float(5, 8.5);
      let gap = s * ey.float(9, 14);
      gap = Math.min(gap, halfW - r - 4);
      const odd = ey.chance(0.15) ? ey.float(0.72, 0.85) : 1;
      eyes.push([faceX - gap, eyeY, r, -1], [faceX + gap, eyeY + (odd < 1 ? 1 : 0), r * odd, 1]);
    } else if (traits.eyes === "cyclops") {
      eyes.push([faceX, eyeY, Math.min(s * ey.float(9, 12.5), halfW * 0.55), 0]);
    } else if (traits.eyes === "triple") {
      const r = s * ey.float(4.6, 6);
      if (ey.chance(0.5)) {
        const gap = Math.min(s * 12, halfW - r - 3);
        eyes.push([faceX - gap, eyeY + 1, r, -1], [faceX, eyeY - 1, r * 1.1, 0], [faceX + gap, eyeY + 1, r, 1]);
      } else {
        const gap = Math.min(s * 9.5, halfW - r - 3);
        eyes.push([faceX - gap, eyeY + 2, r, -1], [faceX + gap, eyeY + 2, r, 1], [faceX, eyeY - r * 1.7, r * 0.85, 0]);
      }
    }
    if (traits.pattern === "patch" && eyes.length) {
      const e = eyes[eyes.length - 1];
      face.push(`<g clip-path="url(#${id}head)">` + circle(e[0] + 1, e[1] + 1, e[2] + s * 5.5, { fill: pal.shade }) + `</g>`);
    }
    if (traits.cheeks) {
      const cy = (eyeY + mouthY) / 2 + 3 * s, cx = Math.min(s * 15, halfW - 5);
      face.push(ellipse(faceX - cx, cy, 4.2 * s, 2.6 * s, { fill: pal.blush }) + ellipse(faceX + cx, cy, 4.2 * s, 2.6 * s, { fill: pal.blush }));
    }
    if (traits.pattern === "freckles") {
      const cy = (eyeY + mouthY) / 2 + 2 * s, cx = Math.min(s * 13, halfW - 6);
      for (const side of [-1, 1]) for (const [dx, dy] of [[-2.4, 0], [0, 1.6], [2.4, 0]]) face.push(circle(faceX + side * cx + dx * s, cy + dy * s, 0.9 * s, { fill: pal.accentShade, "fill-opacity": 0.7 }));
    }
    for (const e of eyes) face.push(drawEye(traits.eyeStyle, e[0], e[1], e[2], e[3]));
    if (traits.eyes === "visor") {
      const w = Math.min(s * 17, halfW - 3), h = s * ey.float(9, 12);
      face.push(tag("rect", Object.assign({ x: faceX - w, y: eyeY - h / 2, width: w * 2, height: h, rx: h / 2 }, inkFill(pal.ink))));
      const gx = faceX + look.x * (w - h * 0.6);
      face.push(ellipse(gx, eyeY, h * 0.55, h * 0.26, { fill: pal.iris }) + ellipse(gx, eyeY, h * 0.9, h * 0.34, { fill: pal.iris, "fill-opacity": 0.25 }));
    }

    // mouth
    face.push(drawMouth(traits.mouth, faceX, mouthY, mouthW, R("mouth.detail")));

    // face accessories
    const fa = R("acc.face.detail");
    const pair = eyes.length >= 2 && traits.eyes !== "triple" ? eyes : null;
    if (traits.face === "glasses" && pair) {
      const round = fa.chance(0.5), frame = fa.chance(0.5) ? pal.ink : pal.accentShade;
      const lens = (x, y, r) => round ? circle(x, y, r, { fill: "#fff", "fill-opacity": 0.18, stroke: frame, "stroke-width": 2.2 })
        : tag("rect", { x: x - r, y: y - r * 0.85, width: r * 2, height: r * 1.7, rx: r * 0.35, fill: "#fff", "fill-opacity": 0.18, stroke: frame, "stroke-width": 2.2 });
      const r0 = pair[0][2] + 3 * s, r1 = pair[1][2] + 3 * s;
      face.push(lens(pair[0][0], pair[0][1], r0) + lens(pair[1][0], pair[1][1], r1) +
        path(`M${P(pair[0][0] + r0, eyeY)}Q${P(faceX, eyeY - 3)} ${P(pair[1][0] - r1, eyeY)}`, { fill: "none", stroke: frame, "stroke-width": 2.2 }));
    } else if (traits.face === "shades" && (pair || traits.eyes === "cyclops")) {
      const targets = pair || eyes;
      let d = "";
      for (const e of targets) {
        const w = e[2] + 3.5 * s, h = e[2] + 1.5 * s;
        d += `M${P(e[0] - w, e[1] - h * 0.6)}L${P(e[0] + w, e[1] - h * 0.6)}Q${P(e[0] + w, e[1] + h)} ${P(e[0], e[1] + h)}Q${P(e[0] - w, e[1] + h)} ${P(e[0] - w, e[1] - h * 0.6)}Z`;
      }
      face.push(path(d, inkFill(pal.ink)));
      if (pair) face.push(path(`M${P(pair[0][0], eyeY - 2)}L${P(pair[1][0], eyeY - 2)}`, inkLine(2)));
      for (const e of targets) face.push(path(`M${P(e[0] - e[2] * 0.6, e[1] + e[2] * 0.2)}L${P(e[0] - e[2] * 0.1, e[1] - e[2] * 0.35)}`, { stroke: "#fff", "stroke-opacity": 0.55, "stroke-width": 1.6, "stroke-linecap": "round" }));
    } else if (traits.face === "monocle" && eyes.length) {
      const e = eyes[eyes.length - 1], r = e[2] + 3 * s;
      face.push(circle(e[0], e[1], r, { fill: "#fff", "fill-opacity": 0.2, stroke: pal.gold, "stroke-width": 2.2 }) +
        path(`M${P(e[0] + r * 0.7, e[1] + r * 0.7)}Q${P(e[0] + r * 1.4, e[1] + r * 3)} ${P(e[0] + r * 0.4, e[1] + r * 4.5)}`, { fill: "none", stroke: pal.gold, "stroke-width": 1.2 }));
    } else if (traits.face === "mustache") {
      const my = mouthY - s * 3.5, w = s * fa.float(8, 12), c = fa.pick([pal.ink, pal.shade, pal.accentShade]);
      face.push(path(`M${P(faceX, my - 1)}C${P(faceX - w * 0.4, my - 4)} ${P(faceX - w, my - 3)} ${P(faceX - w * 1.15, my + 2)}C${P(faceX - w * 0.7, my + 1)} ${P(faceX - w * 0.3, my + 3)} ${P(faceX, my + 1)}C${P(faceX + w * 0.3, my + 3)} ${P(faceX + w * 0.7, my + 1)} ${P(faceX + w * 1.15, my + 2)}C${P(faceX + w, my - 3)} ${P(faceX + w * 0.4, my - 4)} ${P(faceX, my - 1)}Z`, inkFill(c, 1.6)));
    } else if (traits.face === "bandaid") {
      const side = fa.sign(), x = faceX + side * Math.min(s * 15, halfW - 6), y = (eyeY + mouthY) / 2 + 4 * s, rot = fa.float(-40, 40);
      face.push(`<g transform="rotate(${n(rot)} ${n(x)} ${n(y)})">` + tag("rect", { x: x - 6 * s, y: y - 2.2 * s, width: 12 * s, height: 4.4 * s, rx: 2 * s, fill: "hsl(30,62%,80%)", stroke: pal.ink, "stroke-width": 1.4 }) +
        tag("rect", { x: x - 2 * s, y: y - 2.2 * s, width: 4 * s, height: 4.4 * s, fill: "hsl(30,50%,70%)" }) + `</g>`);
    }
    if (traits.earring && traits.top !== "ears-floppy" && traits.hat !== "headphones") {
      const side = R("acc.ear.detail").sign(), y = eyeY + 7 * s, x = head.edge(y, side);
      face.push(circle(x + side * 0.5, y + 4, 3, { fill: "none", stroke: pal.gold, "stroke-width": 1.8 }));
    }

    // --- neck accessories ---
    const na = R("acc.neck.detail");
    const neckY = torso ? head.cy + head.ry - 1 : mouthY + s * na.float(15, 19);
    const neckW = torso ? head.rx * 0.8 : 60;
    const neckColor = na.pick([pal.accent, pal.accent2, pal.accentShade]);
    const clipBody = (inner) => (torso ? inner : `<g clip-path="url(#${id}head)">${inner}</g>`);
    if (traits.neck === "scarf") {
      const h = 7.5 * s, side = na.sign();
      front.push(clipBody(tag("rect", Object.assign({ x: 50 - neckW, y: neckY - h / 2, width: neckW * 2, height: h, rx: h / 2 }, inkFill(neckColor)))));
      const tx = 50 + side * neckW * (torso ? 0.55 : 0.3);
      front.push(path(`M${P(tx - 3.5, neckY)}L${P(tx + side * 2 - 4, neckY + 16)}L${P(tx + side * 2 + 4, neckY + 16)}L${P(tx + 3.5, neckY)}Z`, inkFill(neckColor)));
      front.push(path(`M${P(tx + side * 2 - 4, neckY + 12)}L${P(tx + side * 2 + 4, neckY + 12)}`, { stroke: pal.eyeWhite, "stroke-width": 1.6 }));
    } else if (traits.neck === "bowtie") {
      const w = 8 * s, h = 5 * s, y = neckY + (torso ? 2 : 0);
      front.push(path(`M50,${n(y)}L${P(50 - w, y - h)}L${P(50 - w, y + h)}ZM50,${n(y)}L${P(50 + w, y - h)}L${P(50 + w, y + h)}Z`, inkFill(neckColor)) + circle(50, y, 2.4 * s, inkFill(neckColor, 1.8)));
    } else if (traits.neck === "bandana") {
      const w = (torso ? neckW : head.edge(neckY, 1) - 50) * 0.95;
      front.push(clipBody(path(`M${P(50 - w, neckY - 3)}Q50,${n(neckY + 2)} ${P(50 + w, neckY - 3)}L50,${n(neckY + w * 0.7)}Z`, inkFill(neckColor))));
      for (const [dx, dy] of [[-w * 0.4, 3], [w * 0.4, 3], [0, w * 0.35]]) front.push(circle(50 + dx, neckY + dy, 1.1, { fill: "#fff", "fill-opacity": 0.85 }));
    } else if (traits.neck === "collar") {
      front.push(clipBody(tag("rect", Object.assign({ x: 50 - neckW, y: neckY - 2, width: neckW * 2, height: 4, rx: 2 }, inkFill(neckColor, 1.8)))));
      front.push(circle(50, neckY + 5.5, 3.2, inkFill(pal.gold, 1.8)));
    } else if (traits.neck === "beads") {
      const count = 7, w = torso ? neckW * 0.9 : Math.min(22, head.edge(neckY, 1) - 54);
      for (let i = 0; i < count; i++) {
        const u = i / (count - 1) - 0.5;
        front.push(circle(50 + u * 2 * w, neckY + (1 - 4 * u * u) * 5, 2.2, inkFill(i % 2 ? pal.accent : pal.accent2, 1.4)));
      }
    }

    // --- hats ---
    const h = R("hat.detail");
    const hatColor = h.pick([pal.accent, pal.accent2, pal.accentShade]);
    const tiltHat = (inner, px, py, deg) => `<g transform="rotate(${n(deg)} ${n(px)} ${n(py)})">${inner}</g>`;
    if (traits.hat === "beanie" || traits.hat === "cap") {
      const depth = s * (traits.hat === "beanie" ? h.float(10, 13) : h.float(8, 10));
      const baseY = hy + depth, [l, r] = head.span(baseY);
      const dome = traits.hat === "beanie" ? 13 : 9;
      front.push(path(`M${P(l - 2, baseY)}C${P(l - 2, hy - dome)} ${P(r + 2, hy - dome)} ${P(r + 2, baseY)}Z`, inkFill(hatColor)));
      if (traits.hat === "beanie") {
        front.push(tag("rect", Object.assign({ x: l - 4, y: baseY - 5, width: r - l + 8, height: 7, rx: 3 }, inkFill(pal.accent2 === hatColor ? pal.accent : pal.accent2))));
        if (h.chance(0.7)) front.push(circle((l + r) / 2, hy - dome * 0.72, 4.5 * s, inkFill(pal.eyeWhite)));
      } else {
        const side = h.sign(), bx = side > 0 ? r : l;
        front.push(path(`M${P(bx - side * 6, baseY - 1)}Q${P(bx + side * 12, baseY - 3)} ${P(bx + side * 17, baseY + 2)}Q${P(bx + side * 8, baseY + 4.5)} ${P(bx - side * 6, baseY + 2)}Z`, inkFill(pal.accentShade)));
        front.push(circle((l + r) / 2, hy - dome * 0.72, 2, { fill: pal.ink }));
      }
    } else if (traits.hat === "crown") {
      const w = s * h.float(10, 13), baseY = hy + 3, peak = s * h.float(9, 12), deg = h.float(-14, 14);
      const d = `M${P(hx - w, baseY)}L${P(hx - w - 1, baseY - peak)}L${P(hx - w / 2, baseY - peak * 0.5)}L${P(hx, baseY - peak * 1.15)}L${P(hx + w / 2, baseY - peak * 0.5)}L${P(hx + w + 1, baseY - peak)}L${P(hx + w, baseY)}Z`;
      front.push(tiltHat(path(d, inkFill(pal.gold)) + circle(hx, baseY - 3, 1.8, { fill: pal.accent }) + circle(hx - w * 0.6, baseY - 3, 1.4, { fill: pal.accent2 }) + circle(hx + w * 0.6, baseY - 3, 1.4, { fill: pal.accent2 }), hx, baseY, deg));
    } else if (traits.hat === "party") {
      const w = s * h.float(7, 9), baseY = hy + 3, tall = s * h.float(17, 22), deg = h.float(-22, 22);
      const cone = `M${P(hx - w, baseY)}L${P(hx, baseY - tall)}L${P(hx + w, baseY)}Z`;
      front.push(tiltHat(
        `<clipPath id="${id}party">${path(cone)}</clipPath>` + path(cone, { fill: hatColor }) +
        `<g clip-path="url(#${id}party)">` + [0.3, 0.6].map((k) => path(`M${P(hx - w, baseY - tall * k + 3)}L${P(hx + w, baseY - tall * k - 3)}`, { stroke: pal.eyeWhite, "stroke-width": 2.6 })).join("") + `</g>` +
        path(cone, inkFill("none")) + circle(hx, baseY - tall, 3 * s, inkFill(pal.gold, 1.8)), hx, baseY, deg));
    } else if (traits.hat === "tophat") {
      const w = s * h.float(7, 9), baseY = hy + 3, tall = s * h.float(12, 16), deg = h.float(-16, 16);
      front.push(tiltHat(
        tag("rect", Object.assign({ x: hx - w, y: baseY - tall, width: w * 2, height: tall, rx: 1.5 }, inkFill(pal.ink))) +
        tag("rect", { x: hx - w + 1.2, y: baseY - 6, width: w * 2 - 2.4, height: 3.2, fill: hatColor }) +
        ellipse(hx, baseY, w + 5, 2.6, inkFill(pal.ink)), hx, baseY, deg));
    } else if (traits.hat === "bow" || traits.hat === "flower") {
      const side = h.sign(), y = hy + s * h.float(3, 6), x = head.edge(y, side) - side * 7 * s;
      if (traits.hat === "bow") {
        const w = 7 * s, hh = 5 * s;
        front.push(tiltHat(path(`M${P(x, y)}L${P(x - w, y - hh)}L${P(x - w, y + hh)}ZM${P(x, y)}L${P(x + w, y - hh)}L${P(x + w, y + hh)}Z`, inkFill(hatColor)) + circle(x, y, 2.4 * s, inkFill(hatColor, 1.8)), x, y, side * 20));
      } else {
        const r = 3.4 * s;
        let petals = "";
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; petals += circle(x + Math.cos(a) * r, y + Math.sin(a) * r, r, inkFill(pal.eyeWhite, 1.6)); }
        front.push(petals + circle(x, y, r * 0.8, inkFill(pal.gold, 1.6)));
      }
    } else if (traits.hat === "halo") {
      front.push(ellipse(hx, hy - 6, s * 13, 3.6, { fill: "none", stroke: pal.gold, "stroke-width": 2.8 }));
    } else if (traits.hat === "headband") {
      const y = hy + s * h.float(6, 9);
      front.push(`<g clip-path="url(#${id}head)">` + tag("rect", Object.assign({ x: 0, y: y - 3.2, width: 100, height: 6.4 }, inkFill(hatColor, 2))) +
        tag("rect", { x: 0, y: y - 0.6, width: 100, height: 1.2, fill: pal.eyeWhite, "fill-opacity": 0.8 }) + `</g>`);
    } else if (traits.hat === "headphones") {
      const y = eyeY - 3 * s, [l, r] = head.span(y);
      front.push(path(`M${P(l - 2, y)}C${P(l - 4, hy - 12)} ${P(r + 4, hy - 12)} ${P(r + 2, y)}`, { fill: "none", stroke: pal.ink, "stroke-width": 3.4, "stroke-linecap": "round" }));
      for (const x of [l - 1, r + 1]) front.push(tag("rect", Object.assign({ x: x - 4, y: y - 7, width: 8, height: 14, rx: 3.5 }, inkFill(hatColor))));
    }

    // --- assemble ---
    const tilt = R("pose").float(-5, 5);
    const body = `<g transform="rotate(${n(tilt)} 50 100)">${back.join("")}${mid.join("")}${face.join("")}${front.join("")}</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${opts.size || 100}" height="${opts.size || 100}">${backdrop}${body}</svg>`;
    return { svg, traits: Object.assign({}, traits, { hue: Math.round(pal.hue), tilt: n(tilt) }),
      colors: { body: pal.body, accent: pal.accent, background: pal.bg, ink: pal.ink },
      config: { version: VERSION, seed: String(name == null ? "" : name), seedMode: opts.seedMode || "name",
        theme: opts.theme || "light", traits: { ...opts.traits }, colors: { ...opts.colors } } };

    // ----- local drawers (hoisted) -----

    function drawEye(style, x, y, r, side) {
      const white = inkFill(pal.eyeWhite, 2);
      const px = x + look.x * r * 0.32, py = y + look.y * r * 0.32;
      const glint = (gx, gy, gr) => circle(gx, gy, gr, { fill: "#fff" });
      switch (style) {
        case "dot":
          return ellipse(px, py, r * 0.46, r * 0.56, { fill: pal.ink }) + glint(px - r * 0.14, py - r * 0.2, r * 0.16);
        case "sleepy": {
          const lid = `M${P(x - r, y)}A${n(r)} ${n(r)} 0 0 1 ${P(x + r, y)}Z`;
          return circle(x, y, r, white) + circle(px, y + r * 0.35, r * 0.48, { fill: pal.ink }) + path(lid, inkFill(pal.shade, 2)) + path(`M${P(x - r - 1, y)}L${P(x + r + 1, y)}`, inkLine(2.2));
        }
        case "happy":
          return path(`M${P(x - r * 0.9, y + r * 0.3)}Q${P(x, y - r * 1.1)} ${P(x + r * 0.9, y + r * 0.3)}`, inkLine(2.6));
        case "wide":
          return circle(x, y, r * 1.15, white) + circle(x + look.x * r * 0.5, y + look.y * r * 0.5, r * 0.32, { fill: pal.ink }) + glint(x + look.x * r * 0.5 - r * 0.1, y + look.y * r * 0.5 - r * 0.12, r * 0.1);
        case "slit":
          return circle(x, y, r, inkFill(pal.iris, 2)) + ellipse(px * 0.6 + x * 0.4, y, r * 0.17, r * 0.72, { fill: pal.ink }) + glint(x - r * 0.35, y - r * 0.35, r * 0.15);
        case "angry": {
          const inner = side === 0 ? null : -side;
          const brow = side === 0
            ? `M${P(x - r * 1.1, y - r * 1.5)}L${P(x, y - r * 1.05)}L${P(x + r * 1.1, y - r * 1.5)}`
            : `M${P(x + inner * r * 0.9, y - r * 1.0)}L${P(x - inner * r * 1.0, y - r * 1.55)}`;
          return circle(x, y, r, white) + circle(px, py + r * 0.1, r * 0.5, { fill: pal.ink }) + glint(px - r * 0.15, py - r * 0.1, r * 0.15) + path(brow, inkLine(2.6));
        }
        case "lashes": {
          const out = side === 0 ? [-1, 0, 1] : [side * 0.4, side];
          let lashes = "";
          for (const o of out) {
            const a = -Math.PI / 2 + o * 0.75;
            lashes += path(`M${P(x + Math.cos(a) * r, y + Math.sin(a) * r)}L${P(x + Math.cos(a) * (r + 3.2), y + Math.sin(a) * (r + 3.2))}`, inkLine(1.8));
          }
          return lashes + circle(x, y, r, white) + circle(px, py, r * 0.52, { fill: pal.ink }) + glint(px - r * 0.18, py - r * 0.2, r * 0.17);
        }
        default: // round
          return circle(x, y, r, white) + circle(px, py, r * 0.52, { fill: pal.ink }) + glint(px - r * 0.18, py - r * 0.2, r * 0.17);
      }
    }

    function drawMouth(style, x, y, w, m) {
      const curveY = (u, depth) => y + 2 * ((1 + u) / 2) * (1 - (1 + u) / 2) * depth; // on Q curve x-w → x+w
      switch (style) {
        case "grin": {
          const d = `M${P(x - w, y)}Q${P(x, y + w * 1.3)} ${P(x + w, y)}Z`;
          return `<clipPath id="${id}mouth">${path(d)}</clipPath>` + path(d, { fill: pal.ink }) +
            `<g clip-path="url(#${id}mouth)">${ellipse(x + w * 0.1, y + w * 0.62, w * 0.5, w * 0.3, { fill: pal.tongue })}</g>` + path(d, inkFill("none", 2.2));
        }
        case "fangs": {
          const depth = w * 0.7;
          let out = "";
          const us = m.chance(0.4) ? [m.pick([-0.45, 0.45])] : [-0.45, 0.45];
          for (const u of us) {
            const fx = x + u * w, fy = curveY(u, depth) - 0.4, fw = 2.2 * s, fh = 4 * s;
            out += path(`M${P(fx - fw, fy)}L${P(fx, fy + fh)}L${P(fx + fw, fy)}Z`, inkFill(pal.eyeWhite, 1.4));
          }
          return out + path(`M${P(x - w, y)}Q${P(x, y + depth)} ${P(x + w, y)}`, inkLine(2.4));
        }
        case "teeth": {
          const mw = w * 0.9, mh = w * 0.75;
          let t = "";
          for (let i = 1; i < 4; i++) t += path(`M${P(x - mw + (i * mw) / 2, y)}L${P(x - mw + (i * mw) / 2, y + mh * 0.42)}`, { stroke: pal.ink, "stroke-width": 1.2 });
          return tag("rect", { x: x - mw, y, width: mw * 2, height: mh, rx: mh * 0.45, fill: pal.ink }) +
            tag("rect", { x: x - mw + 1.2, y: y + 1, width: mw * 2 - 2.4, height: mh * 0.42, rx: 1, fill: pal.eyeWhite }) + t +
            tag("rect", Object.assign({ x: x - mw, y, width: mw * 2, height: mh, rx: mh * 0.45 }, inkFill("none", 2)));
        }
        case "o":
          return ellipse(x, y + w * 0.3, w * 0.34, w * 0.44, inkFill(pal.ink, 1.5)) + ellipse(x, y + w * 0.5, w * 0.2, w * 0.14, { fill: pal.tongue });
        case "flat": {
          const tilt = m.float(-2, 2);
          return path(`M${P(x - w * 0.65, y + 2 - tilt)}L${P(x + w * 0.65, y + 2 + tilt)}`, inkLine(2.4));
        }
        case "wavy":
          return path(`M${P(x - w, y + 1)}Q${P(x - w / 2, y - 2.5)} ${P(x, y + 1)}T${P(x + w, y + 1)}`, inkLine(2.4));
        case "cat":
          return path(`M${P(x - w * 0.85, y)}Q${P(x - w * 0.42, y + w * 0.6)} ${P(x, y)}Q${P(x + w * 0.42, y + w * 0.6)} ${P(x + w * 0.85, y)}`, inkLine(2.4));
        case "tongue": {
          const depth = w * 0.7, u = m.pick([-0.3, 0.3]), tx = x + u * w, ty = curveY(u, depth), tw = 3 * s, th = 5 * s;
          return path(`M${P(tx - tw, ty - 1)}L${P(tx - tw, ty + th - tw)}A${n(tw)} ${n(tw)} 0 0 0 ${P(tx + tw, ty + th - tw)}L${P(tx + tw, ty - 1)}Z`, inkFill(pal.tongue, 1.8)) +
            path(`M${P(tx, ty + 0.5)}L${P(tx, ty + th * 0.55)}`, { stroke: pal.ink, "stroke-opacity": 0.4, "stroke-width": 1 }) +
            path(`M${P(x - w, y)}Q${P(x, y + depth)} ${P(x + w, y)}`, inkLine(2.4));
        }
        case "beak": {
          const bw = w * 0.7, bh = w * 0.85;
          return path(`M${P(x - bw, y - 1)}Q${P(x, y - 3)} ${P(x + bw, y - 1)}L${P(x, y + bh)}Z`, inkFill("hsl(34,92%,58%)", 2)) + path(`M${P(x - bw * 0.7, y + 1.5)}L${P(x + bw * 0.7, y + 1.5)}`, { stroke: pal.ink, "stroke-width": 1.2 });
        }
        default: // smile
          return path(`M${P(x - w, y)}Q${P(x, y + w * 0.75)} ${P(x + w, y)}`, inkLine(2.4));
      }
    }

    function spots(shape, r, yMin, yMax) {
      let out = "";
      const count = r.int(4, 8);
      for (let i = 0; i < count; i++) {
        const y = r.float(yMin, Math.min(yMax, 100)), [l, rr] = shape.span(y);
        out += circle(r.float(l, rr), y, r.float(2, 5.5) * s, { fill: pal.shade, "fill-opacity": 0.6 });
      }
      return out;
    }

    function stripes(shape, r) {
      let out = "";
      const count = r.int(2, 4), start = shape.top + r.float(6, 12), step = r.float(7, 10);
      for (let i = 0; i < count; i++) {
        const y = start + i * step;
        for (const side of [-1, 1]) {
          const x = shape.edge(y, side), len = r.float(7, 13);
          out += path(`M${P(x + side * 2, y - 2.6)}L${P(x - side * len, y + r.float(-1.5, 1.5))}L${P(x + side * 2, y + 2.6)}Z`, { fill: pal.shade });
        }
      }
      return out;
    }
  }

  function monsterAvatarDataUri(name, options) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(monsterAvatar(name, options).svg);
  }

  const api = { monsterAvatar, monsterAvatarDataUri, monsterTraits, restoreAvatar, traitSchema, traitCompatibility, normalizeName, hash32, VERSION };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MonsterAvatar = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
