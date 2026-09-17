/* Arc Predict - app logic (vanilla JS, hash routing) */
"use strict";

/* ---------------- helpers ---------------- */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const ARC = window.ARC;
const MK = ARC.markets;
const bySlug = Object.fromEntries(MK.map((m) => [m.slug, m]));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtUSD = (v) => {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + Math.round(v);
};
const fmtN = (v) => v.toLocaleString("en-US");
const cents = (m) => m.c + "\u00A2";
const endDate = (m) => new Date(m.end + "T12:00:00Z");
const endLabel = (m) => endDate(m).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysLeft = (m) => Math.max(0, Math.round((endDate(m) - Date.now()) / 86400000));
function endsIn(m) {
  const d = daysLeft(m);
  if (d <= 1) return "Ends tomorrow";
  if (d < 45) return "Ends in " + d + "d";
  return "Ends " + endLabel(m);
}
function timeAgo(t) {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}
const catLabel = (k) => (ARC.cats[k] ? ARC.cats[k].label : k);
const avatarHTML = (name, cls) => `<span class="${cls || "f-ava"}">${esc(name[0].toUpperCase())}</span>`;
function randAddr() {
  const hex = "0123456789abcdef";
  let a = "0x";
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}
const short = (a) => a.slice(0, 6) + "\u2026" + a.slice(-4);

/* ---------------- wallet ---------------- */
const Wallet = {
  state: null,
  load() {
    try { this.state = JSON.parse(localStorage.getItem("arc_wallet") || "null"); } catch (e) { this.state = null; }
    this.render();
  },
  save() { localStorage.setItem("arc_wallet", JSON.stringify(this.state)); this.render(); },
  connect(provider) {
    // Real read-only connection when an injected provider exists; otherwise a
    // local session address is generated. No signatures are ever requested.
    const viaInject = provider === "metamask" && window.ethereum && window.ethereum.request;
    if (viaInject) {
      return window.ethereum.request({ method: "eth_requestAccounts" }).then((accs) => {
        const addr = accs && accs[0] ? accs[0] : randAddr();
        this.finish(addr, "MetaMask");
      }).catch(() => this.simulate(provider));
    }
    return this.simulate(provider);
  },
  simulate(provider) {
    return new Promise((res) => setTimeout(() => { this.finish(randAddr(), provider); res(); }, 1300));
  },
  finish(addr, provider) {
    const rnd = Math.random();
    this.state = { addr, provider, balance: Math.round((400 + rnd * 24000) * 100) / 100 };
    this.save();
    toast("Wallet connected - " + short(addr));
    if (location.hash.startsWith("#/market/")) Views.refreshTradePanel();
  },
  disconnect() { this.state = null; localStorage.removeItem("arc_wallet"); this.render(); toast("Wallet disconnected"); },
  render() {
    const btn = $("#connect-btn"), chip = $("#wallet-chip"), menu = $("#wallet-menu");
    if (this.state) {
      btn.hidden = true;
      chip.hidden = false;
      $(".w-addr", chip).textContent = short(this.state.addr);
    } else {
      btn.hidden = false;
      chip.hidden = true;
      menu.hidden = true;
    }
  },
};

$("#connect-btn").addEventListener("click", openWalletModal);
$("#wallet-chip").addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = $("#wallet-menu");
  if (!menu.hidden) { menu.hidden = true; return; }
  const w = Wallet.state;
  menu.innerHTML = `
    <div class="wm-addr">
      <span class="w-ava"></span>
      <code>${short(w.addr)}</code>
      <button class="wm-copy" data-act="copy" title="Copy address">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>
      </button>
    </div>
    <div class="wm-row"><span>USDC balance</span><b>$${w.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
    <div class="wm-row"><span>Open positions</span><b>0</b></div>
    <div class="wm-row"><span>Network</span><span class="wm-net"><span class="net-dot"></span>Arc</span></div>
    <div class="wm-actions">
      <button class="btn btn-ghost" data-act="portfolio">Portfolio</button>
      <button class="btn btn-ghost" data-act="disconnect" style="color:var(--red)">Disconnect</button>
    </div>`;
  menu.hidden = false;
});
document.addEventListener("click", (e) => {
  const menu = $("#wallet-menu");
  if (menu && !menu.hidden && !menu.contains(e.target) && !$("#wallet-chip").contains(e.target)) menu.hidden = true;
  const act = e.target.closest("[data-act]");
  if (!act) return;
  const a = act.dataset.act;
  if (a === "copy") { navigator.clipboard && navigator.clipboard.writeText(Wallet.state.addr); toast("Address copied"); }
  if (a === "disconnect") { Wallet.disconnect(); }
  if (a === "portfolio") { $("#wallet-menu").hidden = true; openPortfolio(); }
});

function openPortfolio() {
  const w = Wallet.state;
  openModal(`
    <div class="modal-head"><h3>Portfolio</h3><button class="modal-x" data-close>x</button></div>
    <div class="modal-sub">${short(w.addr)} on Arc</div>
    <div class="modal-body">
      <div class="tp-rows" style="border-top:0;padding-top:2px">
        <div class="tp-row"><span>Cash balance</span><b>$${w.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</b></div>
        <div class="tp-row"><span>Position value</span><b>$0.00</b></div>
        <div class="tp-row"><span>Unrealized PnL</span><b>$0.00</b></div>
      </div>
      <div class="tp-msg tp-ok"><b>You have no open positions</b>Markets you enter will appear here with live mark to market values.</div>
    </div>`);
}

