/* Fischquiz · App-Logik (ohne Build, ohne Bibliotheken)
   Lernalgorithmus: Leitner-Fächer 0–6 mit festen Abständen, Prüfungstermin deckelt die Abstände.
   Falsch beantwortete Arten kommen in derselben Runde 3 Fragen später noch einmal. */
(() => {
  "use strict";

  // ---------- Daten ----------
  const CREDITS = window.CREDITS || {};
  const GRUPPEN = window.GRUPPEN || {};
  const REGELN = window.REGELN || {};
  const PRUEF = Object.assign({ bilder: 8, bestehen: 6 }, window.PRUEFUNG);
  const ALLE = (window.ARTEN || []).filter(a => a.aktiv !== false);
  const BY = Object.fromEntries(ALLE.map(a => [a.id, a]));
  ALLE.forEach(a => { a.bilder = ["1", "2", "3", "4"].map(n => `${a.id}-${n}`).filter(k => CREDITS[k]); });
  const MIT_BILD = ALLE.filter(a => a.bilder.length);
  const VERW = (window.VERWECHSLER || []).map((v, i) => ({ ...v, i, arten: v.arten.filter(id => BY[id]) }))
    .filter(v => v.arten.filter(id => BY[id].bilder.length).length >= 2);

  // ---------- Hilfen ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const zufall = arr => arr[Math.floor(Math.random() * arr.length)];
  const MIN = 60e3, TAG = 864e5;
  const heute = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const plural = (n, ein, mehr) => `${n} ${n === 1 ? ein : mehr}`;

  // ---------- Speicher (localStorage, immer in try/catch) ----------
  const KEY = "fischquiz.v1";
  const leer = () => ({ karten: {}, verw: {}, pruefungen: [], termin: null, tage: {} });
  let S = (() => {
    try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.karten) return Object.assign(leer(), r); } catch (e) { /* privat/voll */ }
    return leer();
  })();
  const speichern = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignorieren */ } };

  // ---------- Spaced Repetition ----------
  const ABSTAND = [0, 10 * MIN, TAG, 3 * TAG, 7 * TAG, 14 * TAG, 30 * TAG];
  const karte = id => S.karten[id] || (S.karten[id] = { box: 0, due: 0, r: 0, f: 0 });
  const istNeu = id => { const k = S.karten[id]; return !k || (!k.r && !k.f); };
  const istFaellig = id => !istNeu(id) && karte(id).due <= Date.now();
  const istSicher = id => !istNeu(id) && karte(id).box >= 4;

  function bewerten(id, richtig, gewaehlt) {
    const k = karte(id), jetzt = Date.now();
    if (richtig) { k.box = istNeu(id) ? 2 : Math.min(k.box + 1, 6); k.r++; }
    else { k.box = 1; k.f++; }
    let abstand = ABSTAND[k.box];
    if (S.termin) {
      const rest = new Date(S.termin + "T08:00").getTime() - jetzt;
      if (rest > 0) abstand = Math.min(abstand, Math.max(10 * MIN, rest / 3));
    }
    k.due = jetzt + abstand; k.zuletzt = jetzt;
    if (!richtig && gewaehlt && gewaehlt !== id) {
      const m = S.verw[id] || (S.verw[id] = {}); m[gewaehlt] = (m[gewaehlt] || 0) + 1;
    }
    const t = heute(); S.tage[t] = (S.tage[t] || 0) + 1;
    speichern();
  }

  // Nächste Runde: erst Fälliges, dann bis zu 6 neue, dann die Schwächsten.
  function runde(pool, n = 10) {
    const jetzt = Date.now();
    const gesehen = pool.filter(a => !istNeu(a.id));
    const faellig = gesehen.filter(a => karte(a.id).due <= jetzt).sort((a, b) => karte(a.id).due - karte(b.id).due);
    const neu = shuffle(pool.filter(a => istNeu(a.id)));
    const liste = faellig.slice(0, n);
    liste.push(...neu.slice(0, Math.max(0, Math.min(6, n - liste.length))));
    if (liste.length < n) {
      const rest = shuffle(gesehen.filter(a => !liste.includes(a)))
        .sort((a, b) => karte(a.id).box - karte(b.id).box || karte(b.id).f - karte(a.id).f);
      liste.push(...rest.slice(0, n - liste.length));
    }
    if (liste.length < n) liste.push(...neu.filter(a => !liste.includes(a)).slice(0, n - liste.length));
    return shuffle(liste);
  }

  function falscheAntworten(art, anzahl = 3) {
    const kand = [];
    const add = id => { if (id !== art.id && BY[id] && !kand.includes(id)) kand.push(id); };
    Object.entries(S.verw[art.id] || {}).sort((a, b) => b[1] - a[1]).forEach(([id]) => add(id));
    shuffle(art.verwechslung || []).forEach(add);
    const auswahl = kand.slice(0, 2);
    const fuell = [...shuffle(ALLE.filter(a => a.gruppe === art.gruppe)), ...shuffle(ALLE)].map(a => a.id);
    for (const id of fuell) { if (auswahl.length >= anzahl) break; if (id !== art.id && !auswahl.includes(id)) auswahl.push(id); }
    return auswahl;
  }

  // ---------- Bausteine ----------
  const ICON = {
    karten: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="13" height="14" rx="2.5"/><path d="M7.5 3.5h10a3 3 0 0 1 3 3V17"/></svg>',
    quiz: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.6" r=".4"/></svg>',
    paar: '<svg viewBox="0 0 24 24"><path d="M3 12c2.5-4 6-4 8.5 0-2.5 4-6 4-8.5 0z"/><path d="M12.5 12c2.5-4 6-4 8.5 0-2.5 4-6 4-8.5 0z"/></svg>',
    pruefung: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5V3h6v1.5M8.5 12.5l2.4 2.4 4.6-4.8"/></svg>',
    lexikon: '<svg viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13z"/></svg>',
  };

  function nachweis(key, mitLink) {
    const c = CREDITS[key]; if (!c) return "";
    const lizenz = c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license);
    const quelle = mitLink && c.source ? ` · <a href="${esc(c.source)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : " · Wikimedia Commons";
    return `<div class="nachweis">Foto: ${esc(c.author || "unbekannt")} · ${lizenz}${quelle}</div>`;
  }
  function foto(key, { alt = "", mitLink = false, wechsel = false } = {}) {
    const c = CREDITS[key];
    if (!c) return `<div class="foto"><div class="leer">Für diese Art gibt es noch kein freies Foto.</div></div>`;
    return `<div class="foto"><div class="hg" style="background-image:url('${esc(c.file)}')"></div>
      <img src="${esc(c.file)}" alt="${esc(alt)}" draggable="false" decoding="async">
      ${wechsel ? `<button class="wechsel" data-wechsel>Anderes Foto</button>` : ""}</div>${nachweis(key, mitLink)}`;
  }
  function regelHTML(art) {
    const r = REGELN[art.id]; if (!r) return "";
    const teile = [];
    if (r.geschuetzt) teile.push(`<b>Ganzjährig geschützt</b>${r.ausnahme ? ` (Ausnahme ${esc(r.ausnahme)})` : ""}`);
    if (r.mass) teile.push(`Mindestmaß <b>${esc(r.mass)}</b>`);
    if (r.schonzeit) teile.push(`Schonzeit <b>${esc(r.schonzeit)}</b>`);
    if (r.hinweis) teile.push(esc(r.hinweis));
    return `<div class="kachel" style="margin-top:14px"><div class="etikett" style="margin:0 0 6px">Niedersachsen</div>${teile.join("<br>")}</div>`;
  }
  function steckbrief(art, { name = true } = {}) {
    return `${name ? `<div class="titel"><h2>${esc(art.name)}</h2><span class="sci">${esc(art.sci)}</span></div>` : ""}
      ${art.alt ? `<div class="unter">auch: ${esc(art.alt)}</div>` : ""}
      <span class="familie">${esc(art.familie)}</span>
      <ul class="merkmale">${art.merkmale.map(m => `<li>${esc(m)}</li>`).join("")}</ul>
      ${regelHTML(art)}`;
  }
  function vergleich(art, gewaehlt) {
    const g = BY[gewaehlt]; if (!g) return "";
    const gruppe = (window.VERWECHSLER || []).find(v => v.arten.includes(art.id) && v.arten.includes(g.id));
    return `<div class="vergleich">Du hast <b>${esc(g.name)}</b> gewählt. ${gruppe ? esc(gruppe.tipp) : `Typisch für ${esc(g.name)}: ${esc(g.merkmale[0])}.`}</div>`;
  }
  function ring(wert, gesamt, groesse = 132) {
    const r = 56, u = 2 * Math.PI * r, anteil = gesamt ? wert / gesamt : 0;
    return `<div class="ring" style="width:${groesse}px;height:${groesse}px"><svg viewBox="0 0 132 132">
      <circle class="bahn" cx="66" cy="66" r="${r}" fill="none" stroke-width="12"/>
      <circle class="wert" cx="66" cy="66" r="${r}" fill="none" stroke-width="12" stroke-dasharray="${u}" stroke-dashoffset="${u}" data-ziel="${u * (1 - anteil)}"/></svg>
      <div class="mitte"><div><div class="zahl">${wert}</div><div class="klein">von ${gesamt} sicher</div></div></div></div>`;
  }
  const ringeAnimieren = () => requestAnimationFrame(() => requestAnimationFrame(() =>
    $$(".ring .wert").forEach(c => { c.style.strokeDashoffset = c.dataset.ziel; })));

  function serie() {
    let n = 0; const d = new Date();
    if (!S.tage[heute(d)]) d.setDate(d.getDate() - 1);
    while (S.tage[heute(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const restTage = () => S.termin ? Math.ceil((new Date(S.termin + "T00:00") - new Date(heute() + "T00:00")) / TAG) : null;
  const vorladen = keys => keys.forEach(k => { const c = CREDITS[k]; if (c) { const i = new Image(); i.src = c.file; } });

  // ---------- Dialog ----------
  function bestaetigen(titel, text, ja = "Löschen") {
    return new Promise(res => {
      const d = $("#dialog"); $("#dialog-titel").textContent = titel; $("#dialog-text").textContent = text; $("#dialog-ja").textContent = ja;
      d.hidden = false; $("#dialog-nein").focus();
      const zu = w => { d.hidden = true; $("#dialog-ja").onclick = $("#dialog-nein").onclick = d.onclick = null; res(w); };
      $("#dialog-ja").onclick = () => zu(true); $("#dialog-nein").onclick = () => zu(false);
      d.onclick = e => { if (e.target === d) zu(false); };
    });
  }

  // ---------- Steckbrief-Blatt (Lexikon) ----------
  function blatt(id) {
    const art = BY[id]; if (!art) return;
    const hg = document.createElement("div"); hg.className = "blatt-hg";
    const ks = karte(id);
    const status = istNeu(id) ? "Noch nicht geübt" : `${ks.r}× richtig · ${ks.f}× falsch${istSicher(id) ? " · sicher" : ""}`;
    hg.innerHTML = `<div class="blatt glas" role="dialog" aria-modal="true" aria-label="${esc(art.name)}"><div class="griff"></div>
      <div class="bildpaar">${(art.bilder.length ? art.bilder : [`${id}-1`]).slice(0, 2).map(k => `<div>${foto(k, { alt: art.name, mitLink: true })}</div>`).join("")}</div>
      <div class="loesung" style="margin-top:16px">${steckbrief(art)}
        ${art.verwechslung?.length ? `<div class="etikett">Nicht verwechseln mit</div><div class="chips">${art.verwechslung.filter(v => BY[v]).map(v => `<button class="chip" data-art="${v}">${esc(BY[v].name)}</button>`).join("")}</div>` : ""}
        <p class="hinweis">${esc(status)}</p>
        <button class="knopf leise breit" data-zu style="margin-top:10px">Schließen</button></div></div>`;
    document.body.appendChild(hg);
    document.documentElement.style.overflow = "hidden";
    const zu = () => { hg.remove(); document.documentElement.style.overflow = ""; };
    hg.addEventListener("click", e => {
      if (e.target === hg || e.target.closest("[data-zu]")) zu();
      const c = e.target.closest("[data-art]"); if (c) { zu(); blatt(c.dataset.art); }
    });
  }

  // ---------- Ansichten ----------
  const zustand = { lernen: null, quiz: null, pruefung: null, lernModus: "karten", filter: "alle", suche: "" };
  const buehne = $("#buehne");

  const ANSICHTEN = {
    start() {
      const sicher = MIT_BILD.filter(a => istSicher(a.id)).length;
      const faellig = MIT_BILD.filter(a => istFaellig(a.id)).length;
      const neu = MIT_BILD.filter(a => istNeu(a.id)).length;
      const letzte = S.pruefungen[S.pruefungen.length - 1];
      const tipp = VERW.length ? VERW[Math.floor(Date.now() / TAG) % VERW.length] : null;
      const rt = restTage();
      let botschaft;
      if (!Object.keys(S.tage).length) botschaft = `${MIT_BILD.length} Fischarten warten. Fang mit einer Runde Karteikarten an.`;
      else if (faellig) botschaft = `${plural(faellig, "Art ist", "Arten sind")} heute zur Wiederholung dran.`;
      else if (neu) botschaft = `Alles Fällige erledigt. ${plural(neu, "neue Art wartet", "neue Arten warten")}.`;
      else botschaft = "Alles wiederholt. Zeit für eine Probeprüfung.";
      return `<section class="ansicht">
        <header class="kopf"><div><h1>${gruss()}</h1><div class="unter">Fischbestimmung für die Fischerprüfung</div></div></header>
        <div class="karte glas held">${ring(sicher, MIT_BILD.length)}
          <div><h2>${rt !== null && rt >= 0 ? (rt === 0 ? "Heute ist Prüfung. Viel Erfolg!" : `Noch ${plural(rt, "Tag", "Tage")} bis zur Prüfung`) : "Weiter geht's"}</h2>
          <p>${esc(botschaft)}</p>
          <div class="knopfzeile"><button class="knopf" data-los="quiz">${faellig ? `${faellig} fällige üben` : "Quiz starten"}</button>
          <button class="knopf leise" data-los="lernen">Karteikarten</button></div></div></div>

        <div class="statzeile" style="margin-top:16px">
          <div class="kachel stat"><b>${faellig}</b><span>fällig</span></div>
          <div class="kachel stat"><b>${S.tage[heute()] || 0}</b><span>heute geübt</span></div>
          <div class="kachel stat"><b>${serie()}</b><span>Tage am Stück</span></div>
        </div>

        <div class="etikett">Üben</div>
        <div class="raster">
          ${modus("lernen", ICON.karten, "Karteikarten", "Foto ansehen, Namen sagen, umdrehen.")}
          ${modus("quiz", ICON.quiz, "Quiz", "Foto und vier Antworten. Fehler kommen öfter.")}
          ${modus("paare", ICON.paar, "Verwechsler", "Ähnliche Arten direkt gegeneinander.")}
          ${modus("pruefung", ICON.pruefung, "Probeprüfung", `${PRUEF.bilder} Fotos ohne Auswahl, ab ${PRUEF.bestehen} bestanden.${letzte ? ` Zuletzt ${letzte.richtig}/${letzte.gesamt}.` : ""}`)}
        </div>
        ${tipp ? `<div class="etikett">Merksatz des Tages</div>
          <div class="karte glas tipp"><div class="wer">${tipp.arten.map(id => esc(BY[id].name)).join(" · ")}</div><p style="margin:8px 0 0">${esc(tipp.tipp)}</p></div>` : ""}
      </section>`;
    },

    lernen() {
      const seg = `<div class="segment" role="tablist">
        <button class="${zustand.lernModus === "karten" ? "an" : ""}" data-lernmodus="karten">Karteikarten</button>
        <button class="${zustand.lernModus === "lexikon" ? "an" : ""}" data-lernmodus="lexikon">Alle Arten</button></div>`;
      if (zustand.lernModus === "lexikon") return lexikon(seg);
      if (!zustand.lernen) zustand.lernen = { liste: runde(MIT_BILD, 12), i: 0, um: false, gewusst: 0 };
      const L = zustand.lernen;
      if (L.i >= L.liste.length) {
        return `<section class="ansicht"><header class="kopf"><div><h1>Lernen</h1></div>${seg}</header>
          <div class="karte glas ergebnis"><div class="gross">${L.gewusst}/${L.liste.length}</div><p class="unter">gewusst in dieser Runde</p>
          <div class="knopfzeile" style="max-width:420px;margin:20px auto 0"><button class="knopf" data-neuerunde="lernen">Nächste Runde</button><button class="knopf leise" data-los="quiz">Zum Quiz</button></div></div></section>`;
      }
      const art = L.liste[L.i];
      if (!L.bild || L.bildFuer !== art.id) { L.bild = zufall(art.bilder); L.bildFuer = art.id; }
      vorladen((L.liste[L.i + 1]?.bilder || []).slice(0, 1));
      return `<section class="ansicht"><header class="kopf"><div><h1>Lernen</h1><div class="lernzahl">Karte ${L.i + 1} von ${L.liste.length}${istNeu(art.id) ? " · neu" : ""}</div></div>${seg}</header>
        <div class="stapel" style="max-width:760px;margin:0 auto">
          <div class="dreh ${L.um ? "um" : ""}" data-umdrehen>
            <div class="seite vorne karte glas" style="padding:14px">${foto(L.bild, { wechsel: art.bilder.length > 1 })}
              <div class="antippen">Wie heißt der Fisch? Laut sagen, dann antippen.</div></div>
            <div class="seite hinten karte glas"><div class="rueck"><div class="rueck-bild">${foto(L.bild)}</div><div class="loesung">${steckbrief(art)}</div></div></div>
          </div>
          <div class="knopfzeile" id="kartenknoepfe" style="margin-top:16px">${kartenKnoepfe(L)}</div>
        </div></section>`;
    },

    quiz() {
      const Q = zustand.quiz;
      if (!Q) return quizStart();
      if (Q.i >= Q.liste.length) return quizEnde(Q);
      const f = Q.liste[Q.i], art = BY[f.id];
      vorladen(Q.liste[Q.i + 1] ? [Q.liste[Q.i + 1].bild] : []);
      const opts = f.optionen.map((id, n) => {
        let kl = "";
        if (Q.antwort) kl = id === art.id ? "richtig" : id === Q.antwort ? "falsch" : "blass";
        return `<button class="option ${kl}" data-antwort="${id}" ${Q.antwort ? "disabled" : ""}><span class="buchst">${"ABCDE"[n]}</span>${esc(BY[id].name)}</button>`;
      }).join("");
      const ok = Q.antwort === art.id;
      return `<section class="ansicht" style="animation:none">
        <header class="kopf"><div><h1>${Q.titel}</h1><div class="lernzahl">Frage ${Math.min(Q.i + 1, Q.liste.length)} von ${Q.liste.length} · ${Q.richtig} richtig</div></div>
          <button class="knopf leise" data-quizende style="min-height:42px;padding:0 16px">Beenden</button></header>
        <div class="fortschrittsbalken"><i style="width:${(Q.i / Q.liste.length) * 100}%"></i></div>
        <div class="quiz zwei">
          <div>${foto(f.bild, { mitLink: !!Q.antwort })}</div>
          <div class="optionen">${opts}
            ${Q.antwort ? `<div class="karte glas loesung"><div class="urteil ${ok ? "gut" : "krit"}">${ok ? "Richtig" : "Leider falsch"}</div>
              ${steckbrief(art)}${ok ? "" : vergleich(art, Q.antwort)}
              <button class="knopf breit" data-weiter style="margin-top:16px">${Q.i + 1 >= Q.liste.length ? "Ergebnis" : "Weiter"}</button></div>` : ""}
          </div>
        </div></section>`;
    },

    pruefung() {
      const P = zustand.pruefung;
      if (!P) return pruefungStart();
      if (P.i >= P.liste.length) return pruefungEnde(P);
      const f = P.liste[P.i], art = BY[f.id];
      vorladen(P.liste[P.i + 1] ? [P.liste[P.i + 1].bild] : []);
      const zaehler = P.liste.map((x, n) => `<i class="${n < P.i ? (x.ok ? "gut" : "krit") : n === P.i ? "jetzt" : ""}"></i>`).join("");
      return `<section class="ansicht" style="animation:none">
        <header class="kopf"><div><h1>Probeprüfung</h1><div class="lernzahl">Bild ${P.i + 1} von ${P.liste.length}</div></div>
          <button class="knopf leise" data-pruefungabbruch style="min-height:42px;padding:0 16px">Abbrechen</button></header>
        <div class="zaehler">${zaehler}</div>
        <div class="quiz zwei">
          <div>${foto(f.bild, { mitLink: P.offen })}</div>
          <div>${P.offen
            ? `<div class="karte glas loesung">${steckbrief(art)}
                <p class="hinweis" style="text-align:left">Hattest du den richtigen Namen? Wenn ja: Weißt du auch Mindestmaß, Schonzeit oder Schutz?</p>
                <div class="knopfzeile" style="margin-top:14px"><button class="knopf leise" data-selbst="0">Nicht gewusst</button><button class="knopf gut" data-selbst="1">Gewusst</button></div></div>`
            : `<div class="karte glas"><h2 style="font-size:24px">Wie heißt dieser Fisch?</h2>
                <p class="unter" style="margin:8px 0 18px">Wie in der echten Prüfung: keine Auswahl. Sag den Namen laut und deck dann auf.</p>
                <button class="knopf breit" data-aufdecken>Aufdecken</button></div>`}</div>
        </div></section>`;
    },

    fortschritt() {
      const sicher = MIT_BILD.filter(a => istSicher(a.id)).length;
      const gruppen = Object.entries(GRUPPEN).map(([g, name]) => {
        const arten = MIT_BILD.filter(a => a.gruppe === g); if (!arten.length) return "";
        const s = arten.filter(a => istSicher(a.id)).length;
        return `<div><div class="feld" style="margin-bottom:6px"><span>${esc(name)}</span><span class="lernzahl">${s}/${arten.length}</span></div><div class="balken"><i style="width:${(s / arten.length) * 100}%"></i></div></div>`;
      }).join("");
      const schwer = ALLE.filter(a => (S.karten[a.id]?.f || 0) > 0).sort((a, b) => S.karten[b.id].f - S.karten[a.id].f).slice(0, 8);
      const paare = [];
      Object.entries(S.verw).forEach(([id, m]) => Object.entries(m).forEach(([g, n]) => { if (BY[id] && BY[g]) paare.push({ id, g, n }); }));
      paare.sort((a, b) => b.n - a.n);
      const credits = Object.entries(CREDITS).sort(([a], [b]) => a.localeCompare(b)).map(([k, c]) => {
        const art = BY[k.replace(/-\d+$/, "")];
        return `<div><b>${esc(art ? art.name : k)}</b>: ${esc(c.author || "unbekannt")}, <a href="${esc(c.licenseUrl || "#")}" target="_blank" rel="noopener">${esc(c.license)}</a>, <a href="${esc(c.source)}" target="_blank" rel="noopener">Quelle</a>${c.note ? ` (${esc(c.note)})` : ""}</div>`;
      }).join("");
      return `<section class="ansicht">
        <header class="kopf"><div><h1>Fortschritt</h1><div class="unter">${sicher} von ${MIT_BILD.length} Arten sicher (mindestens viermal hintereinander gewusst)</div></div></header>
        <div class="raster">
          <div class="karte glas" style="display:grid;gap:14px"><div class="etikett" style="margin:0">Nach Gruppen</div>${gruppen}</div>
          <div class="karte glas"><div class="etikett" style="margin:0 0 10px">Prüfungstermin</div>
            <div class="feld"><span>Datum der Prüfung</span><input type="date" id="termin" value="${esc(S.termin || "")}" min="${heute()}"></div>
            <p class="hinweis" style="text-align:left">Mit Termin werden die Wiederholungen so verteilt, dass bis dahin alles sitzt.</p></div>
        </div>
        <div class="etikett">Schwierigste Arten</div>
        ${schwer.length ? `<div class="liste">${schwer.map(a => `<button class="zeile" data-art="${a.id}"><span class="mini" style="background-image:url('${esc(CREDITS[a.bilder[0]]?.file || "")}')"></span><span><b>${esc(a.name)}</b></span><span class="rechts">${S.karten[a.id].f}× falsch</span></button>`).join("")}</div>`
          : `<div class="kachel leer-zustand">Noch keine Fehler. Sobald du übst, stehen hier die Arten, die dir am schwersten fallen.</div>`}
        ${paare.length ? `<div class="etikett">Deine häufigsten Verwechslungen</div><div class="liste">${paare.slice(0, 6).map(p => `<button class="zeile" data-art="${p.id}"><span><b>${esc(BY[p.id].name)}</b> für <b>${esc(BY[p.g].name)}</b> gehalten</span><span class="rechts">${p.n}×</span></button>`).join("")}</div>` : ""}
        ${S.pruefungen.length ? `<div class="etikett">Probeprüfungen</div><div class="verlauf">${S.pruefungen.slice(-8).reverse().map(p => `<div class="zeile"><span>${new Date(p.datum).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}</span><span><b>${p.richtig}/${p.gesamt}</b> <span class="stempel ${p.richtig >= PRUEF.bestehen ? "gut" : "krit"}" style="padding:3px 10px;font-size:13px;margin-left:6px;border-radius:999px">${p.richtig >= PRUEF.bestehen ? "bestanden" : "nicht bestanden"}</span></span></div>`).join("")}</div>` : ""}
        <div class="etikett">Bildnachweise</div>
        <details class="kachel"><summary style="cursor:pointer;font-weight:600">${Object.keys(CREDITS).length} Fotos von Wikimedia Commons, frei lizenziert</summary>
          <div class="credits" style="margin-top:12px">${credits}</div></details>
        <div class="etikett">Daten</div>
        <div class="kachel"><p style="margin:0 0 12px;color:var(--ink2)">Der Lernstand bleibt nur auf diesem Gerät gespeichert.</p>
          <button class="knopf gefahr" data-reset>Lernstand zurücksetzen</button></div>
      </section>`;
    },
  };

  function kartenKnoepfe(L) {
    return L.um
      ? `<button class="knopf leise" data-karte="0">Nochmal üben</button><button class="knopf gut" data-karte="1">Gewusst</button>`
      : `<button class="knopf breit" data-umdrehen>Umdrehen</button>`;
  }
  function gruss() {
    const h = new Date().getHours();
    return h < 11 ? "Guten Morgen" : h < 18 ? "Petri Heil" : "Guten Abend";
  }
  function modus(ziel, ikon, titel, text) {
    return `<button class="karte glas modus" data-los="${ziel}"><span class="ikon">${ikon}</span><span><h3>${titel}</h3><p>${esc(text)}</p></span><span class="pfeil">›</span></button>`;
  }

  function lexikon(seg) {
    const q = zustand.suche.trim().toLowerCase();
    const liste = ALLE.filter(a => (zustand.filter === "alle" || a.gruppe === zustand.filter) &&
      (!q || [a.name, a.alt, a.sci, a.familie].join(" ").toLowerCase().includes(q)));
    const chips = [["alle", "Alle"], ...Object.entries(GRUPPEN)].map(([k, n]) => `<button class="chip ${zustand.filter === k ? "an" : ""}" data-filter="${k}">${esc(n)}</button>`).join("");
    return `<section class="ansicht"><header class="kopf"><div><h1>Lernen</h1><div class="lernzahl">${ALLE.length} Arten · antippen für Steckbrief</div></div>${seg}</header>
      <input type="search" id="suche" placeholder="Art suchen" value="${esc(zustand.suche)}" autocomplete="off" autocorrect="off" enterkeyhint="search"
        style="width:100%;font:inherit;font-size:17px;color:var(--ink);background:var(--kachel);border:1px solid var(--rand);border-radius:14px;padding:12px 16px;margin-bottom:12px">
      <div class="chips" style="margin-bottom:14px">${chips}</div>
      <div class="arten">${liste.map(a => {
        const k = S.karten[a.id], f = CREDITS[a.bilder[0]];
        const punkt = istNeu(a.id) ? "" : `<span class="punkt b${k.box}${k.box <= 1 && k.f ? " f" : ""}"></span>`;
        return `<button class="art-kachel" data-art="${a.id}"><span class="bild" style="${f ? `background-image:url('${esc(f.file)}')` : ""}">${punkt}</span>
          <span class="text"><b>${esc(a.name)}</b><small>${esc(a.familie)}</small></span></button>`;
      }).join("") || `<div class="leer-zustand">Keine Art gefunden.</div>`}</div></section>`;
  }

  // ----- Quiz -----
  function quizStart() {
    const faellig = MIT_BILD.filter(a => istFaellig(a.id)).length;
    const chips = [["alle", "Alle Arten"], ...Object.entries(GRUPPEN)].map(([k, n]) => `<button class="chip ${zustand.filter === k ? "an" : ""}" data-filter="${k}">${esc(n)}</button>`).join("");
    return `<section class="ansicht"><header class="kopf"><div><h1>Quiz</h1><div class="unter">Arten, die du falsch hattest, kommen öfter dran.</div></div></header>
      <div class="karte glas"><h2 style="font-size:22px">Normale Runde</h2><p class="unter" style="margin:6px 0 14px">10 Fotos, je vier Antworten. ${faellig ? `${plural(faellig, "Art ist", "Arten sind")} fällig.` : ""}</p>
        <div class="chips" style="margin-bottom:14px">${chips}</div>
        <button class="knopf breit" data-quizlos>Los geht's</button></div>
      <div class="etikett" id="verwechsler">Verwechsler üben</div>
      <div class="liste">${VERW.map(v => {
        const fehler = v.arten.reduce((s, id) => s + (S.karten[id]?.f || 0), 0);
        return `<button class="zeile" data-paar="${v.i}"><span class="mini" style="background-image:url('${esc(CREDITS[BY[v.arten[0]].bilder[0]]?.file || "")}')"></span>
          <span><b>${v.arten.map(id => esc(BY[id].name)).join(" · ")}</b></span><span class="rechts">${fehler ? `${fehler} Fehler` : "›"}</span></button>`;
      }).join("")}</div></section>`;
  }
  function frage(art, optionen) {
    return { id: art.id, bild: zufall(art.bilder), optionen: optionen || shuffle([art.id, ...falscheAntworten(art)]) };
  }
  function quizNeu(pool, titel) {
    zustand.quiz = { titel, liste: runde(pool, Math.min(10, pool.length)).map(a => frage(a)), i: 0, richtig: 0, antwort: null, fehler: [] };
  }
  function paarNeu(v) {
    const arten = v.arten.map(id => BY[id]).filter(a => a.bilder.length);
    const liste = [];
    while (liste.length < 8) liste.push(...shuffle(arten));
    zustand.quiz = { titel: "Verwechsler", paar: v.i, liste: liste.slice(0, 8).map(a => frage(a, shuffle(v.arten))), i: 0, richtig: 0, antwort: null, fehler: [] };
  }
  function quizEnde(Q) {
    const fehler = [...new Set(Q.fehler)].map(id => BY[id]);
    const fragen = Q.liste.filter(f => !f.wiederholung).length;
    return `<section class="ansicht"><header class="kopf"><div><h1>${Q.titel}</h1></div></header>
      <div class="karte glas ergebnis"><div class="gross">${Q.richtig}/${fragen}</div>
        <p class="unter">${Q.richtig === fragen ? "Fehlerfrei. Stark!" : "richtig beim ersten Versuch"}</p>
        ${fehler.length ? `<div class="etikett" style="text-align:left">Nochmal anschauen</div><div class="liste" style="text-align:left">${fehler.map(a => `<button class="zeile" data-art="${a.id}"><span class="mini" style="background-image:url('${esc(CREDITS[a.bilder[0]]?.file || "")}')"></span><b>${esc(a.name)}</b><span class="rechts">›</span></button>`).join("")}</div>` : ""}
        <div class="knopfzeile" style="max-width:440px;margin:22px auto 0"><button class="knopf" data-quiznochmal>Nächste Runde</button><button class="knopf leise" data-quizende>Fertig</button></div></div></section>`;
  }

  // ----- Prüfung -----
  function pruefungStart() {
    const PR = window.PRAXIS;
    return `<section class="ansicht"><header class="kopf"><div><h1>Probeprüfung</h1><div class="unter">So läuft der praktische Teil ab.</div></div></header>
      <div class="karte glas held" style="grid-template-columns:1fr">
        <div><h2>${PRUEF.bilder} Fotos, ${PRUEF.bestehen} müssen sitzen</h2>
        <p>Keine Antworten zur Auswahl. Du sagst den Namen, deckst auf und bewertest dich ehrlich selbst.</p>
        <button class="knopf" data-pruefunglos style="min-width:220px">Prüfung starten</button></div></div>
      ${PR ? `<div class="etikett">Ablauf in Niedersachsen</div>
        <div class="karte glas"><ul class="merkmale" style="margin:0">${PR.ablauf.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
        <div class="etikett">Betäuben und Töten (wird in der Praxis abgefragt)</div>
        <div class="raster">${PR.toeten.map(s => `<div class="karte glas"><h3 style="font-size:18px">${esc(s.t)}</h3><p style="margin:6px 0 0;color:var(--ink2)">${esc(s.d)}</p></div>`).join("")}</div>
        <p class="hinweis">Quelle: <a href="${esc(PR.quelle.url)}" target="_blank" rel="noopener">${esc(PR.quelle.text)}</a></p>` : ""}
      ${window.REGELN_QUELLE ? `<div class="etikett">Mindestmaße, Schonzeiten, geschützte Arten</div>
        <div class="liste">${ALLE.filter(a => REGELN[a.id]).map(a => {
          const r = REGELN[a.id];
          const txt = r.geschuetzt ? "ganzjährig geschützt" : [r.mass, r.schonzeit].filter(Boolean).join(" · ");
          return `<button class="zeile" data-art="${a.id}"><b>${esc(a.name)}</b><span class="rechts">${esc(txt)}</span></button>`;
        }).join("")}</div>
        <p class="hinweis">${esc(window.REGELN_QUELLE.text)}</p>` : ""}
    </section>`;
  }
  function pruefungNeu() {
    const arten = shuffle(MIT_BILD).slice(0, Math.min(PRUEF.bilder, MIT_BILD.length));
    zustand.pruefung = { liste: arten.map(a => ({ id: a.id, bild: zufall(a.bilder), ok: null })), i: 0, offen: false };
  }
  function pruefungEnde(P) {
    const richtig = P.liste.filter(x => x.ok).length, gesamt = P.liste.length, ok = richtig >= PRUEF.bestehen;
    if (!P.gespeichert) {
      S.pruefungen.push({ datum: Date.now(), richtig, gesamt, falsch: P.liste.filter(x => !x.ok).map(x => x.id) });
      S.pruefungen = S.pruefungen.slice(-50); speichern(); P.gespeichert = true;
    }
    const falsch = P.liste.filter(x => !x.ok).map(x => BY[x.id]);
    return `<section class="ansicht"><header class="kopf"><div><h1>Ergebnis</h1></div></header>
      <div class="karte glas ergebnis"><div class="gross">${richtig}/${gesamt}</div>
        <div class="stempel ${ok ? "gut" : "krit"}">${ok ? "Bestanden" : `Nicht bestanden, ${PRUEF.bestehen} nötig`}</div>
        ${falsch.length ? `<div class="etikett" style="text-align:left">Diese Arten wiederholst du jetzt öfter</div><div class="liste" style="text-align:left">${falsch.map(a => `<button class="zeile" data-art="${a.id}"><span class="mini" style="background-image:url('${esc(CREDITS[a.bilder[0]]?.file || "")}')"></span><b>${esc(a.name)}</b><span class="rechts">›</span></button>`).join("")}</div>` : ""}
        <div class="knopfzeile" style="max-width:440px;margin:22px auto 0"><button class="knopf" data-pruefunglos>Neue Prüfung</button><button class="knopf leise" data-pruefungabbruch>Fertig</button></div></div></section>`;
  }

  // ---------- Router ----------
  let aktuell = "start";
  function zeigen(name, { scroll = true } = {}) {
    if (!ANSICHTEN[name]) name = "start";
    aktuell = name;
    buehne.innerHTML = ANSICHTEN[name]();
    $$(".tab").forEach(t => t.classList.toggle("aktiv", t.dataset.ziel === name));
    if (scroll) window.scrollTo({ top: 0 });
    ringeAnimieren();
  }
  const neuZeichnen = () => { zeigen(aktuell, { scroll: false }); const a = buehne.firstElementChild; if (a) a.style.animation = "none"; };
  function gehe(name) { if (location.hash !== "#" + name) location.hash = name; else zeigen(name); }
  window.addEventListener("hashchange", () => zeigen(location.hash.slice(1)));
  $$(".tab").forEach(t => t.addEventListener("click", () => gehe(t.dataset.ziel)));

  // ---------- Klicks ----------
  buehne.addEventListener("click", async e => {
    const el = e.target.closest("button, [data-umdrehen]"); if (!el) return;
    const d = el.dataset;

    if (d.los === "paare") { zustand.quiz = null; gehe("quiz"); return requestAnimationFrame(() => $("#verwechsler")?.scrollIntoView({ behavior: "smooth" })); }
    if (d.los) { const Q = zustand.quiz; if (d.los === "quiz" && (!Q || Q.i >= Q.liste.length)) quizNeu(MIT_BILD, "Quiz"); return gehe(d.los); }
    if (d.art) return blatt(d.art);
    if (d.lernmodus) { zustand.lernModus = d.lernmodus; return neuZeichnen(); }
    if (d.filter) { zustand.filter = d.filter; return neuZeichnen(); }

    if ("wechsel" in d) {
      e.stopPropagation();
      const L = aktuell === "lernen" ? zustand.lernen : null;
      if (L) { const art = L.liste[L.i]; const andere = art.bilder.filter(k => k !== L.bild); if (andere.length) L.bild = zufall(andere); neuZeichnen(); }
      return;
    }
    // Karteikarten
    if ("umdrehen" in d && zustand.lernen) {
      if (e.target.closest("a")) return;                       // Lizenz-Link nicht abfangen
      const L = zustand.lernen; L.um = !L.um;
      $(".dreh")?.classList.toggle("um", L.um);                // Klasse umschalten, damit die Drehung animiert
      $("#kartenknoepfe").innerHTML = kartenKnoepfe(L);
      return;
    }
    if (d.karte !== undefined) {
      const L = zustand.lernen, art = L.liste[L.i], ok = d.karte === "1";
      bewerten(art.id, ok); if (ok) L.gewusst++; else if (!L.wieder?.includes(art.id)) { (L.wieder ||= []).push(art.id); L.liste.splice(Math.min(L.i + 4, L.liste.length), 0, art); }
      L.i++; L.um = false; return neuZeichnen();
    }
    if (d.neuerunde === "lernen") { zustand.lernen = null; return neuZeichnen(); }

    // Quiz
    if ("quizlos" in d) { const pool = zustand.filter === "alle" ? MIT_BILD : MIT_BILD.filter(a => a.gruppe === zustand.filter); quizNeu(pool.length >= 4 ? pool : MIT_BILD, zustand.filter === "alle" ? "Quiz" : GRUPPEN[zustand.filter]); return neuZeichnen(); }
    if (d.paar !== undefined) { paarNeu(VERW.find(v => v.i === +d.paar)); return neuZeichnen(); }
    if (d.antwort && zustand.quiz && !zustand.quiz.antwort) {
      const Q = zustand.quiz, f = Q.liste[Q.i], ok = d.antwort === f.id;
      Q.antwort = d.antwort;
      if (!f.wiederholung) { bewerten(f.id, ok, d.antwort); if (ok) Q.richtig++; }
      if (!ok) {
        Q.fehler.push(f.id);
        const art = BY[f.id];
        Q.liste.splice(Math.min(Q.i + 4, Q.liste.length), 0, { ...frage(art, Q.paar !== undefined ? shuffle(f.optionen) : null), wiederholung: true });
      }
      neuZeichnen();
      requestAnimationFrame(() => $(".loesung")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      return;
    }
    if ("weiter" in d && zustand.quiz) { zustand.quiz.i++; zustand.quiz.antwort = null; return zeigen("quiz"); }
    if ("quiznochmal" in d) {
      const Q = zustand.quiz;
      if (Q.paar !== undefined) paarNeu(VERW.find(v => v.i === Q.paar)); else quizNeu(MIT_BILD, "Quiz");
      return neuZeichnen();
    }
    if ("quizende" in d) { zustand.quiz = null; return neuZeichnen(); }

    // Prüfung
    if ("pruefunglos" in d) { pruefungNeu(); return neuZeichnen(); }
    if ("aufdecken" in d) { zustand.pruefung.offen = true; return neuZeichnen(); }
    if (d.selbst !== undefined) {
      const P = zustand.pruefung, f = P.liste[P.i]; f.ok = d.selbst === "1";
      bewerten(f.id, f.ok); P.i++; P.offen = false; return zeigen("pruefung");
    }
    if ("pruefungabbruch" in d) { zustand.pruefung = null; return neuZeichnen(); }

    // Fortschritt
    if ("reset" in d) {
      const ja = await bestaetigen("Lernstand löschen?", "Alle Ergebnisse, Fehler und Probeprüfungen auf diesem Gerät werden gelöscht. Das lässt sich nicht rückgängig machen.");
      if (ja) { S = leer(); speichern(); zustand.lernen = zustand.quiz = zustand.pruefung = null; neuZeichnen(); }
    }
  });
  buehne.addEventListener("input", e => {
    if (e.target.id === "suche") {
      zustand.suche = e.target.value; const pos = e.target.selectionStart;
      neuZeichnen(); const s = $("#suche"); s.focus(); try { s.setSelectionRange(pos, pos); } catch (_) { /* */ }
    }
  });
  buehne.addEventListener("change", e => {
    if (e.target.id === "termin") { S.termin = e.target.value || null; speichern(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && $(".blatt-hg")) { $(".blatt-hg").remove(); document.documentElement.style.overflow = ""; }
    if (aktuell === "quiz" && zustand.quiz && !zustand.quiz.antwort && /^[1-4a-dA-D]$/.test(e.key)) {
      const n = isNaN(+e.key) ? "abcd".indexOf(e.key.toLowerCase()) : +e.key - 1;
      $$(".option")[n]?.click();
    } else if (e.key === "Enter" && $("[data-weiter]")) $("[data-weiter]").click();
  });

  // ---------- Start ----------
  zeigen(location.hash.slice(1) || "start");
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
