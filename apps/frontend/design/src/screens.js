/*
 * Wanderlore — "The game table" mockups. Every screen is built from the same
 * helpers, so an object looks the same wherever it appears.
 * screen.html#<id> renders one screen; #<id>-dark renders it at night.
 */

/* ---------- Icons ---------- */
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-back" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></symbol>
<symbol id="i-next" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
<symbol id="i-speaker" viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/></symbol>
<symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3"/></symbol>
<symbol id="i-send" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
<symbol id="i-reroll" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M2 5h7a3 3 0 013 3v12a2 2 0 00-2-2H2z"/><path d="M22 5h-7a3 3 0 00-3 3v12a2 2 0 012-2h8z"/></symbol>
<symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></symbol>
<symbol id="i-out" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>
</svg>`;
const ic = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;

/* ---------- Objects ---------- */
const pips = (cur, max, big = false) =>
  `<span class="pips${big ? ' big' : ''}" role="img" aria-label="Hit points: ${cur} of ${max}">${Array.from(
    { length: max },
    (_, i) => `<i class="pip${i < cur ? '' : ' lost'}"></i>`,
  ).join('')}</span>`;
const hp = (cur, max, big) => `<span class="hp">${pips(cur, max, big)}<span class="hp-val">${cur} / ${max}</span></span>`;
const stamp = (text, kind = 'ok') => `<span class="stamp ${kind}">${text}</span>`;
const place = (a, b) => `<div class="place"><b>${a}</b><span>${b}</span></div>`;

/** A ten-sided die seen from above: kite faces, the number on the top face. */
const d10 = (v, big = false) => `<svg class="d10${big ? ' big' : ''}" viewBox="0 0 64 68" aria-hidden="true">
<g style="stroke:var(--die-line);stroke-width:1.2;stroke-linejoin:round">
<path d="M32 3L4 27L17 31Z" style="fill:var(--die-side)"/>
<path d="M32 3L60 27L47 31Z" style="fill:var(--die-dark)"/>
<path d="M4 27L10 45L32 65L32 46L17 31Z" style="fill:var(--die-side)"/>
<path d="M60 27L54 45L32 65L32 46L47 31Z" style="fill:var(--die-dark)"/>
<path d="M32 3L47 31L32 46L17 31Z" style="fill:var(--die)"/>
</g>${v === null ? '' : `<text x="32" y="29" text-anchor="middle" dominant-baseline="middle">${v}</text>`}</svg>`;
const die = (v, label, big) => `<div class="die">${d10(v, big)}<span class="label">${label}</span></div>`;
const PIPS6 = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const d6 = (v, aside = false) =>
  `<span class="d6${aside ? ' aside' : ''}" role="img" aria-label="${v}">${Array.from({ length: 9 }, (_, i) =>
    PIPS6[v].includes(i + 1) ? '<i></i>' : '<span></span>',
  ).join('')}</span>`;

/* ---------- Content ---------- */
const ARMAND = {
  name: 'Armand de Lisle',
  sub: 'Gascon gentleman · Male',
  stats: [['STR', 13], ['CON', 6], ['SIZ', 8], ['INT', 15], ['POW', 11], ['DEX', 16], ['CHA', 14]],
  skills: [
    ['Combat', [['Swordsmanship', 55], ['Marksmanship', 30]]],
    ['Communication', [['Persuasion', 45], ['Etiquette', 35], ['Deception', 25]]],
    ['Manipulation', [['First Aid', 30]]],
    ['Perception', [['Observation', 40]]],
    ['Physical', [['Athletics', 45], ['Dodge', 42], ['Stealth', 30]]],
  ],
};
const ELEANOR = {
  name: 'Eleanor Marsh',
  sub: 'Journalist · Female',
  stats: [['STR', 10], ['CON', 12], ['SIZ', 11], ['INT', 17], ['POW', 14], ['DEX', 12], ['CHA', 13]],
  skills: [
    ['Communication', [['Persuasion', 50], ['Deception', 30]]],
    ['Mental', [['Occultism', 25], ['Scholarship', 55]]],
    ['Perception', [['Observation', 60]]],
    ['Physical', [['Athletics', 30], ['Dodge', 34]]],
  ],
};
const stats = (c) =>
  `<div class="stats">${c.stats.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
const skills = (c) =>
  `<div class="skills">${c.skills
    .map(([cat, list]) => `<div><h4>${cat}</h4>${list.map(([n, v]) => `<div class="lead">${n}<b>${v}%</b></div>`).join('')}</div>`)
    .join('')}</div>`;

const charTab = (cur = 11) => `
  <div class="who"><h2 class="h1">${ARMAND.name}</h2><p>${ARMAND.sub}</p></div>
  <div class="hpbox"><div class="top-row"><span class="label">Hit points</span><span class="hp-val">${cur} / 14</span></div>${pips(cur, 14, true)}</div>
  <div class="block"><span class="label">Characteristics</span>${stats(ARMAND)}</div>
  <div class="block"><span class="label">Skills</span>${skills(ARMAND)}</div>
  <div class="block"><span class="label">Resources</span><div class="lead">Purse<b>3</b></div></div>`;
const invTab = () => `
  <div class="who"><h2 class="h1">Inventory</h2></div>
  <ul class="items">
    <li><div class="top-row">Rapier ${stamp('Equipped', 'neutral')}</div><em>his father's old sword, long and a little out of fashion</em></li>
    <li><div class="top-row">Rope</div><em>a knotted rope with a small grapnel, for climbing a wall</em></li>
    <li><div class="top-row">Document</div><em>Tréville's hasty note: the seal is a gold signet with his arms, taken to the Hôtel de Laffemas, rue du Cherche-Midi</em></li>
  </ul>
  <div class="block"><span class="label">Resources</span><div class="lead">Purse<b>3</b></div></div>`;
const questTab = () => `
  <div class="who"><h2 class="h1">Quests</h2></div>
  <div class="quest"><h3 class="h3">Recover the stolen seal</h3>
  <p>Get into the Hôtel de Laffemas, find Monsieur de Tréville's seal, and come back out of the house with it: the seal is won only once it is out.</p></div>`;

/* ---------- The story ---------- */
const TURN1 = `<div class="turn">
  <p class="you">I step between the two guards and ask, as politely as my Gascon pride allows, who sent them.</p>
  <div class="rolls"><div class="roll"><span><b>Persuasion 45%</b> · Difficult · Advantage +10 · → 32% · rolled <b>27</b></span>${stamp('Success')}</div></div>
  <div class="narr"><p>The taller guard looks you up and down, as one weighs a horse he has no intention of buying. Then he laughs, and the laugh is not unkind. “Jussac sent us,” he says, “and Jussac will want to know why a Gascon is asking.”</p>
  <p>Behind him a door opens on candlelight and the smell of wine. Someone inside has stopped talking.</p></div>
</div>`;
const LUNGE = `<p class="you">I draw my rapier and lunge at Jussac before he can call for help.</p>`;
const TURN2 = `<div class="turn">${LUNGE}
  <div class="rolls">
    <div class="roll"><span><b>Attack on Jussac</b> · Swordsmanship 55% · → 55% · rolled <b>18</b></span>${stamp('Success · Hit')}
      <span class="dmg">Damage 6 · Damage modifier +2 · → <b>8 dealt</b></span></div>
    <div class="roll ko"><span><b>Parry against Jussac</b> · Swordsmanship 55% · → 55% · rolled <b>71</b></span>${stamp('Failure · Blow taken', 'ko')}</div>
  </div>
  <div class="narr"><p>Your blade finds his shoulder before his own is clear of the scabbard. Jussac curses, gives ground, then answers with a cut you see too late: it opens your sleeve and the arm beneath it.</p></div>
  <div class="fxs"><span class="fx hpfx">−3 HP</span></div>
</div>`;
const LISTEN = `<p class="you">I follow the sound of voices to the door and listen.</p>`;

/* ---------- Game screen ---------- */
const slip = (locked) =>
  locked
    ? `<div class="slip locked">${ic('lock')}<span class="field">The game master is answering…</span><button class="icon-btn ghost" disabled aria-label="Dictate your action">${ic('mic')}</button><button class="send" disabled aria-label="Send">${ic('send')}</button></div>`
    : `<div class="slip"><span class="field">What do you do?</span><button class="icon-btn ghost" aria-label="Dictate your action">${ic('mic')}</button><button class="send" aria-label="Send">${ic('send')}</button></div>`;
const lastRoll = (t, u, what) =>
  `<div class="lastroll"><div class="dice">${die(t, 'Tens')}${die(u, 'Units')}</div>${what ? `<div class="what">${what}</div>` : ''}</div>`;
const BUILDER = `<div class="card builder">
  <h3 class="h3">Attack on Jussac</h3>
  <div class="line"><span>Swordsmanship</span><b>55%</b></div>
  <div class="line"><span>Strong advantage</span><span class="plus">+20</span></div>
  <div class="total"><span class="label">Chance</span><b>→ 75%</b></div>
</div>`;

function game(o) {
  const cur = o.hp ?? 11;
  const tabs = ['Character', 'Inventory', 'Quests'];
  const active = o.tab ?? 'Character';
  const content = { Character: charTab(cur), Inventory: invTab(), Quests: questTab() }[active];
  let dock;
  if (o.dock === 'live' || o.dock === 'revealed') {
    const throwBlock =
      o.dock === 'live'
        ? `<div class="throw"><div class="dice">${die('?', 'Tens', true)}${die('?', 'Units', true)}</div><button class="btn primary block">Roll the dice</button></div>`
        : `<div class="throw"><div class="dice">${die(10, 'Tens', true)}${die(8, 'Units', true)}</div>
           <div class="result"><span class="rolled">rolled<b>18</b></span>${stamp('Success · Hit')}<span class="dmg">Damage 6 · Damage modifier +2 · → <b>8 dealt</b></span></div></div>`;
    dock = `<section class="dock tray live">${BUILDER}${throwBlock}${slip(true)}</section>`;
  } else if (o.dock === 'over') {
    dock = `<section class="dock tray over-dock"><div class="card over"><p>This game is over.</p><button class="btn outline">Back to Armand de Lisle</button></div></section>`;
  } else {
    dock = `<section class="dock tray">${o.last ?? lastRoll(null, null, '')}${slip(o.locked)}</section>`;
  }
  return `<div class="game${o.dock === 'live' || o.dock === 'revealed' ? ' is-live' : ''}">
  <div class="topbar">
    <div class="left"><a class="back" href="#">${ic('back')}Armand de Lisle</a>${hp(cur, 14)}</div>
    <div class="acts"><button class="icon-btn" aria-label="Read the story aloud">${ic('speaker')}</button><span class="chip">CP</span></div>
  </div>
  <header class="hero">
    <span class="tab">Character sheet</span>
    <div class="under u2"></div><div class="under u1"></div>
    <div class="card">
      <div class="row1"><button class="icon-btn ghost" aria-label="Character page">${ic('back')}</button><span class="name">Armand de Lisle</span>
      <button class="icon-btn ghost" aria-label="Read the story aloud">${ic('speaker')}</button><span class="chip">CP</span></div>
      <div class="row2"><span class="label">Hit points</span>${hp(cur, 14)}</div>
    </div>
  </header>
  <main class="board">${place(o.place ?? 'Hôtel de Laffemas · Paris — Dusk', 'The Three Musketeers · The Stolen Seal')}
    <div class="sheet"><div class="scroll" data-bottom><div class="story">${o.story}</div></div></div>
  </main>
  ${dock}
  ${o.sheet ? '<div class="scrim mobile-only"></div>' : ''}
  <aside class="stack" aria-label="Character sheet">
    <div class="tabs" role="tablist">${tabs.map((t) => `<span class="tab${t === active ? ' on' : ''}" role="tab">${t}</span>`).join('')}
      <button class="icon-btn close" aria-label="Close">${ic('x')}</button></div>
    <div class="cards"><div class="under u2"></div><div class="under u1"></div><section class="card top">${content}</section></div>
  </aside>
</div>`;
}

/* ---------- Outside a game ---------- */
const appTop = (menu = false) => `<div class="apptop"><a class="wordmark" href="#">Wanderlore</a><span class="chip">CP</span>${
  menu
    ? `<div class="menu"><div class="who2">player@wanderlore.test</div><button>${ic('gear')}Preferences</button><button>${ic('out')}Sign out</button></div>`
    : ''
}</div>`;
const CREDIT = `<p class="credit">Powered by BRP — Basic Roleplaying © 2023 Chaosium Inc., under the ORC License.</p>`;

const home = (menu = false) => `<div class="app">${appTop(menu)}
  <section class="section"><header><h1 class="h1">My characters</h1></header>
    <div class="grid2">
      <article class="char"><span class="tab on">The Three Musketeers</span><div class="card">
        <div class="head"><div><h2 class="name">Armand de Lisle</h2><p class="prof">Gascon gentleman</p></div><button class="icon-btn ghost" aria-label="Character page">${ic('next')}</button></div>
        <div class="playing"><div class="row"><span class="label">Playing</span>${hp(11, 14)}</div>
          <div class="row">${place('The Stolen Seal', "The Guards' House")}<button class="btn primary">Continue</button></div></div>
      </div></article>
      <article class="char"><span class="tab on">The Lovecraft Mythos</span><div class="card">
        <div class="head"><div><h2 class="name">Eleanor Marsh</h2><p class="prof">Journalist</p></div><button class="icon-btn ghost" aria-label="Character page">${ic('next')}</button></div>
      </div></article>
    </div>
  </section>
  <section class="section"><header><h2 class="h2">Worlds</h2><p class="lede">Create a character in one of these worlds, then choose a story for them.</p></header>
    <div class="grid2">
      <article class="lid"><div class="inner"><h3 class="title">The Three Musketeers</h3><span class="rule"></span><p class="lede">Paris, 1625. Swords drawn for the King, intrigues for the Cardinal.</p><button class="btn outline">Create a character</button></div></article>
      <article class="lid"><div class="inner"><h3 class="title">The Lovecraft Mythos</h3><span class="rule"></span><p class="lede">New England, 1927. Fog off the sea, old houses, things that should stay buried.</p><button class="btn outline">Create a character</button></div></article>
    </div>
  </section>
  ${CREDIT}
</div>`;

const sheetCard = (c, world, hpTotal) => `<article class="char"><span class="tab on">${world}</span><div class="card sheetcard">
  <div class="who"><h1 class="h1">${c.name}</h1><p>${c.sub}</p></div>
  <div class="block"><div class="lead">Hit points<b>${hpTotal}</b></div></div>
  <div class="block"><span class="label">Characteristics</span>${stats(c)}</div>
  <div class="block"><span class="label">Skills</span>${skills(c)}</div>
</div></article>`;

const eleanorPage = () => `<div class="app">${appTop()}
  <a class="back" href="#">${ic('back')}My characters</a>
  <div class="charpage">
    ${sheetCard(ELEANOR, 'The Lovecraft Mythos', 23)}
    <div class="section" style="gap:28px">
      <section class="section"><h2 class="h2">Scenarios</h2>
        <article class="card scen"><div class="head"><h3 class="h3">The Ward Inheritance</h3></div>
          <p>New England, 1927. A letter from an Arkham attorney informs you that you are the last of the Wards, and heir to Ward House, a shuttered mansion on a lonely hill…</p>
          <div class="act"><button class="btn primary">Play</button></div></article>
        <article class="card scen"><div class="head"><h3 class="h3">The Wreck of the Sovereign</h3>${stamp('Failed — try again', 'ko')}</div>
          <p>A schooner run aground off Innsmouth, a crew nobody will name, and a cargo the sea keeps giving back.</p>
          <div class="act"><button class="btn primary">Play</button></div></article>
      </section>
      <section class="section"><h2 class="h2">Past games</h2>
        <ul class="past"><li><div class="t"><b>The Wreck of the Sovereign</b><span>Ended 3 days ago</span></div>${stamp('Failed', 'ko')}
          <div class="acts"><button class="btn outline small">${ic('book')}Read</button><button class="icon-btn" aria-label="Delete the game of The Wreck of the Sovereign">${ic('trash')}</button></div></li></ul>
      </section>
      <div><button class="btn text danger-text">${ic('trash')}Delete this character</button></div>
    </div>
  </div>
</div>`;

const armandPage = () => `<div class="app">${appTop()}
  <a class="back" href="#">${ic('back')}My characters</a>
  <div class="charpage">
    ${sheetCard(ARMAND, 'The Three Musketeers', 14)}
    <div class="section" style="gap:28px">
      <section class="section"><h2 class="h2">Current game</h2>
        <div class="card scen"><div class="playing" style="background:none;border:0;padding:0">
          <div class="row"><span class="label">Playing</span>${hp(11, 14)}</div>
          <div class="row">${place('The Stolen Seal', "The Guards' House")}</div>
          <div class="row" style="justify-content:flex-end"><button class="btn outline">Abandon</button><button class="btn primary">Continue</button></div></div></div>
      </section>
      <section class="section"><h2 class="h2">Scenarios</h2>
        <article class="card scen"><div class="head"><h3 class="h3">The Grain Road</h3></div>
          <p>La Rochelle, 1627. A village on the road to the siege, a convoy of grain that never arrived, and a miller who knows more than he says.</p>
          <div class="act"><button class="btn primary" disabled>Play</button></div></article>
      </section>
    </div>
  </div>
</div>`;

/* ---------- Creation ---------- */
const STEPS = ['Dice', 'Characteristics', 'Profession', 'Skills', 'Identity'];
const creation = (n, body, last = false) => `<div class="app"><div class="createwrap section" style="gap:22px">
  <a class="back" href="#">${ic('back')}My characters</a>
  <header><h1 class="h1">Create a character</h1><p class="lede">The Three Musketeers</p></header>
  <div>
    <nav class="steps" aria-label="Steps of the creation">${STEPS.map(
      (s, i) =>
        `<span class="step${i < n ? ' done' : i === n ? ' now' : ''}"><span class="n">${i < n ? ic('check') : i + 1}</span><span class="t">${s}</span></span>`,
    ).join('')}</nav>
    <section class="sheet creation">${body}
      <div class="foot"><button class="btn outline"${n === 0 ? ' disabled' : ''}>Back</button><button class="btn primary">${last ? 'Create' : 'Next'}</button></div>
    </section>
  </div>
</div></div>`;

const ROWS = [[5, 4, 4, 1], [2, 2, 2, 1], [4, 3, 1, 1], [6, 5, 4, 3], [5, 3, 3, 2], [6, 6, 4, 1], [6, 5, 3, 2]];
const c1 = () =>
  creation(
    0,
    `<p class="intro">Seven times four six-sided dice, the best three kept: one result for each characteristic. Roll again as often as you like.</p>
  <div class="tray rows">${ROWS.map(
    (r) => `<div class="drow">${r.map((v, i) => d6(v, i === 3)).join('')}<span class="eq"><small>=</small>${r[0] + r[1] + r[2]}</span></div>`,
  ).join('')}</div>
  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"><button class="btn outline">${ic('reroll')}Reroll</button><small class="subtle">A new roll replaces every result and clears their placement.</small></div>`,
  );

const PLACED = [['Strength', 'STR', 13], ['Constitution', 'CON', 6], ['Size', 'SIZ', 8], ['Intelligence', 'INT', 15], ['Power', 'POW', 11], ['Dexterity', 'DEX', 16], ['Charisma', 'CHA', null]];
const c2 = () =>
  creation(
    1,
    `<p class="intro">Give each result to a characteristic, each result once. Drag a result onto a characteristic, or pick it in the list.</p>
  <div class="placement">
    <div class="block"><span class="label">Your results</span><div class="tokens">${[13, 6, 8, 15, 11, 16, 14]
      .map((v) => `<span class="token${v === 14 ? '' : ' used'}">${v}</span>`)
      .join('')}</div>
      <p class="subtle" style="font-size:13px;line-height:1.5">Size and Intelligence never go below 8: a lower result placed there is raised.</p>
      <div class="lead" style="font-weight:600">Hit points<b>14</b></div></div>
    <div class="slots">${PLACED.map(
      ([n, a, v]) => `<div class="slot"><span class="nm"><b>${n}</b><small>${a}</small></span><span class="socket">${v ? `<span class="token">${v}</span>` : ''}</span></div>`,
    ).join('')}</div>
  </div>`,
  );

const PROFS = [
  ['Musketeer', "A soldier of the King's Musketeers under Monsieur de Tréville: a duellist, proud of the blue tabard.", 'Swordsmanship, Marksmanship, Athletics, Dodge, Intimidation, Etiquette, First Aid', "Rapier (equipped), Musketeer's tabard (equipped), Purse 10"],
  ["Cardinal's Guard", "A guardsman of His Eminence the Cardinal: disciplined, well paid, and the Musketeers' sworn rival.", 'Swordsmanship, Marksmanship, Athletics, Dodge, Intimidation, Observation, Etiquette', 'Rapier (equipped), Buff coat (equipped), Purse 15'],
  ['Gascon gentleman', 'A younger son of the minor nobility of Gascony, come to Paris with a sword, a temper and an empty purse.', 'Swordsmanship, Athletics, Dodge, Persuasion, Deception, Etiquette, Stealth', 'Rapier (equipped), Purse 3'],
  ['Valet', 'A servant to a gentleman of the sword: resourceful, discreet, and the one who finds supper when there is none.', 'Stealth, Observation, Deception, Persuasion, Athletics, Dodge, First Aid', 'Dagger, Purse 2'],
];
const c3 = () =>
  creation(
    2,
    `<p class="intro">What your character does for a living. Its skills get the professional points.</p>
  <div class="profs">${PROFS.map(
    ([n, d, s, k]) => `<article class="card profcard${n === 'Gascon gentleman' ? ' sel' : ''}"><span class="pick">${n === 'Gascon gentleman' ? ic('check') : ''}</span>
      <h3 class="h3">${n}</h3><p>${d}</p><div class="meta"><b>Skills:</b> ${s}</div><div class="meta"><b>Starts with:</b> ${k}</div></article>`,
  ).join('')}</div>`,
  );

const stepper = (label, v) =>
  `<span class="stepper"><span>${label}</span><button aria-label="Fewer">${ic('minus')}</button><output>${v}</output><button aria-label="More">${ic('plus')}</button></span>`;
const skRow = (n, base, prof, pers, tot) =>
  `<div class="sk"><span class="nm"><b>${n}</b><small>${base}</small></span><span class="steps2">${prof === null ? '' : stepper('Prof.', prof)}${stepper('Pers.', pers)}</span><span class="tot">${tot}%</span></div>`;
const counters = (left, total, cls = '') =>
  `<span class="counters ${cls}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round((left / total) * 10) ? '' : 'spent'}"></i>`).join('')}</span>`;
const c4 = () =>
  creation(
    3,
    `<p class="intro">Spend the professional points on the skills of the profession, the personal points on any skill.</p>
  <div class="skillsplit">
    <div class="block">
      <div class="pools">
        <div class="card pool"><span class="label">Professional points</span><div class="big">${counters(150, 300)}<b>150</b></div><small>150 left of 300</small></div>
        <div class="card pool"><span class="label">Personal points</span><div class="big">${counters(125, 150, 'pers')}<b>125</b></div><small>125 left of 150</small></div>
      </div>
      <p class="subtle" style="font-size:13px">No skill may go above 75% at creation.</p>
    </div>
    <div class="block" style="gap:22px">
      <div><span class="label">Skills of the profession</span>
        ${skRow('Swordsmanship', 'Base 25%', 30, 0, 55)}${skRow('Athletics', 'Base 25%', 20, 0, 45)}${skRow('Dodge', 'Base DEX ×2', 10, 0, 42)}
        ${skRow('Persuasion', 'Base 15%', 20, 10, 45)}${skRow('Deception', 'Base 5%', 20, 0, 25)}${skRow('Etiquette', 'Base 5%', 30, 0, 35)}${skRow('Stealth', 'Base 10%', 20, 0, 30)}</div>
      <div><span class="label">Combat</span>${skRow('Marksmanship', 'Base 30%', null, 0, 30)}</div>
      <div><span class="label">Manipulation</span>${skRow('First Aid', 'Base 30%', null, 0, 30)}</div>
      <div><span class="label">Perception</span>${skRow('Observation', 'Base 25%', null, 15, 40)}</div>
      <p class="muted" style="font-size:13.5px">275 points unspent: you can still go on.</p>
    </div>
  </div>`,
  );

const c5 = () =>
  creation(
    4,
    `<div class="identity">
    <div class="block" style="gap:18px">
      <label class="field-block"><span>Name</span><span class="input">Armand de Lisle</span><small class="subtle" style="align-self:flex-end;font-size:12px">15 / 35</small></label>
      <div class="field-block"><span>Gender</span><div class="seg"><button>Female</button><button class="on">Male</button><button>Neutral</button></div></div>
    </div>
    <div class="block"><span class="label">Your character</span>
      <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:16px">
        <div class="who"><h2 class="h1">Armand de Lisle</h2><p>Gascon gentleman · Male</p></div>
        <div class="hpbox"><div class="top-row"><span class="label">Hit points</span><span class="hp-val">14 / 14</span></div>${pips(14, 14, true)}</div>
        ${stats(ARMAND)}
        <div>${[['Swordsmanship', 55], ['Athletics', 45], ['Persuasion', 45], ['Dodge', 42], ['Observation', 40], ['Etiquette', 35]]
          .map(([n, v]) => `<div class="lead">${n}<b>${v}%</b></div>`)
          .join('')}</div>
        <p class="muted" style="font-size:13.5px"><b style="color:var(--ink)">Starts with:</b> Rapier (equipped), Purse 3</p>
      </div>
    </div>
  </div>`,
    true,
  );

/* ---------- System ---------- */
const prefs = (reduced = false) => `<div class="prefs">
  <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h2 class="h2">Preferences</h2><p class="subtle" style="font-size:13px;margin-top:4px">Kept in this browser only.</p></div><button class="icon-btn" aria-label="Close">${ic('x')}</button></div>
  <div class="grp"><span class="label">Appearance</span><div class="opt" style="align-items:center"><b>Theme</b><div class="seg"><button class="on">Light</button><button>Dark</button><button>System</button></div></div></div>
  <div class="grp"><span class="label">Narration</span><div class="opt"><div><b>Read the story aloud</b><small>In your browser's own voice. The speaker button of a game does the same.</small></div><button class="toggle on" aria-label="Read the story aloud"></button></div></div>
  <div class="grp"><span class="label">Dice</span><div class="opt"><div><b>Roll the dice automatically</b><small>The dice roll as soon as the game master calls for them, without waiting for you.</small></div><button class="toggle" aria-label="Roll the dice automatically"></button></div></div>
  <div class="grp"><span class="label">Animations</span>
    ${reduced ? `<div class="sysnote">${ic('info')}<span>Your device asks for less motion: animations stay off.</span></div>` : ''}
    ${['Rolling dice', 'Story fading in', 'Hit point gauge']
      .map((a) => `<div class="opt${reduced ? ' off' : ''}" style="align-items:center"><b>${a}</b><button class="toggle${reduced ? '' : ' on'}"${reduced ? ' disabled' : ''} aria-label="${a}"></button></div>`)
      .join('')}
  </div>