const WALLET_OPTS = [
  { id: "metamask", name: "MetaMask", sub: "Browser extension", bg: "#F6851B", letter: "M" },
  { id: "coinbase", name: "Coinbase Wallet", sub: "Mobile and extension", bg: "#1652F0", letter: "C" },
  { id: "walletconnect", name: "WalletConnect", sub: "Scan with any mobile wallet", bg: "#3B99FC", letter: "W" },
  { id: "phantom", name: "Phantom", sub: "Solana and EVM", bg: "#4a4238", letter: "P" },
];

function openWalletModal() {
  openModal(`
    <div class="modal-head"><h3>Connect wallet</h3><button class="modal-x" data-close>x</button></div>
    <div class="modal-sub">Select a wallet to browse Arc Predict with your address.</div>
    <div class="modal-body">
      ${WALLET_OPTS.map((w) => `
      <button class="w-opt" data-w="${w.id}">
        <span class="ic" style="background:${w.bg}">${w.letter}</span>
        <span>${w.name}<span class="sub">${w.id === "metamask" && window.ethereum ? "Detected" : w.sub}</span></span>
        ${w.id === "metamask" && window.ethereum ? '<span class="badge">Detected</span>' : '<span class="arr">›</span>'}
      </button>`).join("")}
    </div>
    <div class="modal-foot">By connecting a wallet you agree to the <a href="#">terms of use</a>.</div>`);
  $$("#modal-root .w-opt").forEach((b) => b.addEventListener("click", () => startConnect(b.dataset.w)));
}

function startConnect(provider) {
  const opt = WALLET_OPTS.find((w) => w.id === provider);
  const body = $("#modal-root .modal");
  body.innerHTML = `
    <div class="connecting">
      <div class="spinner"></div>
      <div class="nm">Connecting to ${opt.name}</div>
      <div class="st">Confirm the request in your wallet</div>
    </div>`;
  Wallet.connect(provider).catch(() => {});
}

/* ---------------- modal & toast ---------------- */
function openModal(html) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-back"><div class="modal">${html}</div></div>`;
  $(".modal-back", root).addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(); });
  $$("[data-close]", root).forEach((b) => b.addEventListener("click", closeModal));
}
function closeModal() { $("#modal-root").innerHTML = ""; }
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="dot"></span>${esc(msg)}`;
  $("#toast-root").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 2600);
}

/* ---------------- live feed engine ---------------- */
const Feed = {
  listeners: [],
  recent: [],
  on(fn) { this.listeners.push(fn); },
  off(fn) { this.listeners = this.listeners.filter((f) => f !== fn); },
  emit(ev) {
    this.recent.unshift(ev);
    if (this.recent.length > 40) this.recent.pop();
    this.listeners.forEach((fn) => fn(ev));
  },
  make() {
    const m = MK[Math.floor(Math.pow(Math.random(), 1.6) * MK.length)];
    const yes = Math.random() < m.c / 100 * 0.9 + 0.05;
    return {
      m: m.slug, yes,
      amt: Math.round((90 + Math.pow(Math.random(), 2.4) * 26000) / 10) * 10,
      name: ARC.names[Math.floor(Math.random() * ARC.names.length)],
      t: Date.now(),
    };
  },
  start() {
    const tick = () => {
      this.emit(this.make());
      this.timer = setTimeout(tick, 1800 + Math.random() * 2600);
    };
    if (!this.timer) tick();
  },
};
Feed.start();

function renderTickItem(ev) {
  const m = bySlug[ev.m];
  const el = document.createElement("div");
  el.className = "tick-item";
  el.innerHTML = `<b>${esc(ev.name)}</b><span class="t-side ${ev.yes ? "yes" : "no"}">${ev.yes ? "Yes" : "No"}</span><span class="t-amt">${fmtUSD(ev.amt)}</span><span>${esc(m.q.length > 34 ? m.q.slice(0, 34) + "\u2026" : m.q)}</span>`;
  return el;
}

function startTicker() {
  const track = $("#tk-track");
  const seeds = ARC.feed.slice(0, 9).map((f) => ({ ...f, t: Date.now() - f.t * 1000 }));
  seeds.forEach((s) => track.appendChild(renderTickItem(s)));
  const onEv = (ev) => {
    track.prepend(renderTickItem(ev));
    while (track.children.length > 10) track.lastChild.remove();
  };
  Feed.on(onEv);
  cleanupFns.push(() => Feed.off(onEv));
}

/* ---------------- odds drift (simulated price movement) ---------------- */
const Drift = {
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      for (let i = 0; i < 6; i++) {
        const m = MK[Math.floor(Math.random() * MK.length)];
        const d = Math.random() < 0.5 ? -1 : 1;
        m.c = Math.min(97, Math.max(3, m.c + d));
        m.hist.push(Math.round(m.c * 10));
        m.change = +(m.hist[m.hist.length - 1] - m.hist[m.hist.length - 9]) / 10;
        $$(`[data-price="${m.slug}"]`).forEach((el) => {
          el.textContent = cents(m);
          const dEl = el.parentElement.querySelector(".delta");
          if (dEl) setDelta(dEl, m.change);
        });
      }
      if (Views.onDrift) Views.onDrift();
    }, 7000);
  },
};

function setDelta(el, change) {
  el.className = "delta " + (change >= 0 ? "up" : "down");
  el.textContent = (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
}

/* ---------------- canvas charts ---------------- */
function prepCanvas(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  cv.width = Math.max(10, r.width * dpr);
  cv.height = Math.max(10, r.height * dpr);
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

function drawSpark(cv, data) {
  const { ctx, w, h } = prepCanvas(cv);
  const step = w / (data.length - 1);
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [i * step, h - 3 - ((v - min) / span) * (h - 6)]);
  const up = data[data.length - 1] >= data[0];
  ctx.clearRect(0, 0, w, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, up ? "rgba(17,17,16,.16)" : "rgba(224,35,29,.16)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.strokeStyle = up ? "#111110" : "#E0231D";
  ctx.lineWidth = 1.6; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
}

function drawChart(cv, data, rangeDays) {
  const { ctx, w, h } = prepCanvas(cv);
  const padL = 40, padR = 12, padT = 14, padB = 24;
  const iw = w - padL - padR, ih = h - padT - padB;
  const min = Math.min(...data), max = Math.max(...data);
  const lo = Math.max(0, min - 4), hi = Math.min(100, max + 4), span = hi - lo || 1;
  const X = (i) => padL + (i / (data.length - 1)) * iw;
  const Y = (v) => padT + ih - ((v - lo) / span) * ih;
  ctx.clearRect(0, 0, w, h);

  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "right";
  for (let g = 0; g <= 4; g++) {
    const v = lo + (span * g) / 4;
    const y = Y(v);
    ctx.strokeStyle = "#eceae4";
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = "#9b968c";
    ctx.fillText(Math.round(v) + "\u00A2", padL - 8, y + 3.5);
  }
  ctx.textAlign = "center";
  const labels = rangeDays <= 1 ? 4 : rangeDays <= 8 ? 4 : 5;
  for (let i = 0; i <= labels; i++) {
    const frac = i / labels;
    const x = padL + frac * iw;
    const dt = new Date(Date.now() - (1 - frac) * rangeDays * 86400000);
    const lbl = rangeDays <= 1
      ? dt.toLocaleTimeString("en-US", { hour: "numeric" })
      : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    ctx.fillStyle = "#9b968c";
    ctx.fillText(lbl, Math.min(w - 26, Math.max(padL + 16, x)), h - 6);
  }
  const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
  grad.addColorStop(0, "rgba(17,17,16,.10)");
  grad.addColorStop(1, "rgba(17,17,16,0)");
  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(0), Y(v))));
  ctx.strokeStyle = "#111110"; ctx.lineWidth = 2; ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineTo(X(data.length - 1), padT + ih); ctx.lineTo(padL, padT + ih); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 4, 0, 7);
  ctx.fillStyle = "#E0231D"; ctx.fill();
  ctx.beginPath();
  ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 1.8, 0, 7);
  ctx.fillStyle = "#fff"; ctx.fill();

  return { X, Y, padL, padR, iw };
}

function bindChartHover(cv, data, rangeDays, tipEl) {
  const move = (e) => {
    const r = cv.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left - 40) / (r.width - 52)));
    const i = Math.round(frac * (data.length - 1));
    const v = data[i];
    const dt = new Date(Date.now() - (1 - i / (data.length - 1)) * rangeDays * 86400000);
    tipEl.style.display = "block";
    tipEl.style.left = (40 + frac * (r.width - 52)) + "px";
    tipEl.style.top = "38%";
    tipEl.innerHTML = `<b>${(v / 10).toFixed(1)}\u00A2</b> · ${dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };
  cv.addEventListener("mousemove", move);
  cv.addEventListener("mouseleave", () => { tipEl.style.display = "none"; });
}

