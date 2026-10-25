// script.js — SNAC ANIME core logic

(function () {
  "use strict";

  // ---------- State ----------
  const state = {
    search: "",
    genre: "all",
    language: "all",
    sort: "latest",
    section: "all", // all | trending | latest
  };

  const GENRES = ["Action", "Adventure", "Fantasy", "Romance", "Comedy", "Supernatural"];

  // ---------- Helpers ----------
  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $$(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function initials(title) {
    return title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  function safeTelegram(url) {
    if (typeof url === "string" && /^https?:\/\/t\.me\//i.test(url)) return url;
    return DEFAULT_TELEGRAM;
  }

  function animeUrl(a) {
    return safeTelegram(a.telegramUrl);
  }

  // ---------- Poster ----------
  function buildPoster(a, opts = {}) {
    // اگر poster path দেওয়া আছে এবং খালি না হলে <img> দেখাও
    const poster = a.poster && String(a.poster).trim();
    const wrapper = document.createElement("div");
    wrapper.className = "poster";

    // badges
    const badges = document.createElement("div");
    badges.className = "poster-badges";
    if (a.language) {
      const p = document.createElement("span");
      p.className = "pill pill-lang";
      p.textContent = a.language;
      badges.appendChild(p);
    }
    if (a.status && a.status !== "Movie") {
      const p = document.createElement("span");
      p.className = "pill pill-status";
      p.textContent = a.status;
      badges.appendChild(p);
    } else if (a.status === "Movie") {
      const p = document.createElement("span");
      p.className = "pill pill-status";
      p.textContent = "Movie";
      badges.appendChild(p);
    }
    wrapper.appendChild(badges);

    if (a.rating) {
      const r = document.createElement("span");
      r.className = "pill pill-rating";
      r.textContent = "★ " + a.rating;
      wrapper.appendChild(r);
    }

    if (poster) {
      const img = document.createElement("img");
      img.alt = a.title + " poster";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = poster;
      img.addEventListener("load", () => img.classList.add("loaded"));
      img.addEventListener("error", () => {
        img.remove();
        wrapper.appendChild(fallback(a));
      });
      wrapper.appendChild(img);
    } else {
      wrapper.appendChild(fallback(a));
    }
    return wrapper;
  }

  function fallback(a) {
    const fb = document.createElement("div");
    fb.className = "poster-fallback";
    const init = document.createElement("div");
    init.className = "initials";
    init.textContent = initials(a.title);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = (a.year || "") + (a.status === "Movie" ? " • Movie" : "");
    fb.appendChild(init);
    fb.appendChild(sub);
    return fb;
  }

  // ---------- Card ----------
  function buildCard(a) {
    const card = document.createElement("article");
    card.className = "anime-card";
    card.dataset.id = a.id;

    card.appendChild(buildPoster(a));

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = a.title;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const genreSpan = document.createElement("span");
    genreSpan.className = "genre";
    genreSpan.textContent = (a.genre || []).join(" • ");
    meta.appendChild(genreSpan);
    if (a.year) {
      const y = document.createElement("span");
      y.textContent = "• " + a.year;
      meta.appendChild(y);
    }
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const details = document.createElement("button");
    details.className = "btn btn-details";
    details.type = "button";
    details.textContent = "Details";
    details.addEventListener("click", () => openModal(a.id));
    actions.appendChild(details);

    const tg = document.createElement("a");
    tg.className = "btn btn-tg";
    tg.href = animeUrl(a);
    tg.target = "_blank";
    tg.rel = "noopener noreferrer";
    tg.textContent = "Telegram";
    tg.setAttribute("aria-label", a.title + " এর Telegram লিংক");
    actions.appendChild(tg);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  // ---------- Filtering & Sorting ----------
  function filteredList() {
    let list = animeList.slice();

    if (state.section === "trending") list = list.filter((a) => a.trending);
    if (state.section === "latest") list = list.filter((a) => a.latest);

    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.titleBn || "").toLowerCase().includes(q) ||
          (a.genre || []).some((g) => g.toLowerCase().includes(q))
      );
    }
    if (state.genre !== "all") {
      list = list.filter((a) => (a.genre || []).includes(state.genre));
    }
    if (state.language !== "all") {
      list = list.filter((a) => (a.language || "").toLowerCase() === state.language.toLowerCase());
    }

    switch (state.sort) {
      case "latest":
        list.sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      case "oldest":
        list.sort((a, b) => (a.year || 0) - (b.year || 0));
        break;
      case "az":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "za":
        list.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "rating":
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }
    return list;
  }

  // ---------- Render ----------
  function renderSection(containerId, list, emptyMsg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = "";
    if (!list.length) {
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="emoji">🔍</div>
        <h3>কিছু পাওয়া যায়নি</h3>
        <p>${escapeHtml(emptyMsg || "অন্য কিছু লিখে আবার চেষ্টা করুন।")}</p>
      </div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((a) => frag.appendChild(buildCard(a)));
    el.appendChild(frag);
  }

  function renderAll() {
    // Trending (max 8)
    const trending = animeList.filter((a) => a.trending).slice(0, 8);
    renderSection("trendingGrid", trending, "কোনো Trending Anime নেই।");

    // Latest (max 8)
    const latest = animeList
      .filter((a) => a.latest)
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 8);
    renderSection("latestGrid", latest, "কোনো Latest Anime নেই।");

    // All grid with filters
    renderSection("allGrid", filteredList(), "আপনার সার্চের সাথে কোনো Anime মেলেনি।");
    updateCount();

    // Categories
    renderCategories();
  }

  function updateCount() {
    const c = document.getElementById("filterCount");
    if (c) c.textContent = "মোট " + filteredList().length + " টি Anime";
  }

  function renderCategories() {
    const grid = document.getElementById("catGrid");
    if (!grid) return;
    const icons = {
      Action: "⚔️",
      Adventure: "🗺️",
      Fantasy: "✨",
      Romance: "💖",
      Comedy: "😂",
      Supernatural: "👻",
    };
    grid.innerHTML = "";
    GENRES.forEach((g) => {
      const count = animeList.filter((a) => (a.genre || []).includes(g)).length;
      const card = document.createElement("div");
      card.className = "cat-card";
      card.innerHTML = `
        <div class="cat-icon">${icons[g] || "🎬"}</div>
        <div class="cat-name">${g}</div>
        <div class="cat-count">${count} টি Anime</div>`;
      card.addEventListener("click", () => {
        state.genre = g;
        const gs = document.getElementById("genreSelect");
        if (gs) gs.value = g;
        renderAll();
        const all = document.getElementById("all-section");
        if (all) all.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      grid.appendChild(card);
    });
  }

  // ---------- Modal ----------
  function openModal(id) {
    const a = animeList.find((x) => x.id === id);
    if (!a) return;
    const overlay = document.getElementById("modalOverlay");
    if (!overlay) return;

    overlay.innerHTML = "";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    // close btn
    const close = document.createElement("button");
    close.className = "modal-close";
    close.type = "button";
    close.setAttribute("aria-label", "বন্ধ করুন");
    close.textContent = "✕";
    close.addEventListener("click", closeModal);
    modal.appendChild(close);

    // poster
    const posterWrap = document.createElement("div");
    posterWrap.className = "modal-poster";
    posterWrap.appendChild(buildPoster(a));
    // adjust so poster img fills
    const pImg = posterWrap.querySelector(".poster img");
    if (pImg) { pImg.style.objectPosition = "center"; }
    modal.appendChild(posterWrap);

    const body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML = `
      <h2>${escapeHtml(a.title)}</h2>
      ${a.titleBn ? `<div class="sub-title">${escapeHtml(a.titleBn)}</div>` : ""}
      <div class="modal-tags">
        ${(a.genre || []).map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join("")}
        ${a.year ? `<span class="tag">${a.year}</span>` : ""}
        ${a.language ? `<span class="tag">${escapeHtml(a.language)}</span>` : ""}
        ${a.status ? `<span class="tag">${escapeHtml(a.status)}</span>` : ""}
        ${a.rating ? `<span class="tag">★ ${a.rating}</span>` : ""}
      </div>
      <p class="desc">${escapeHtml(a.description || "")}</p>
      <a class="btn btn-tg" href="${escapeHtml(animeUrl(a))}" target="_blank" rel="noopener noreferrer">
        ✈️ Telegram-এ দেখুন
      </a>
    `;
    modal.appendChild(body);
    overlay.appendChild(modal);
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    close.focus();
  }

  function closeModal() {
    const overlay = document.getElementById("modalOverlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.innerHTML = "";
    document.body.style.overflow = "";
  }

  // ---------- Mobile menu ----------
  function setupMobileMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobileMenu");
    if (!btn || !menu) return;
    menu.style.display = "none";
    btn.addEventListener("click", () => {
      const isOpen = menu.style.display !== "none";
      menu.style.display = isOpen ? "none" : "flex";
      btn.setAttribute("aria-expanded", String(!isOpen));
    });
    // close on link click
    $$("a", menu).forEach((a) =>
      a.addEventListener("click", () => (menu.style.display = "none"))
    );
  }

  // ---------- Filter events ----------
  function setupFilters() {
    const genreSel = document.getElementById("genreSelect");
    const langSel = document.getElementById("languageSelect");
    const sortSel = document.getElementById("sortSelect");
    const secSel = document.getElementById("sectionSelect");
    const search = document.getElementById("filterSearch");
    const clearBtn = document.getElementById("clearFilters");

    if (genreSel) genreSel.addEventListener("change", (e) => { state.genre = e.target.value; renderAll(); });
    if (langSel) langSel.addEventListener("change", (e) => { state.language = e.target.value; renderAll(); });
    if (sortSel) sortSel.addEventListener("change", (e) => { state.sort = e.target.value; renderAll(); });
    if (secSel) secSel.addEventListener("change", (e) => { state.section = e.target.value; renderAll(); });
    if (search) search.addEventListener("input", (e) => { state.search = e.target.value; renderAll(); });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        state.search = "";
        state.genre = "all";
        state.language = "all";
        state.sort = "latest";
        state.section = "all";
        if (genreSel) genreSel.value = "all";
        if (langSel) langSel.value = "all";
        if (sortSel) sortSel.value = "latest";
        if (secSel) secSel.value = "all";
        if (search) search.value = "";
        const navSearch = document.getElementById("navSearch");
        if (navSearch) navSearch.value = "";
        renderAll();
      });
    }
  }

  // ---------- Nav search ----------
  function setupNavSearch() {
    const navSearch = document.getElementById("navSearch");
    const filterSearch = document.getElementById("filterSearch");
    const mSearch = document.getElementById("mobileSearch");
    function apply(v) {
      state.search = v;
      renderAll();
      const all = document.getElementById("all-section");
      if (all) all.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (navSearch) {
      navSearch.addEventListener("input", (e) => {
        if (filterSearch) filterSearch.value = e.target.value;
        apply(e.target.value);
      });
      navSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter") apply(e.target.value);
      });
    }
    if (mSearch) {
      mSearch.addEventListener("input", (e) => {
        if (filterSearch) filterSearch.value = e.target.value;
        if (navSearch) navSearch.value = e.target.value;
        apply(e.target.value);
      });
    }
    // Explore button
    const explore = document.getElementById("exploreBtn");
    if (explore) {
      explore.addEventListener("click", (e) => {
        e.preventDefault();
        const all = document.getElementById("all-section");
        if (all) all.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  // ---------- Back to top ----------
  function setupToTop() {
    const btn = document.getElementById("toTop");
    if (!btn) return;
    window.addEventListener("scroll", () => {
      btn.classList.toggle("show", window.scrollY > 500);
    });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  // ---------- Modal events ----------
  function setupModalEvents() {
    const overlay = document.getElementById("modalOverlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof animeList === "undefined") {
      console.error("anime-data.js লোড হয়নি");
      return;
    }
    // default sort
    state.sort = "latest";
    renderAll();
    setupFilters();
    setupNavSearch();
    setupMobileMenu();
    setupToTop();
    setupModalEvents();
  });

  // global for buttons
  window.SNAC = { openModal, closeModal };
})();