</div>`;

const lone = (body, dice = '') => `<div class="lone"><div class="app">${appTop()}<div class="card msg">${dice}${body}</div>${CREDIT}</div></div>`;

const signIn = () => `<div class="app" style="min-height:100dvh">
  <div class="signin">
    <span class="loose" style="left:-150px;top:120px;rotate:-14deg">${d10(7)}</span>
    <span class="loose" style="right:-130px;top:330px;rotate:18deg">${d10(30)}</span>
    <div class="brand"><span class="wordmark">Wanderlore</span><p class="lede">Your solo tabletop adventure, with a game master who never cancels.</p></div>
    <form class="card" onsubmit="return false">
      <label class="field-block"><span>Email</span><span class="input">player@wanderlore.test</span></label>
      <label class="field-block"><span>Password</span><span class="input">••••••••</span></label>
      <button class="btn primary block">Sign in</button>
    </form>
    ${CREDIT}
  </div>
</div>`;

/* ---------- Registry ---------- */
const SCREENS = {
  g1: () => game({ story: TURN1 + TURN2, last: lastRoll(70, 1, `<span><b>Parry against Jussac</b> · rolled 71</span>${stamp('Failure · Blow taken', 'ko')}`) }),
  g2: () => game({ hp: 14, story: TURN1 + `<div class="turn">${LUNGE}</div>`, dock: 'live' }),
  g3: () => game({ hp: 14, story: TURN1 + `<div class="turn">${LUNGE}</div>`, dock: 'revealed' }),
  g4: () => game({ story: TURN1 + TURN2, sheet: true, tab: 'Character', last: lastRoll(70, 1, `<span><b>Parry against Jussac</b> · rolled 71</span>${stamp('Failure · Blow taken', 'ko')}`) }),
  g4b: () => game({ story: TURN1 + TURN2, sheet: true, tab: 'Inventory', last: lastRoll(70, 1, `<span><b>Parry against Jussac</b> · rolled 71</span>${stamp('Failure · Blow taken', 'ko')}`) }),
  g4c: () => game({ story: TURN1 + TURN2, sheet: true, tab: 'Quests', last: lastRoll(70, 1, `<span><b>Parry against Jussac</b> · rolled 71</span>${stamp('Failure · Blow taken', 'ko')}`) }),
  g5: () =>
    game({
      hp: 14,
      locked: true,
      story: TURN1 + `<div class="turn">${LISTEN}<p class="pending">The game master weighs your action <span class="dots"><i></i><i></i><i></i></span></p></div>`,
      last: lastRoll(20, 7, `<span><b>Persuasion</b> · rolled 27</span>${stamp('Success')}`),
    }),
  g6: () =>
    game({
      hp: 14,
      story:
        TURN1 +
        `<div class="turn">${LISTEN}<div class="note"><p>The game master took too long to answer. Try your action again.</p><div class="row"><button class="btn primary small">Retry</button><button class="btn outline small">Edit</button></div></div></div>`,
      last: lastRoll(20, 7, `<span><b>Persuasion</b> · rolled 27</span>${stamp('Success')}`),
    }),
  g7: () =>
    game({
      hp: 14,
      place: 'Rue du Cherche-Midi · Paris — Dusk',
      story: `<div class="opening"><span class="label">The Three Musketeers · The Stolen Seal</span><h1 class="ch">The Guards' House</h1><span class="rule"></span>
        <p class="pending" style="font-size:17px;color:var(--ink-2)">Your story begins. What do you do?</p></div>`,
    }),
  g8: () =>
    game({
      hp: 7,
      dock: 'over',
      story:
        TURN1 +
        `<div class="turn"><p class="you">I leap from the window into the courtyard, the seal in my fist.</p>
        <div class="rolls"><div class="roll ko"><span><b>Athletics 45%</b> · Difficult · → 23% · rolled <b>88</b></span>${stamp('Failure', 'ko')}</div></div>
        <div class="narr"><p>The cobbles come up faster than you meant them to. When the world stops turning, there are boots all around you, and Jussac is smiling.</p></div>
        <div class="fxs"><span class="fx hpfx">−4 HP</span></div></div>`,
    }),
  s1: signIn,
  s2: () => home(),
  s3: eleanorPage,
  s3b: () =>
    armandPage() +
    `<div class="scrim"></div><div class="dialog" role="dialog"><h2 class="h2">Abandon this scenario?</h2>
    <p>The Stolen Seal ends in failure: the game cannot be resumed. You can start the scenario again afterwards.</p>
    <div class="actions"><button class="btn outline">Keep playing</button><button class="btn danger">Abandon</button></div></div>`,
  c1,
  c2,
  c3,
  c4,
  c5,
  s4: () => home() + `<div class="scrim"></div><div class="dialog sheetlike" role="dialog">${prefs()}</div>`,
  s4b: () => home() + `<div class="scrim"></div><div class="dialog sheetlike" role="dialog">${prefs(true)}</div>`,
  s5: () => home(true),
  s6: () =>
    lone(
      `<h1 class="h2">This page does not exist.</h1><button class="btn primary">My characters</button>`,
      `<div class="dice" style="gap:10px">${d10('00')}${d10(0)}</div>`,
    ),
  s7: () => lone(`<h1 class="h2">Something went wrong.</h1><button class="btn primary">${ic('reroll')}Reload</button>`),
};

function render() {
  const raw = (location.hash || '#g1').slice(1);
  const dark = raw.endsWith('-dark');
  const id = dark ? raw.slice(0, -5) : raw;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const make = SCREENS[id] ?? SCREENS.g1;
  document.body.classList.toggle('sheet-open', ['g4', 'g4b', 'g4c'].includes(id));
  document.getElementById('app').innerHTML = make();
  document.querySelectorAll('[data-bottom]').forEach((s) => (s.scrollTop = s.scrollHeight));
}
document.body.insertAdjacentHTML('afterbegin', SPRITE);
render();
window.addEventListener('hashchange', render);