/* ---------------- scroll effects ---------------- */
let cleanupFns = [];
function clearCleanup() { cleanupFns.forEach((f) => { try { f(); } catch (e) {} }); cleanupFns = []; }

let revealIO = null;
function getRevealIO() {
  if (!revealIO) {
    revealIO = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); revealIO.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
  }
  return revealIO;
}
function initReveals(container) {
  const els = $$(".reveal", container);
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = getRevealIO();
  els.forEach((e, i) => {
    if (e.classList.contains("in")) return;
    if (!e.style.getPropertyValue("--rd")) e.style.setProperty("--rd", (Math.min(i % 6, 5) * 0.06) + "s");
    io.observe(e);
  });
}

function initCountUps(container) {
  $$("[data-count]", container).forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const fmt = el.dataset.fmt || "int";
    const t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = target * e;
      if (fmt === "usd") el.textContent = fmtUSD(v);
      else el.textContent = fmtN(Math.round(v));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function initHeaderScroll() {
  const onScroll = () => $("#topbar").classList.toggle("scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------------- market card ---------------- */
function marketCard(m) {
  const hot = m.hot ? '<span class="cover-hot">Hot</span>' : "";
  const deltaCls = m.change >= 0 ? "up" : "down";
  const noC = 100 - m.c;
  return `
  <a class="m-card reveal" href="#/market/${m.slug}">
    <div class="m-cover">
      <img src="img/covers/${m.slug}.svg" alt="" loading="lazy">
      <span class="cover-chip">${catLabel(m.cat)}</span>${hot}
    </div>
    <div class="m-body">
      <h3 class="m-q">${esc(m.q)}</h3>
      <div class="m-meta"><span>Vol ${fmtUSD(m.volT)}</span><span>${endsIn(m)}</span></div>
      <div class="m-bar"><div class="m-fill" data-w="${m.c}"></div></div>
      <div class="m-foot">
        <div class="m-price">
          <span class="pct" data-price="${m.slug}">${cents(m)}</span>
          <span class="delta ${deltaCls}">${(m.change >= 0 ? "+" : "") + m.change.toFixed(1)}%</span>
        </div>
        <div class="m-btns">
          <button class="m-btn yes" data-side="yes" data-slug="${m.slug}">Yes <span class="c">${m.c}\u00A2</span></button>
          <button class="m-btn no" data-side="no" data-slug="${m.slug}">No <span class="c">${noC}\u00A2</span></button>
        </div>
      </div>
    </div>
  </a>`;
}

function bindCards(container) {
  $$(".m-btn", container).forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    location.hash = `#/market/${b.dataset.slug}?side=${b.dataset.side}`;
  }));
  const bars = $$(".m-fill", container);
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { en.target.style.width = en.target.dataset.w + "%"; io.unobserve(en.target); }
  }), { threshold: 0.3 });
  bars.forEach((b) => io.observe(b));
  cleanupFns.push(() => io.disconnect());
}

