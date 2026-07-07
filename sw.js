"use strict";
var CACHE = "vk-v2"; // versão nova: descarta qualquer cache antigo (inclusive erros 404 salvos por engano)
var CORE = [
  "./",
  "./index.html",
  "./app.css",
  "./fonts.css",
  "./app.js",
  "./manifest.json",
  "./placeholder.svg",
  "./recipes.json"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      }).catch(function () { return cached; });
    })
  );
});

// baixar tudo (fotos das receitas), disparado pelo botão "Baixar tudo" em app.js
self.addEventListener("message", function (e) {
  if (e.data !== "CACHE_ALL") return;
  var client = e.source;
  fetch("recipes.json").then(function (r) { return r.json(); }).then(function (d) {
    var urls = [];
    (d.cats || []).forEach(function (c) { if (c.capa) urls.push(c.capa); });
    (d.recipes || []).forEach(function (r) { if (r.foto) urls.push(r.foto); });
    var total = urls.length, done = 0;
    if (!total) { client && client.postMessage({ type: "cacheprog", done: 1, total: 1 }); return; }
    caches.open(CACHE).then(function (c) {
      urls.reduce(function (p, url) {
        return p.then(function () {
          return fetch(url).then(function (resp) { if (resp && resp.ok) { return c.put(url, resp); } }).catch(function () {}).then(function () {
            done++;
            client && client.postMessage({ type: "cacheprog", done: done, total: total });
          });
        });
      }, Promise.resolve());
    });
  });
});
