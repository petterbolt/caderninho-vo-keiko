(function () {
  "use strict";
  var DATA = null;
  var PIX = "91980727494";
  var app = document.getElementById("app");
  var nav = document.getElementById("nav");

  // ---------- estado salvo ----------
  function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var FAV = ls("vk_fav", []);
  var FS = ls("vk_fs", 1);
  var LISTA = ls("vk_lista", []);
  var SEMANA = ls("vk_semana", []);
  var COZINHA = false, falando = false, deferredPrompt = null;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // ---------- utils ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function foto(r) { return r.foto ? r.foto : "placeholder.svg"; }
  function phClass(r) { var h = 0, s = r.id || ""; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return "ph" + (h % 3); }
  function emojiCat(r) { var c = cat(r.cat); return c ? c.emoji : "🍽️"; }
  function thumbHtml(r) { return r.foto ? '<img loading="lazy" src="' + r.foto + '" alt="" onerror="this.src=\'placeholder.svg\'">' : '<div class="thumb-ph ' + phClass(r) + '">' + emojiCat(r) + '</div>'; }
  function byId(id) { for (var i = 0; i < DATA.recipes.length; i++) if (DATA.recipes[i].id === id) return DATA.recipes[i]; return null; }
  function cat(slug) { for (var i = 0; i < DATA.cats.length; i++) if (DATA.cats[i].slug === slug) return DATA.cats[i]; return null; }
  function applyFs() { document.documentElement.style.setProperty("--fs", (FS * (COZINHA ? 1.3 : 1)).toFixed(3)); }
  function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }

  var toastEl = document.getElementById("toast"), toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, 2300); }

  function isFav(id) { return FAV.indexOf(id) > -1; }
  function toggleFav(id) { var i = FAV.indexOf(id); if (i > -1) FAV.splice(i, 1); else FAV.push(id); save("vk_fav", FAV); }

  // ---------- lista / semana ----------
  function addRecipeToLista(r) {
    r.ing.forEach(function (t) {
      if (!LISTA.some(function (x) { return x.t === t && x.from === r.t; })) LISTA.push({ t: t, from: r.t, done: false });
    });
    save("vk_lista", LISTA);
  }
  function isInSemana(id) { return SEMANA.indexOf(id) > -1; }
  function toggleSemana(id) { var i = SEMANA.indexOf(id); if (i > -1) SEMANA.splice(i, 1); else SEMANA.push(id); save("vk_semana", SEMANA); }

  // ---------- busca ----------
  function buscar(q) {
    var full = norm((q || "").trim());
    var toks = full.split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    var res = [];
    for (var i = 0; i < DATA.recipes.length; i++) {
      var r = DATA.recipes[i], hayT = r.tn, hayI = r.ingn, okT = true, okAll = true;
      for (var t = 0; t < toks.length; t++) {
        if (hayT.indexOf(toks[t]) < 0) okT = false;
        if (hayT.indexOf(toks[t]) < 0 && hayI.indexOf(toks[t]) < 0) okAll = false;
      }
      if (!okAll) continue;
      var s = okT ? 1 : 2;
      if (hayT.indexOf(full) === 0) s = 0;
      else if (okT && hayT.indexOf(full) > -1) s = 0.5;
      res.push({ r: r, s: s });
    }
    res.sort(function (a, b) { return a.s - b.s; });
    return res.map(function (x) { return x.r; });
  }

  // ---------- componentes ----------
  function cardReceita(r) {
    return '<a class="rcard" href="#/receita/' + encodeURIComponent(r.id) + '">' +
      thumbHtml(r) +
      '<div><div class="ti">' + esc(r.t) + '</div><div class="ca">' + esc(r.cad) + '</div></div></a>';
  }
  function blocoPix() {
    return '<ul class="tiers">' +
      '<li>🌱 <b>R$ 12,90</b> — se for o que dá pra agora, já é uma bênção</li>' +
      '<li>⭐ <b>R$ 19,90</b> — um carinho pela vó</li>' +
      '<li class="top">💛 <b>R$ 29,90</b> — a escolha da vó <i>(por só R$10 a mais)</i></li>' +
      '<li>🙏 <b>R$ 50,00</b> — pra abençoar e ajudar a vó a alcançar mais mulheres que precisam, como você</li>' +
      '</ul>' +
      '<div class="pixkey"><span>Chave Pix: ' + PIX + '</span></div>' +
      '<button class="btg terra" data-x="copiar-pix">📋 Copiar a chave Pix</button>' +
      '<p class="vo-texto" style="margin-top:14px">Você recebeu tudo de graça, no carinho. Qualquer valor que vier do seu coração já é uma bênção 💛</p>';
  }
  function passoHtml(x) {
    var m = x.match(/(\d+)\s*(minutos|minuto|min|horas|hora|h)\b/i);
    var btn = "";
    if (m) { var n = parseInt(m[1], 10); var mins = /^h/i.test(m[2]) ? n * 60 : n; if (mins > 0 && mins <= 240) btn = ' <button class="timer" data-min="' + mins + '">⏲️ ' + mins + ' min</button>'; }
    return '<li><span>' + esc(x) + '</span>' + btn + '</li>';
  }

  // ---------- telas ----------
  function home() {
    var cards = DATA.cats.map(function (c) {
      return '<a class="cat-card" href="#/cat/' + c.slug + '">' +
        '<img src="' + c.capa + '" alt="" onerror="this.src=\'placeholder.svg\'">' +
        '<div class="ov"></div><div class="txt"><b>' + esc(c.nome) + '</b><span>' + c.n + ' receitas</span></div></a>';
    }).join("");
    var quick = '<div class="quick">' +
      '<a class="qbtn" href="#/lista">🛒 Lista</a>' +
      '<a class="qbtn" href="#/semana">📅 Semana</a>' +
      (isStandalone() ? '' : '<a class="qbtn" href="#/instalar">📲 Instalar</a>') +
      '</div>';
    return '<div class="hero-vo"><img src="img/vo.webp" alt="Vó Keiko" onerror="this.style.display=\'none\'">' +
      '<div><div class="oi">Que bom te ver, minha querida!</div>' +
      '<p>Escolha embaixo o que você quer cozinhar hoje 💛</p></div></div>' +
      '<a class="busca-home" href="#/buscar"><span class="ni">🔍</span> Buscar uma receita…</a>' +
      quick +
      '<h2 class="sec-titulo">As receitas da vó</h2>' +
      '<div class="cats">' + cards + '</div>';
  }

  function telaCat(slug) {
    var c = cat(slug); if (!c) return home();
    var rs = DATA.recipes.filter(function (r) { return r.cat === slug; });
    return '<div class="topbar"><a class="voltar" href="#/">‹ Voltar</a><h2>' + esc(c.nome) + '</h2></div>' +
      '<div class="count-linha">' + rs.length + ' receitas</div>' +
      '<div class="lista">' + rs.map(cardReceita).join("") + '</div>';
  }

  function telaReceita(id) {
    var r = byId(id); if (!r) return home();
    var ing = r.ing.map(function (x) { return '<li><span class="ck">✓</span><span>' + esc(x) + '</span></li>'; }).join("");
    var prep = r.prep.map(passoHtml).join("");
    var dica = r.dica ? '<div class="dica"><div class="lab">Dica da vó</div><p>' + esc(r.dica) + '</p></div>' : "";
    var favOn = isFav(r.id) ? " on" : "";
    var semOn = isInSemana(r.id);
    var hint = !ls("vk_hint_ing", false) ? '<div class="hint">👆 Toque em cada ingrediente pra marcar o que você já tem em casa</div>' : "";
    if (hint) save("vk_hint_ing", true);
    return '<div class="topbar"><a class="voltar" href="#/cat/' + r.cat + '">‹ Voltar</a></div>' +
      (r.foto ? '<img class="rec-foto" src="' + r.foto + '" alt="" onerror="this.src=\'placeholder.svg\'">' : '<div class="rec-foto rec-ph ' + phClass(r) + '">' + emojiCat(r) + '</div>') +
      '<h1 class="rec-titulo">' + esc(r.t) + '</h1>' +
      '<div class="rec-cad">' + esc(r.cad) + '</div>' +
      '<div class="acoes">' +
      '<button class="acao' + favOn + '" data-act="fav">❤️ ' + (favOn ? "Favoritada" : "Favoritar") + '</button>' +
      '<button class="acao" data-act="ouvir">🔊 Ouvir a receita</button>' +
      '<button class="acao' + (COZINHA ? " on" : "") + '" data-act="cozinha">👩‍🍳 Modo cozinha</button>' +
      '</div>' +
      '<div class="bloco"><h3>🛒 Ingredientes</h3>' + hint + '<ul class="ing">' + ing + '</ul>' +
      '<button class="btg terra" data-x="add-lista" style="margin-top:8px">🛒 Mandar pra lista de compras</button></div>' +
      '<div class="bloco"><h3>👩‍🍳 Modo de preparo</h3><ol class="passos">' + prep + '</ol></div>' +
      dica +
      '<button class="btg ' + (semOn ? "" : "oliva") + '" data-x="add-semana">' + (semOn ? "📅 Na sua semana ✓ (tocar pra tirar)" : "📅 Adicionar à minha semana") + '</button>' +
      '<div class="extras">' +
      '<button class="acao mini" data-act="fmais">🔠 Letra maior</button>' +
      '<button class="acao mini" data-act="fmenos">🔠 Letra menor</button>' +
      '<button class="acao mini" data-x="share">📲 Enviar</button>' +
      '<button class="acao mini" data-x="print">🖨️ Imprimir</button>' +
      '</div>';
  }

  function telaBuscar(q) {
    var mic = SR ? '<button class="mic" id="micbtn" aria-label="Buscar falando">🎤</button>' : "";
    var dicaVoz = SR ? '<div class="sub" style="margin-top:10px">Toque no 🎤 e <b>fale</b> o que você quer cozinhar</div>' : "";
    return '<div class="topbar"><a class="voltar" href="#/">‹ Voltar</a><h2>Buscar</h2></div>' +
      '<div class="busca-row"><input class="busca-campo" id="bq" type="search" inputmode="search" autocomplete="off" placeholder="O que você quer fazer?" value="' + esc(q || "") + '">' + mic + '</div>' +
      dicaVoz +
      '<div id="bres" style="margin-top:16px">' + telaBuscarCorpo(q || "") + '</div>';
  }

  function telaFavoritos() {
    var rs = DATA.recipes.filter(function (r) { return isFav(r.id); });
    var corpo = rs.length
      ? '<div class="lista">' + rs.map(cardReceita).join("") + '</div>'
      : '<div class="aviso">Você ainda não favoritou nenhuma receita.<br>Toque no ❤️ dentro de uma receita pra guardar aqui.</div>';
    return '<div class="topbar"><a class="voltar" href="#/">‹ Voltar</a><h2>Minhas favoritas</h2></div>' + corpo;
  }

  function telaLista() {
    var top = '<div class="topbar"><a class="voltar" href="#/">‹ Voltar</a><h2>Lista de compras</h2></div>';
    if (!LISTA.length) return top + '<div class="aviso">Sua lista está vazia 🛒<br>Abra uma receita e toque em <b>"Mandar pra lista de compras"</b>.</div>' +
      '<a class="btg oliva" href="#/semana">📅 Montar pela minha semana</a>';
    var groups = [], map = {};
    LISTA.forEach(function (it, idx) { if (!(it.from in map)) { map[it.from] = []; groups.push(it.from); } map[it.from].push({ it: it, idx: idx }); });
    var faltam = LISTA.filter(function (x) { return !x.done; }).length;
    var blocos = groups.map(function (g) {
      var items = map[g].map(function (o) { return '<li class="litem' + (o.it.done ? " done" : "") + '" data-idx="' + o.idx + '"><span class="ck">✓</span><span>' + esc(o.it.t) + '</span></li>'; }).join("");
      return '<div class="bloco"><h3>' + esc(g) + '</h3><ul class="litens">' + items + '</ul></div>';
    }).join("");
    return top + '<div class="count-linha">' + faltam + ' item' + (faltam !== 1 ? "s" : "") + ' pra comprar</div>' + blocos +
      '<button class="btg" data-x="lista-wpp">📲 Enviar no WhatsApp</button>' +
      '<button class="btg oliva" data-x="lista-print" style="margin-top:10px">🖨️ Imprimir</button>' +
      '<button class="btg ghost" data-x="lista-limpar" style="margin-top:10px">🗑️ Limpar lista</button>';
  }

  function telaSemana() {
    var top = '<div class="topbar"><a class="voltar" href="#/">‹ Voltar</a><h2>Minha semana</h2></div>';
    var rs = SEMANA.map(byId).filter(Boolean);
    if (!rs.length) return top + '<div class="aviso">Monte a sua semana 📅<br>Abra as receitas que quer fazer e toque em <b>"Adicionar à minha semana"</b>.<br>Depois eu junto tudo numa lista de compras só 💛</div>';
    var cards = rs.map(function (r) {
      return '<div class="rcard"><a class="rcard-link" href="#/receita/' + encodeURIComponent(r.id) + '">' +
        thumbHtml(r) + '<div class="ti">' + esc(r.t) + '</div></a>' +
        '<button class="xrm" data-x="sem-rm" data-id="' + r.id + '" aria-label="Tirar">✕</button></div>';
    }).join("");
    return top + '<div class="count-linha">' + rs.length + ' receita' + (rs.length > 1 ? "s" : "") + ' na semana</div>' +
      '<div class="lista">' + cards + '</div>' +
      '<button class="btg" data-x="ger-lista" style="margin-top:16px">🛒 Gerar lista de compras</button>' +
      '<button class="btg ghost" data-x="sem-limpar" style="margin-top:10px">🗑️ Limpar semana</button>';
  }

  function telaInstalar() {
    var ua = navigator.userAgent || "", iOS = /iphone|ipad|ipod/i.test(ua);
    var top = '<div class="topbar"><a class="voltar" href="#/">‹ Voltar</a><h2>Instalar o aplicativo</h2></div>';
    if (isStandalone()) return top + '<div class="aviso">Pronto, o aplicativo já está instalado 💛<br>É só abrir pelo ícone da Vó Keiko na sua tela.</div>';
    var intro = '<p class="vo-texto">Deixe o caderninho da vó na tela do seu celular pra abrir com um toque, igual um aplicativo 💛</p>';
    var nativeBtn = deferredPrompt ? '<button class="btg" data-x="native-install">📲 Instalar agora</button>' : "";
    var ios = '<div class="bloco"><h3>📱 No iPhone</h3><ol class="steps">' +
      '<li>Use o <b>Safari</b> (o navegador da bússola).</li>' +
      '<li>Toque no botão <b>Compartilhar</b> (o quadradinho com a setinha pra cima ⬆️), na barra de baixo.</li>' +
      '<li>Role e toque em <b>"Adicionar à Tela de Início"</b>.</li>' +
      '<li>Toque em <b>"Adicionar"</b> no canto. Pronto! 💛</li></ol></div>';
    var andr = '<div class="bloco"><h3>🤖 No Android</h3><ol class="steps">' +
      '<li>Use o <b>Chrome</b>.</li>' +
      '<li>Toque no menu <b>⋮</b> (três pontinhos) lá em cima, à direita.</li>' +
      '<li>Toque em <b>"Instalar aplicativo"</b> (ou "Adicionar à tela inicial").</li>' +
      '<li>Confirme em <b>"Instalar"</b>. Pronto! 💛</li></ol></div>';
    return top + intro + nativeBtn + (iOS ? ios + andr : andr + ios);
  }

  var POPS = ["Bolo", "Pão", "Frango", "Chocolate", "Sopa", "Torta", "Banana", "Café"];
  function telaBuscarCorpo(q) {
    if (!q) {
      var chips = POPS.map(function (p) { return '<button class="chip" data-q="' + p + '">' + p + '</button>'; }).join("");
      return '<div class="sub">Sugestões pra você:</div><div class="chips">' + chips + '</div>' +
        '<div class="aviso">Ou digite o nome de uma receita ou um ingrediente 💛</div>';
    }
    var res = buscar(q);
    if (!res.length) return '<div class="aviso">Não encontrei nada com "' + esc(q) + '".<br>Tenta com outra palavra, minha querida.</div>';
    return '<div class="count-linha">' + res.length + ' receita' + (res.length > 1 ? "s" : "") + '</div><div class="lista">' + res.map(cardReceita).join("") + '</div>';
  }

  function telaVo() {
    return '<div class="topbar"><a class="voltar" href="#/">‹ Voltar</a><h2>A Vó Keiko</h2></div>' +
      '<div class="vo-topo"><img src="img/vo.webp" alt="Vó Keiko" onerror="this.style.display=\'none\'">' +
      '<div class="nome">Vó Keiko Tanaka</div></div>' +
      '<p class="vo-texto">Passei 30 anos adaptando essas receitas, primeiro pra cuidar da minha própria saúde, depois pra ajudar quem passa pelo mesmo que eu. Hoje elas estão aqui, na palma da sua mão 💛</p>' +
      (isStandalone() ? "" : '<a class="btg oliva" href="#/instalar">📲 Instalar o aplicativo</a>') +
      '<div class="bloco" style="padding-bottom:18px;margin-top:14px"><h3>🙏 Retribua com um carinho</h3>' + blocoPix() + '</div>' +
      '<button class="btg" data-x="baixar-tudo">📥 Baixar tudo para usar sem internet</button>';
  }

  // ---------- interações ----------
  function falar(r) {
    try {
      if (falando) { speechSynthesis.cancel(); falando = false; return; }
      var txt = r.t + ". Ingredientes: " + r.ing.join(", ") + ". Modo de preparo: " + r.prep.join(" ");
      var u = new SpeechSynthesisUtterance(txt); u.lang = "pt-BR"; u.rate = 0.95;
      u.onend = function () { falando = false; };
      speechSynthesis.cancel(); speechSynthesis.speak(u); falando = true; toast("Lendo a receita… toque de novo pra parar");
    } catch (e) { toast("Seu aparelho não consegue ler em voz alta"); }
  }
  var wakeLock = null;
  function cozinhaToggle(btn) {
    COZINHA = !COZINHA; applyFs(); btn.classList.toggle("on", COZINHA);
    if (COZINHA) {
      toast("Modo cozinha: letra grande e tela acesa");
      if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(function (w) { wakeLock = w; }).catch(function () {});
    } else if (wakeLock) { wakeLock.release(); wakeLock = null; }
  }
  function compartilhar(r) {
    var txt = r.t + "\n\nIngredientes:\n- " + r.ing.join("\n- ") + "\n\nModo de preparo:\n" + r.prep.map(function (p, i) { return (i + 1) + ". " + p; }).join("\n") + "\n\n— Caderninho da Vó Keiko";
    if (navigator.share) navigator.share({ title: r.t, text: txt }).catch(function () {});
    else window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
  }
  function enviarLista() {
    var txt = "🛒 Minha lista de compras (Vó Keiko)\n\n" + LISTA.map(function (x) { return (x.done ? "✓ " : "• ") + x.t; }).join("\n");
    if (navigator.share) navigator.share({ title: "Lista de compras", text: txt }).catch(function () {});
    else window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
  }
  function copiarPix() {
    var done = function () { toast("Chave Pix copiada 💛"); };
    if (navigator.clipboard) navigator.clipboard.writeText(PIX).then(done).catch(fb); else fb();
    function fb() { var t = document.createElement("textarea"); t.value = PIX; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} t.remove(); done(); }
  }

  function ligarHandlers() {
    app.querySelectorAll(".ing li").forEach(function (li) { li.addEventListener("click", function () { li.classList.toggle("done"); }); });
    app.querySelectorAll(".passos li").forEach(function (li) { li.addEventListener("click", function () { li.classList.toggle("done"); }); });
    app.querySelectorAll(".litem").forEach(function (li) {
      li.addEventListener("click", function () { var i = +li.dataset.idx; if (LISTA[i]) { LISTA[i].done = !LISTA[i].done; save("vk_lista", LISTA); li.classList.toggle("done"); } });
    });
    // timers
    app.querySelectorAll(".timer").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        if (b._iv) { clearInterval(b._iv); b._iv = null; b.classList.remove("on"); b.textContent = "⏲️ " + b.dataset.min + " min"; return; }
        var rem = parseInt(b.dataset.min, 10) * 60; b.classList.add("on");
        function tick() {
          var mm = Math.floor(rem / 60), ss = rem % 60;
          b.textContent = "⏲️ " + mm + ":" + (ss < 10 ? "0" : "") + ss;
          if (rem <= 0) { clearInterval(b._iv); b._iv = null; b.classList.remove("on"); b.textContent = "⏰ Tempo!"; try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {} toast("⏰ Tempo da receita!"); return; }
          rem--;
        }
        tick(); b._iv = setInterval(tick, 1000);
      });
    });
    // ações .acao (data-act)
    app.querySelectorAll(".acao[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.dataset.act, id = location.hash.split("/")[2], r = id ? byId(decodeURIComponent(id)) : null;
        if (act === "fav" && r) { toggleFav(r.id); render(); toast(isFav(r.id) ? "Guardada nas favoritas 💛" : "Removida das favoritas"); }
        else if (act === "ouvir" && r) falar(r);
        else if (act === "cozinha") cozinhaToggle(b);
        else if (act === "fmais") { FS = Math.min(1.6, FS + 0.12); save("vk_fs", FS); applyFs(); }
        else if (act === "fmenos") { FS = Math.max(0.85, FS - 0.12); save("vk_fs", FS); applyFs(); }
      });
    });
    // ações data-x
    app.querySelectorAll("[data-x]").forEach(function (b) {
      b.addEventListener("click", function () {
        var x = b.dataset.x, id = location.hash.split("/")[2], r = id ? byId(decodeURIComponent(id)) : null;
        if (x === "add-lista" && r) { addRecipeToLista(r); toast("Ingredientes na sua lista 🛒"); }
        else if (x === "add-semana" && r) { toggleSemana(r.id); render(); toast(isInSemana(r.id) ? "Adicionada à sua semana 📅" : "Tirada da semana"); }
        else if (x === "share" && r) compartilhar(r);
        else if (x === "print") window.print();
        else if (x === "lista-wpp") enviarLista();
        else if (x === "lista-print") window.print();
        else if (x === "lista-limpar") { if (confirm("Limpar toda a lista de compras?")) { LISTA = []; save("vk_lista", LISTA); render(); } }
        else if (x === "ger-lista") { var rs = SEMANA.map(byId).filter(Boolean); if (!rs.length) { toast("Sua semana está vazia"); return; } rs.forEach(addRecipeToLista); location.hash = "#/lista"; toast("Lista pronta da sua semana 🛒"); }
        else if (x === "sem-rm") { var did = b.dataset.id; SEMANA = SEMANA.filter(function (s) { return s !== did; }); save("vk_semana", SEMANA); render(); }
        else if (x === "sem-limpar") { if (confirm("Limpar a sua semana?")) { SEMANA = []; save("vk_semana", SEMANA); render(); } }
        else if (x === "copiar-pix") copiarPix();
        else if (x === "native-install") { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } else toast("Use o menu do navegador pra instalar 🙏"); }
        else if (x === "baixar-tudo") {
          if (navigator.serviceWorker && navigator.serviceWorker.controller) { navigator.serviceWorker.controller.postMessage("CACHE_ALL"); toast("Baixando as receitas… pode usar o app 💛"); }
          else toast("Abra o app mais uma vez e tente de novo 🙏");
        }
      });
    });
    // busca ao vivo
    var bq = document.getElementById("bq");
    if (bq) {
      bq.addEventListener("input", function () { document.getElementById("bres").innerHTML = telaBuscarCorpo(bq.value.trim()); ligarChips(); });
      ligarChips(); bq.focus(); var v = bq.value; bq.value = ""; bq.value = v;
    }
    var mic = document.getElementById("micbtn");
    if (mic && SR) mic.addEventListener("click", function () {
      var rec; try { rec = new SR(); } catch (e) { toast("Seu aparelho não permite buscar falando"); return; }
      rec.lang = "pt-BR"; rec.interimResults = false; rec.maxAlternatives = 1;
      mic.classList.add("on"); toast("Pode falar o que você quer cozinhar 🎤");
      rec.onresult = function (e) {
        var t = (e.results[0][0].transcript || "").trim();
        var b = document.getElementById("bq");
        if (b) { b.value = t; document.getElementById("bres").innerHTML = telaBuscarCorpo(t); ligarChips(); }
      };
      rec.onerror = function () { toast("Não consegui ouvir, tente de novo 🙏"); };
      rec.onend = function () { mic.classList.remove("on"); };
      try { rec.start(); } catch (e) {}
    });
  }
  function ligarChips() {
    app.querySelectorAll(".chip").forEach(function (ch) {
      ch.addEventListener("click", function () {
        var bq = document.getElementById("bq"); if (!bq) return;
        bq.value = ch.dataset.q; bq.focus();
        document.getElementById("bres").innerHTML = telaBuscarCorpo(bq.value.trim()); ligarChips();
      });
    });
  }

  // ---------- roteador ----------
  function parse() {
    var h = (location.hash || "#/").slice(1);
    var qi = h.indexOf("?"), query = ""; if (qi > -1) { query = decodeURIComponent(h.slice(qi + 1)); h = h.slice(0, qi); }
    return { seg: h.split("/").filter(Boolean), query: query };
  }
  function render() {
    var p = parse(), seg = p.seg, html, tab = "/";
    if (!seg.length) html = home();
    else if (seg[0] === "cat") html = telaCat(seg[1]);
    else if (seg[0] === "receita") html = telaReceita(decodeURIComponent(seg.slice(1).join("/")));
    else if (seg[0] === "buscar") { html = telaBuscar(p.query); tab = "/buscar"; }
    else if (seg[0] === "lista") { html = telaLista(); tab = "/lista"; }
    else if (seg[0] === "semana") html = telaSemana();
    else if (seg[0] === "instalar") html = telaInstalar();
    else if (seg[0] === "favoritos") { html = telaFavoritos(); tab = "/favoritos"; }
    else if (seg[0] === "vo") { html = telaVo(); tab = "/vo"; }
    else html = home();
    if (falando) { try { speechSynthesis.cancel(); } catch (e) {} falando = false; }
    app.innerHTML = html;
    nav.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.dataset.tab === tab); });
    window.scrollTo(0, 0);
    ligarHandlers();
  }

  // ---------- onboarding ----------
  function onboard() {
    if (ls("vk_onb", false)) return;
    save("vk_onb", true);
    if (isStandalone()) return;
    var m = document.createElement("div"); m.className = "modal";
    m.innerHTML = '<div class="cx"><img src="img/vo.webp" alt="" onerror="this.style.display=\'none\'">' +
      '<h2>Bem-vinda, minha querida!</h2>' +
      '<p>Quer deixar o caderninho de receitas na tela do seu celular, pra abrir com um toque só?</p>' +
      '<button class="btg" id="obinst">📲 Sim, me ensina</button>' +
      '<button class="btg ghost" id="obno" style="margin-top:10px">Agora não</button></div>';
    document.body.appendChild(m);
    m.querySelector("#obinst").addEventListener("click", function () { m.remove(); location.hash = "#/instalar"; });
    m.querySelector("#obno").addEventListener("click", function () { m.remove(); });
  }

  // ---------- boot ----------
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; });
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", function (e) {
    if (e.data && e.data.type === "cacheprog" && e.data.done >= e.data.total && e.data.total > 0) toast("Pronto! Agora o app funciona sem internet 💛");
  });
  applyFs();
  fetch("recipes.json").then(function (r) { return r.json(); }).then(function (d) {
    DATA = d; nav.hidden = false;
    window.addEventListener("hashchange", render);
    render(); onboard();
  }).catch(function () {
    app.innerHTML = '<div class="aviso">Não consegui abrir as receitas agora. Verifique sua internet e tente de novo.</div>';
  });
})();