/* ---------------- views ---------------- */
const Views = {
  onDrift: null,

  home() {
    const top = [...MK].sort((a, b) => b.vol24 - a.vol24).slice(0, 8);
    const lp = top.slice(0, 4);
    $("#app").innerHTML = `
    <div class="wrap">
      <section class="hero">
        <div class="hero-grid">
          <div>
            <h1 class="reveal">The odds of<br>everything, <span class="hl">live.</span></h1>
            <p class="sub reveal">Arc Predict is the on-chain prediction market on the Arc network. Back your view with USDC, watch prices move in real time, and win when you're right.</p>
            <div class="hero-cta reveal">
              <a class="btn btn-ink" href="#markets-sec">Browse markets</a>
              <button class="btn btn-out" id="hero-connect">Connect wallet</button>
            </div>
            <div class="hero-stats reveal">
              <div class="hstat"><div class="n" data-count="${ARC.meta.totalVol}" data-fmt="usd">$0B</div><div class="l">Total volume</div></div>
              <div class="hstat"><div class="n" data-count="${ARC.meta.vol24}" data-fmt="usd">$0</div><div class="l">24h volume</div></div>
              <div class="hstat"><div class="n" data-count="${ARC.meta.traders}">0</div><div class="l">Traders</div></div>
              <div class="hstat"><div class="n">${MK.length}</div><div class="l">Markets live</div></div>
            </div>
          </div>
          <div class="live-panel reveal">
            <div class="lp-head"><b><span class="live-dot"></span>Moving markets</b><span class="meta">USDC · Arc</span></div>
            ${lp.map((m) => `
              <div class="lp-row" data-lp="${m.slug}">
                <div class="lp-mono">${catLabel(m.cat)[0]}</div>
                <div class="lp-main">
                  <div class="lp-q">${esc(m.q)}</div>
                  <div class="lp-bar"><div class="lp-fill" style="width:${m.c}%"></div></div>
                </div>
                <div class="lp-pct" data-price="${m.slug}">${cents(m)}</div>
              </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="feat-sec reveal">
        <div class="sec-head"><h2>Trending now</h2><a href="#activity">View activity</a></div>
        <div class="feat-scroll">
          ${top.map((m) => `
          <a class="f-card" href="#/market/${m.slug}">
            <div class="f-cover"><img src="img/covers/${m.slug}.svg" alt="" loading="lazy"><span class="cover-chip">${catLabel(m.cat)}</span>${m.hot ? '<span class="cover-hot">Hot</span>' : ""}</div>
            <div class="f-body">
              <div class="f-q">${esc(m.q)}</div>
              <div class="f-foot">
                <div class="f-vol">Vol ${fmtUSD(m.vol24)} (24h)<br>${endsIn(m)}</div>
                <div class="f-prob"><span class="p" data-price="${m.slug}">${cents(m)}</span><span class="d delta ${m.change >= 0 ? "up" : "down"}">${(m.change >= 0 ? "+" : "") + m.change.toFixed(1)}%</span></div>
              </div>
            </div>
          </a>`).join("")}
        </div>
      </section>

      <section id="markets-sec">
        <div class="page-head"><div><h1>All markets</h1><p>${MK.length} live markets across politics, crypto, sports and more.</p></div></div>
        <div class="filterbar" id="filterbar">
          <button class="chip on" data-cat="all">All</button>
          ${Object.entries(ARC.cats).map(([k, v]) => `<button class="chip" data-cat="${k}">${v.label}</button>`).join("")}
          <div class="fb-spacer"></div>
          <span class="fb-count" id="fb-count"></span>
          <select class="fb-sort" id="fb-sort">
            <option value="trending">Trending</option>
            <option value="volume">Volume</option>
            <option value="ending">Ending soon</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <div class="grid" id="grid"></div>
        <div class="grid-more" id="grid-more"></div>
      </section>

      <section class="how">
        <div class="sec-head"><h2>How it works</h2></div>
        <div class="how-grid">
          <div class="how-card reveal"><div class="how-num">1</div><h3>Pick an outcome</h3><p>Choose Yes or No on any market. Prices move between 1\u00A2 and 99\u00A2 with the crowd's view of the odds.</p></div>
          <div class="how-card reveal"><div class="how-num">2</div><h3>Trade with USDC</h3><p>Enter a position in seconds. Arc settles instantly and your shares are held on-chain in your own wallet.</p></div>
          <div class="how-card reveal"><div class="how-num">3</div><h3>Win on resolution</h3><p>When the event settles, every winning share pays $1.00. Payouts are automatic and verifiable on-chain.</p></div>
        </div>
      </section>

      <section class="split">
        <div class="panel reveal">
          <div class="panel-head"><span class="t"><span class="live-dot"></span><h2>Live activity</h2></span><a href="#/activity" style="font-size:13px;color:var(--red);font-weight:600">See all</a></div>
          <div id="home-feed"></div>
        </div>
        <div class="panel reveal">
          <div class="panel-head"><h2>Top traders this week</h2><a href="#/leaders" style="font-size:13px;color:var(--red);font-weight:600">Leaderboard</a></div>
          <div>
            ${ARC.leaders.slice(0, 7).map((l, i) => `
              <div class="lb-row">
                <span class="lb-rank">${i + 1}</span>
                ${avatarHTML(l[0])}
                <span class="lb-name">${esc(l[0])}<small>${l[3]} volume</small></span>
                <span class="lb-pnl">+${l[1]}%</span>
              </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="cta-band reveal">
        <div class="cta-in">
          <h2>Your view is worth something.</h2>
          <p>Join 418,000 traders turning opinions into prices on the Arc network.</p>
          <button class="btn btn-red" id="cta-connect">Connect wallet to start</button>
        </div>
      </section>
    </div>`;

    $("#hero-connect").addEventListener("click", () => (Wallet.state ? openPortfolio() : openWalletModal()));
    $("#cta-connect").addEventListener("click", () => (Wallet.state ? openPortfolio() : openWalletModal()));

    const state = { cat: "all", sort: "trending", q: "" };
    const grid = $("#grid"), more = $("#grid-more");
    let shown = 24;
    let io = null;

    const apply = () => {
      let list = MK.filter((m) => (state.cat === "all" || m.cat === state.cat) && (!state.q || m.q.toLowerCase().includes(state.q)));
      if (state.sort === "volume") list.sort((a, b) => b.vol24 - a.vol24);
      else if (state.sort === "ending") list.sort((a, b) => endDate(a) - endDate(b));
      else if (state.sort === "newest") list.sort((a, b) => b.start - a.start);
      else list.sort((a, b) => ((b.hot ? 1 : 0) + b.vol24 / 1e9) - ((a.hot ? 1 : 0) + a.vol24 / 1e9));
      return list;
    };
    const renderChunk = (reset) => {
      const list = apply();
      $("#fb-count").textContent = list.length + " markets";
      if (reset) { grid.innerHTML = ""; shown = 0; if (io) io.disconnect(); }
      const chunk = list.slice(shown, shown + 24);
      grid.insertAdjacentHTML("beforeend", chunk.map((m) => marketCard(m)).join(""));
      shown += chunk.length;
      bindCards(grid);
      initReveals(grid);
      more.innerHTML = shown < list.length
        ? '<button class="btn btn-out" id="load-more">Show more markets</button>'
        : list.length === 0 ? '<span style="color:var(--dim);font-size:14px">No markets match your search.</span>' : "";
      const lm = $("#load-more");
      if (lm) lm.addEventListener("click", () => renderChunk(false));
      if (io) io.disconnect();
      io = new IntersectionObserver((ents) => { if (ents[0].isIntersecting && shown < list.length) renderChunk(false); }, { rootMargin: "600px" });
      io.observe(more);
      cleanupFns.push(() => io && io.disconnect());
    };
    renderChunk(true);
    window.__gridRender = renderChunk;
    window.__gridState = state;

    $$(".chip[data-cat]").forEach((c) => c.addEventListener("click", () => {
      $$(".chip[data-cat]").forEach((x) => x.classList.remove("on"));
      c.classList.add("on");
      state.cat = c.dataset.cat;
      renderChunk(true);
    }));
    $("#fb-sort").addEventListener("change", (e) => { state.sort = e.target.value; renderChunk(true); });
    state.q = Filters.q;
    if (Filters.q && Filters.applyToGrid) Filters.applyToGrid();

    const hf = $("#home-feed");
    const rowHTML = (ev) => {
      const m = bySlug[ev.m];
      return `<div class="feed-row">
        ${avatarHTML(ev.name)}
        <span class="who"><b>${esc(ev.name)}</b></span>
        <span class="txt"><span class="t-side ${ev.yes ? "yes" : "no"}">${ev.yes ? "bought Yes" : "bought No"}</span> · <b>${fmtUSD(ev.amt)}</b> · ${esc(m.q.length > 44 ? m.q.slice(0, 44) + "\u2026" : m.q)}</span>
        <span class="when">${timeAgo(ev.t)}</span>
      </div>`;
    };
    const seeds = ARC.feed.slice(0, 8).map((f) => ({ ...f, t: Date.now() - f.t * 1000 }));
    hf.innerHTML = seeds.map(rowHTML).join("");
    const onEv = (ev) => { hf.insertAdjacentHTML("afterbegin", rowHTML(ev)); while (hf.children.length > 9) hf.lastChild.remove(); };
    Feed.on(onEv);
    cleanupFns.push(() => Feed.off(onEv));

    this.onDrift = () => {
      $$(".lp-row[data-lp]").forEach((r) => {
        const m = bySlug[r.dataset.lp];
        $(".lp-fill", r).style.width = m.c + "%";
      });
    };
    cleanupFns.push(() => { this.onDrift = null; });

    $$('a[href="#markets-sec"]').forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      $("#markets-sec").scrollIntoView({ behavior: "smooth" });
    }));

    initReveals($("#app"));
    initCountUps($("#app"));
  },

  market(slug, params) {
    const m = bySlug[slug];
    if (!m) return this.notfound();
    const side = params.get("side") === "no" ? "no" : "yes";
    const cat = catLabel(m.cat);
    const related = MK.filter((x) => x.cat === m.cat && x.slug !== slug).sort((a, b) => b.vol24 - a.vol24).slice(0, 3);

    $("#app").innerHTML = `
    <div class="wrap">
      <div class="crumb"><a href="#/">Markets</a><span class="sep">/</span><a href="#/">${cat}</a><span class="sep">/</span><span style="color:var(--muted)">${esc(m.q.length > 52 ? m.q.slice(0, 52) + "\u2026" : m.q)}</span></div>
      <div class="mk-head">
        <div class="mk-chips">
          <span class="chip" style="cursor:default">${cat}</span>
          <span class="chip" style="cursor:default">${endsIn(m)}</span>
          ${m.hot ? '<span class="tag tag-hot" style="align-self:center">Hot market</span>' : ""}
        </div>
        <h1 class="mk-title">${esc(m.q)}</h1>
        <div class="mk-stats">
          <div class="mk-stat"><div class="v" data-price="${m.slug}">${cents(m)}</div><div class="k">Chance</div></div>
          <div class="mk-stat"><div class="v">${fmtUSD(m.vol24)}</div><div class="k">24h volume</div></div>
          <div class="mk-stat"><div class="v">${fmtUSD(m.volT)}</div><div class="k">Total volume</div></div>
          <div class="mk-stat"><div class="v">${fmtUSD(m.liq)}</div><div class="k">Liquidity</div></div>
          <div class="mk-stat"><div class="v">${fmtN(m.traders)}</div><div class="k">Traders</div></div>
        </div>
      </div>

      <div class="mk-grid">
        <div class="mk-main">
          <div class="chart-card">
            <div class="chart-top">
              <div class="chart-price"><span class="big" data-price="${m.slug}">${cents(m)}</span><span class="delta ${m.change >= 0 ? "up" : "down"}" id="mk-delta">${(m.change >= 0 ? "+" : "") + m.change.toFixed(1)}%</span></div>
              <div class="ranges" id="ranges">
                <button data-r="1">1D</button>
                <button data-r="7">1W</button>
                <button data-r="30" class="on">1M</button>
                <button data-r="all">All</button>
              </div>
            </div>
            <div class="chart-wrap"><canvas id="mk-chart"></canvas><div class="chart-tip" id="chart-tip"></div></div>
          </div>

          <div class="txt-card">
            <h3>About this market</h3>
            <p>${esc(m.res)}</p>
            <p>This market is denominated in USDC on the Arc network. Each share pays <b>$1.00</b> if the outcome is Yes and $0.00 if the outcome is No. Prices shown reflect the current market-implied probability.</p>
            <div class="src-row"><svg class="src-ic" viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg><span>Resolution source: <b>${esc(m.src)}</b></span></div>
          </div>

          <div class="panel">
            <div class="panel-head"><span class="t"><span class="live-dot"></span><h2>Recent trades</h2></span><span style="font-size:12px;color:var(--dim)">${fmtN(m.traders)} traders</span></div>
            <div id="mk-feed"></div>
          </div>

          <div>
            <div class="sec-head"><h2>More in ${cat}</h2><a href="#/">View all</a></div>
            <div class="rel-grid">${related.map((r) => marketCard(r)).join("")}</div>
          </div>
        </div>

        <div class="mk-rail">
          <div class="trade-panel" id="trade-panel">${this.tradePanelHTML(m, side)}</div>
          <div class="panel">
            <div class="panel-head"><h2>Order book</h2><span style="font-size:11px;color:var(--dim)">size (USDC)</span></div>
            <div class="ob-head"><span>Price</span><span>Shares</span></div>
            <div class="ob-rows" id="ob-asks"></div>
            <div class="ob-mid"><span>Spread</span><b>0.9\u00A2</b><span>·</span><b data-price="${m.slug}">${cents(m)}</b></div>
            <div class="ob-rows" id="ob-bids"></div>
          </div>
        </div>
      </div>
    </div>`;

    const cv = $("#mk-chart"), tip = $("#chart-tip");
    let range = 30;
    const sliceFor = (r) => (r === "all" ? m.hist : m.hist.slice(-Math.min(m.hist.length, r * 8)));
    const renderChart = () => {
      const data = sliceFor(range).map((v) => v / 10);
      const days = range === "all" ? Math.max(30, Math.round((Date.now() - m.start) / 86400000)) : range;
      drawChart(cv, data, days);
      bindChartHover(cv, data, days, tip);
    };
    renderChart();
    $$("#ranges button").forEach((b) => b.addEventListener("click", () => {
      $$("#ranges button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      range = b.dataset.r === "all" ? "all" : parseInt(b.dataset.r, 10);
      renderChart();
    }));
    const onResize = () => renderChart();
    window.addEventListener("resize", onResize);
    cleanupFns.push(() => window.removeEventListener("resize", onResize));

    const obRnd = (function (s) { return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })(parseInt(slug.replace(/\W/g, "").slice(0, 8), 36) || 7);
    const genSide = (dir) => Array.from({ length: 6 }, (_, i) => {
      const p = Math.max(1, Math.min(99, m.c + dir * (i + 1)));
      return { p, sz: Math.round(400 + obRnd() * 12000) };
    });
    const obRow = (o, cls) => `<div class="ob-row ${cls}"><span class="depth" style="width:${Math.min(100, o.sz / 130)}%"></span><span class="pr">${o.p}\u00A2</span><span class="sz">${fmtN(o.sz)}</span></div>`;
    $("#ob-bids").innerHTML = genSide(-1).map((o) => obRow(o, "bid")).join("");
    $("#ob-asks").innerHTML = genSide(1).reverse().map((o) => obRow(o, "ask")).join("");

    const mf = $("#mk-feed");
    const seedFeed = ARC.feed.filter((f) => f.m === slug).slice(0, 6).map((f) => ({ ...f, t: Date.now() - f.t * 1000 }));
    const rowHTML = (ev) => `<div class="feed-row">
      ${avatarHTML(ev.name)}
      <span class="who"><b>${esc(ev.name)}</b></span>
      <span class="txt"><span class="t-side ${ev.yes ? "yes" : "no"}">${ev.yes ? "Yes" : "No"}</span> · <b>${fmtUSD(ev.amt)}</b> at ${bySlug[ev.m].c}\u00A2</span>
      <span class="when">${timeAgo(ev.t)}</span>
    </div>`;
    mf.innerHTML = seedFeed.length ? seedFeed.map(rowHTML).join("") : rowHTML({ m: slug, yes: true, amt: 1240, name: ARC.names[3], t: Date.now() - 40000 });
    const onEv = (ev) => { if (ev.m === slug) { mf.insertAdjacentHTML("afterbegin", rowHTML(ev)); while (mf.children.length > 8) mf.lastChild.remove(); } };
    Feed.on(onEv);
    cleanupFns.push(() => Feed.off(onEv));

    bindCards($("#app"));
    this.bindTradePanel(m);
    initReveals($("#app"));

    this.onDrift = () => {
      const d = $("#mk-delta");
      if (d) { d.className = "delta " + (m.change >= 0 ? "up" : "down"); d.textContent = (m.change >= 0 ? "+" : "") + m.change.toFixed(1) + "%"; }
      const yesB = $(".tp-btn.yes .c", $("#trade-panel"));
      const noB = $(".tp-btn.no .c", $("#trade-panel"));
      if (yesB) yesB.textContent = m.c + "\u00A2";
      if (noB) noB.textContent = (100 - m.c) + "\u00A2";
    };
    cleanupFns.push(() => { this.onDrift = null; });
  },

  tradePanelHTML(m, side) {
    const noC = 100 - m.c;
    const sel = (s) => (s === side ? " sel" : "");
    return `
      <div class="tp-side">
        <button class="tp-btn yes${sel("yes")}" data-side="yes"><span class="s">Yes</span><span class="c">${m.c}\u00A2</span></button>
        <button class="tp-btn no${sel("no")}" data-side="no"><span class="s">No</span><span class="c">${noC}\u00A2</span></button>
      </div>
      <div id="tp-body"></div>`;
  },

  bindTradePanel(m) {
    const panel = $("#trade-panel");
    let side = panel.contains($(".tp-btn.yes.sel")) ? "yes" : "no";
    const body = () => $("#tp-body", panel);

    const renderBody = () => {
      const price = side === "yes" ? m.c : 100 - m.c;
      if (!Wallet.state) {
        body().innerHTML = `
          <button class="btn btn-ink btn-block" id="tp-connect" style="padding:13px">Connect wallet to trade</button>
          <div class="tp-note">Connect to see your balance and positions.</div>`;
        $("#tp-connect").addEventListener("click", openWalletModal);
        return;
      }
      body().innerHTML = `
        <div class="tp-restricted"><svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 0 1-8-8c0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.96 7.96 0 0 1 12 20Zm6.31-3.1L7.1 5.69A7.96 7.96 0 0 1 12 4a8 8 0 0 1 8 8c0 1.85-.63 3.55-1.69 4.9Z"/></svg>Region restricted</div>
        <div class="tp-amt"><input id="tp-amt" type="number" min="1" step="1" placeholder="0" inputmode="decimal"><span class="cur">$ USDC</span></div>
        <div class="tp-quick">
          <button data-a="10">$10</button><button data-a="50">$50</button><button data-a="100">$100</button><button data-a="max">Max</button>
        </div>
        <div class="tp-rows">
          <div class="tp-row"><span>Avg price</span><b id="tp-avg">${price}\u00A2</b></div>
          <div class="tp-row"><span>Shares</span><b id="tp-shares">0</b></div>
          <div class="tp-row"><span>Payout if ${side === "yes" ? "Yes" : "No"}</span><b id="tp-payout">$0.00</b></div>
          <div class="tp-row"><span>Potential profit</span><b class="win" id="tp-profit">$0.00</b></div>
        </div>
        <button class="btn btn-block btn-ink" id="tp-buy" style="padding:13px">Buy ${side === "yes" ? "Yes" : "No"} · ${price}\u00A2</button>
        <div class="tp-note">Balance $${Wallet.state.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC</div>
        <div id="tp-msg"></div>`;

      const amt = $("#tp-amt");
      const update = () => {
        const a = parseFloat(amt.value) || 0;
        const shares = a / (price / 100);
        $("#tp-shares").textContent = shares ? shares.toFixed(2) : "0";
        $("#tp-payout").textContent = "$" + shares.toFixed(2);
        $("#tp-profit").textContent = "$" + Math.max(0, shares - a).toFixed(2);
      };
      amt.addEventListener("input", update);
      $$(".tp-quick button", panel).forEach((b) => b.addEventListener("click", () => {
        amt.value = b.dataset.a === "max" ? Math.floor(Wallet.state.balance) : b.dataset.a;
        update();
      }));
      $("#tp-buy").addEventListener("click", () => submitOrder());
      update();
    };

    const submitOrder = () => {
      const btn = $("#tp-buy"), msg = $("#tp-msg");
      btn.disabled = true;
      btn.textContent = "Submitting order\u2026";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = `Buy ${side === "yes" ? "Yes" : "No"} \u00B7 ${side === "yes" ? m.c : 100 - m.c}\u00A2`;
        msg.innerHTML = `<div class="tp-msg"><b>Order rejected</b>Trading is not available in your region. Arc Predict is geo-restricted for your location, so orders cannot be routed. You can keep browsing markets and prices in the meantime.</div>`;
      }, 1500);
    };

    $$(".tp-btn", panel).forEach((b) => b.addEventListener("click", () => {
      side = b.dataset.side;
      $(".tp-btn.yes", panel).classList.toggle("sel", side === "yes");
      $(".tp-btn.no", panel).classList.toggle("sel", side === "no");
      renderBody();
    }));
    renderBody();
    this.refreshTradePanel = () => renderBody();
    cleanupFns.push(() => { this.refreshTradePanel = () => {}; });
  },

  activity() {
    $("#app").innerHTML = `
    <div class="wrap">
      <div class="page-head"><div><h1>Activity</h1><p>Every trade on Arc Predict, live as it happens.</p></div></div>
      <div class="act-filter">
        <button class="chip on" data-f="all">All</button>
        ${Object.entries(ARC.cats).map(([k, v]) => `<button class="chip" data-f="${k}">${v.label}</button>`).join("")}
      </div>
      <div class="panel" style="margin:16px 0 80px">
        <div class="panel-head"><span class="t"><span class="live-dot"></span><h2 style="font-size:15px">Live feed</h2></span><span style="font-size:12px;color:var(--dim)" id="act-count"></span></div>
        <div class="act-list" id="act-list"></div>
      </div>
    </div>`;
    let cat = "all";
    const list = $("#act-list");
    const rowHTML = (ev) => {
      const m = bySlug[ev.m];
      if (!m) return "";
      return `<div class="feed-row">
        ${avatarHTML(ev.name)}
        <span class="who"><b>${esc(ev.name)}</b></span>
        <span class="txt"><span class="t-side ${ev.yes ? "yes" : "no"}">${ev.yes ? "Yes" : "No"}</span> · <b>${fmtUSD(ev.amt)}</b> · <a href="#/market/${ev.m}" style="color:inherit">${esc(m.q.length > 52 ? m.q.slice(0, 52) + "\u2026" : m.q)}</a></span>
        <span class="when">${timeAgo(ev.t)}</span>
      </div>`;
    };
    const render = () => {
      const pool = ARC.feed.filter((f) => cat === "all" || bySlug[f.m].cat === cat).slice(0, 50);
      list.innerHTML = pool.map((f) => rowHTML({ ...f, t: Date.now() - f.t * 1000 })).join("");
      $("#act-count").textContent = pool.length + " recent trades";
    };
    render();
    $$(".act-filter .chip").forEach((c) => c.addEventListener("click", () => {
      $$(".act-filter .chip").forEach((x) => x.classList.remove("on"));
      c.classList.add("on");
      cat = c.dataset.f;
      render();
    }));
    const onEv = (ev) => {
      if (cat !== "all" && bySlug[ev.m].cat !== cat) return;
      list.insertAdjacentHTML("afterbegin", rowHTML(ev));
      while (list.children.length > 52) list.lastChild.remove();
    };
    Feed.on(onEv);
    cleanupFns.push(() => Feed.off(onEv));
    initReveals($("#app"));
  },

  leaders() {
    $("#app").innerHTML = `
    <div class="wrap">
      <div class="page-head"><div><h1>Leaderboard</h1><p>Top performing traders this week, ranked by realized profit.</p></div></div>
      <div class="panel" style="margin:16px 0 80px;max-width:820px">
        <div class="panel-head"><h2 style="font-size:15px">This week</h2><span style="font-size:12px;color:var(--dim)">Resets Sunday 00:00 UTC</span></div>
        ${ARC.leaders.map((l, i) => `
        <div class="lb-row" style="padding:15px 22px">
          <span class="lb-rank">${i + 1}</span>
          ${avatarHTML(l[0])}
          <span class="lb-name">${esc(l[0])}<small>${l[3]} volume · ${l[2]}% win rate</small></span>
          <span class="lb-pnl" style="font-size:15px">+${l[1]}%</span>
        </div>`).join("")}
      </div>
    </div>`;
    initReveals($("#app"));
  },

  notfound() {
    $("#app").innerHTML = `<div class="wrap nf"><h1>404</h1><p style="color:var(--muted)">This market does not exist or has been delisted.</p><p style="margin-top:18px"><a class="btn btn-ink" href="#/">Back to markets</a></p></div>`;
  },
};

