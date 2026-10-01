/* Browser playground for the public API. No framework or build required. */
(() => {
  'use strict';
  const { monsterAvatar, restoreAvatar, traitSchema, hash32 } = window.MonsterAvatar;
  const $ = id => document.getElementById(id);
  const title = value => String(value).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  let traits = {}, colors = {}, current = null, uid = 0;
  let names = [];
  const theme = () => $('darkbg').checked ? 'dark' : 'light';
  const options = () => ({ seedMode: $('seed-mode').value, theme: theme(), traits, colors });
  const status = (message = '', error = false) => { $('status').textContent = message; $('status').dataset.error = String(error); };

  for (const [key, schema] of Object.entries(traitSchema)) {
    const label = document.createElement('label');
    label.className = 'control';
    label.textContent = schema.label;
    const select = document.createElement('select');
    select.id = `trait-${key}`;
    select.add(new Option('Automatic', ''));
    for (const value of schema.values) select.add(new Option(typeof value === 'boolean' ? value ? 'On' : 'Off' : title(value), String(value)));
    select.onchange = () => {
      if (select.value === '') delete traits[key];
      else traits[key] = schema.type === 'boolean' ? select.value === 'true' : select.value;
      renderHero();
    };
    label.append(select);
    $('trait-controls').append(label);
  }
  for (const [key, fallback] of Object.entries({ body: '#a2c875', accent: '#ea8aa6', background: '#e8e4f2', ink: '#24232c' })) {
    const group = document.createElement('div');
    group.className = 'control';
    const label = document.createElement('label');
    label.htmlFor = `color-${key}`;
    label.textContent = key === 'ink' ? 'Outline' : title(key);
    const row = document.createElement('div'); row.className = 'color-row';
    const input = document.createElement('input');
    input.type = 'color'; input.id = `color-${key}`; input.value = fallback; input.disabled = true;
    const automaticLabel = document.createElement('label'); automaticLabel.className = 'toggle';
    const automatic = document.createElement('input');
    automatic.type = 'checkbox'; automatic.id = `auto-${key}`; automatic.checked = true;
    automaticLabel.append(automatic, 'Automatic');
    automatic.setAttribute('aria-label', `Automatic ${key === 'ink' ? 'outline' : key}`);
    automatic.onchange = () => {
      input.disabled = automatic.checked;
      if (automatic.checked) delete colors[key]; else colors[key] = input.value;
      renderHero();
    };
    input.oninput = () => { colors[key] = input.value; renderHero(); };
    row.append(input, automaticLabel); group.append(label, row); $('color-controls').append(group);
  }

  function avatar(seed, size, custom = false) {
    const element = document.createElement('span');
    element.className = 'av';
    element.style.width = element.style.height = `${size}px`;
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', `Monster avatar for ${seed}`);
    element.innerHTML = monsterAvatar(seed, { ...(custom ? options() : { theme: theme() }), idPrefix: `demo-${uid++}` }).svg;
    return element;
  }
  const colorContext = document.createElement('canvas').getContext('2d');
  function renderHero() {
    try {
      current = monsterAvatar($('name').value, options());
      $('big').innerHTML = monsterAvatar($('name').value, { ...options(), idPrefix: 'hero' }).svg;
      $('big').setAttribute('role', 'img'); $('big').setAttribute('aria-label', 'Your monster avatar');
      $('traits').replaceChildren(...Object.entries(current.traits).filter(([k]) => k !== 'key').map(([key, value]) => {
        const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = `${key} ${value}`; return chip;
      }));
      $('ramp').replaceChildren(...[24, 32, 36, 44, 56, 80].map(size => {
        const figure = document.createElement('figure');
        figure.append(avatar($('name').value, size, true), Object.assign(document.createElement('span'), { textContent: `${size}px` })); return figure;
      }));
      $('hash').textContent = hash32(current.traits.key).toString(16).padStart(8, '0');
      $('key').textContent = JSON.stringify(current.traits.key);
      for (const key of Object.keys(traitSchema)) $(`trait-${key}`).options[0].textContent = `Automatic (${title(current.traits[key])})`;
      for (const key of ['body', 'accent', 'background', 'ink']) if (!Object.hasOwn(colors, key)) {
        colorContext.fillStyle = current.colors[key];
        $(`color-${key}`).value = colorContext.fillStyle;
      }
      status();
    } catch (error) {
      current = null;
      $('big').replaceChildren(); $('traits').replaceChildren(); $('ramp').replaceChildren();
      $('hash').textContent = '—'; $('key').textContent = '—';
      status(error.message, true);
    }
    for (const id of ['copy', 'download', 'export']) $(id).disabled = !current;
  }
  function syncControls() {
    for (const key of Object.keys(traitSchema)) $(`trait-${key}`).value = Object.hasOwn(traits, key) ? String(traits[key]) : '';
    for (const key of ['body', 'accent', 'background', 'ink']) {
      const automatic = !Object.hasOwn(colors, key);
      $(`auto-${key}`).checked = automatic; $(`color-${key}`).disabled = automatic;
      if (!automatic) $(`color-${key}`).value = colors[key].length === 4 ? '#' + [...colors[key].slice(1)].map(c => c + c).join('') : colors[key];
    }
  }
  function renderGallery() {
    $('grid').replaceChildren(...names.map(name => {
      const button = document.createElement('button'); button.className = 'cell';
      button.append(avatar(name, 72), Object.assign(document.createElement('span'), { textContent: name }));
      button.onclick = () => { $('name').value = name; renderHero(); window.scrollTo({ top: 0, behavior: 'instant' }); };
      return button;
    }));
    const lines = ['Added a new project', 'Shared an update', 'Joined the team', 'Left a comment', 'Uploaded a photo'];
    for (const side of ['before', 'after']) $(side).replaceChildren(...names.slice(0, 5).map((name, i) => {
      const row = document.createElement('div'); row.className = 'row';
      const picture = side === 'after' ? avatar(name, 44) : Object.assign(document.createElement('span'), { className: 'letter', textContent: name[0] });
      const meta = document.createElement('div'); meta.className = 'meta';
      for (const text of [name, lines[i]]) meta.append(Object.assign(document.createElement('div'), { textContent: text }));
      row.append(picture, meta); return row;
    }));
  }
  function shuffleGallery() {
    const first = ['Ava', 'Noah', 'Mia', 'Leo', 'Zara', 'Kai', 'Ines', 'Theo', 'Priya', 'Mateo', 'Yuki', 'Omar', 'Lena', 'Ravi', 'Chloe', 'Jonas', 'Amara', 'Felix', 'Sofia', 'Hugo'];
    const last = ['Tan', 'Okafor', 'Novak', 'Silva', 'Kim', 'Lindqvist', 'Haddad', 'Chen', 'Moreau', 'Patel', 'Reyes', 'Nguyen'];
    names = Array.from({ length: 60 }, (_, i) => `${first[i % first.length]} ${last[Math.floor(i / first.length) + galleryOffset]}`);
    renderGallery();
  }
  let galleryOffset = 0;
  $('name').oninput = renderHero;
  $('seed-mode').onchange = renderHero;
  $('shuffle').onclick = () => { $('name').value = crypto.randomUUID(); renderHero(); };
  $('shuffle-gallery').onclick = () => { galleryOffset = (galleryOffset + 3) % 9; shuffleGallery(); };
  $('darkbg').onchange = () => { renderHero(); renderGallery(); };
  $('theme').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('theme').textContent = dark ? 'Light page' : 'Dark page';
    $('darkbg').checked = dark; renderHero(); renderGallery();
  };
  $('reset').onclick = () => { traits = {}; colors = {}; syncControls(); renderHero(); };
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(current.svg); status('SVG copied.'); }
    catch { status('Clipboard unavailable. Use Download SVG instead.', true); }
  };
  $('download').onclick = () => {
    const url = URL.createObjectURL(new Blob([current.svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a'); link.href = url; link.download = 'monster-avatar.svg'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('export').onclick = () => {
    $('configuration').value = JSON.stringify(current.config, null, 2);
    $('configuration').closest('details').open = true; status('Configuration ready to copy and save.');
  };
  $('import').onclick = () => {
    try {
      const restored = restoreAvatar(JSON.parse($('configuration').value));
      const config = restored.config;
      $('name').value = config.seed; $('seed-mode').value = config.seedMode; $('darkbg').checked = config.theme === 'dark';
      traits = config.traits; colors = config.colors; syncControls(); renderHero(); renderGallery(); status('Configuration restored.');
    } catch (error) { status(`Could not import: ${error.message}`, true); }
  };
  shuffleGallery(); renderHero();
})();