/* ---------------- search ---------------- */
const Filters = { q: "", applyToGrid: null, t: null };
$("#search").addEventListener("input", (e) => {
  Filters.q = e.target.value.trim().toLowerCase();
  clearTimeout(Filters.t);
  Filters.t = setTimeout(() => {
    if (!location.hash.startsWith("#/market/")) {
      if (location.hash !== "#/" && location.hash !== "") location.hash = "#/";
      else if (window.__gridRender) window.__gridRender(true);
    }
  }, 200);
});

/* ---------------- router ---------------- */
function route() {
  clearCleanup();
  window.scrollTo(0, 0);
  const h = location.hash || "#/";
  const [pathPart, queryPart] = h.slice(1).split("?");
  const params = new URLSearchParams(queryPart || "");
  const parts = pathPart.split("/").filter(Boolean);
  let name = "home";
  if (parts[0] === "market") name = "market";
  else if (parts[0] === "activity") name = "activity";
  else if (parts[0] === "leaders") name = "leaders";
  $$(".tb-nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === name || (name === "home" && a.dataset.nav === "home" && !parts[0])));
  if (name === "market") Views.market(parts[1], params);
  else Views[name]();
  Drift.start();
}
window.addEventListener("hashchange", route);

/* ---------------- boot ---------------- */
// Fallback: force-reveal anything scrolled to or above the fold, so content is
// never left invisible if IntersectionObserver callbacks are throttled.
window.addEventListener("scroll", () => {
  $$(".reveal:not(.in)").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.96) el.classList.add("in");
  });
}, { passive: true });

initHeaderScroll();
Wallet.load();
startTicker();
route();
