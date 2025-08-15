/* Kompatibel luas (tanpa fitur ES6):
   - var & function, tidak ada arrow / template literal
   - scaling canvas mengikuti devicePixelRatio
   - probabilitas: ZONK 85, PERMEN 7, SNACK 6, KEYCHAIN+LANYARD 1.5, DOORPRIZE 0.5
*/
(function(){
  // ---- Data roda (tanpa "+1 PERMEN", SPECIAL SPIN -> DOORPRIZE) ----
  var entries = [
    "ZONK","PERMEN","Lanyard","DOORPRIZE",
    "PERMEN","SNACK","ZONK","Keychain",
    "DOORPRIZE","SNACK","PERMEN","DOORPRIZE",
    "ZONK","PERMEN","DOORPRIZE","ZONK",
    "SNACK","ZONK"
  ];

  // ---- Warna ----
  var palette = {
    ZONK: "#ef4444",      // merah
    DOORPRIZE: "#eab308", // emas
    PERMEN: "#ec4899",    // pink
    SNACK: "#3b82f6",     // biru
    LANYARD: "#f97316",   // oranye
    KEYCHAIN: "#c4b5fd"   // ungu muda
  };

  // ---- DOM ----
  var canvas = document.getElementById("wheel");
  var spinBtn = document.getElementById("spinBtn");
  var modal = document.getElementById("resultModal");
  var resultText = document.getElementById("resultText");
  var continueBtn = document.getElementById("continueBtn");
  if (!canvas || !spinBtn || !modal || !resultText || !continueBtn) {
    alert("Elemen halaman belum lengkap."); return;
  }
  var ctx = canvas.getContext("2d");

  // ---- Konstanta & state ----
  var n = entries.length;
  var TAU = Math.PI * 2;
  var sector = TAU / n;
  var rotation = 0;
  var spinning = false;

  // ---- requestAnimationFrame polyfill ----
  var raf = window.requestAnimationFrame || function(cb){ return setTimeout(function(){ cb(Date.now()); }, 16); };
  var caf = window.cancelAnimationFrame || clearTimeout;

  // ---- Helpers ----
  function normalize(a){ a = a % TAU; return a < 0 ? a + TAU : a; }

  function colorFor(label){
    var L = String(label).toUpperCase();
    if (L.indexOf("ZONK") > -1) return palette.ZONK;
    if (L.indexOf("DOORPRIZE") > -1) return palette.DOORPRIZE;
    if (L.indexOf("PERMEN") > -1) return palette.PERMEN;
    if (L.indexOf("SNACK") > -1) return palette.SNACK;
    if (L.indexOf("LANYARD") > -1) return palette.LANYARD;
    if (L.indexOf("KEYCHAIN") > -1) return palette.KEYCHAIN;
    return "#999";
  }

  function wrapText(ctx, text, maxWidth, lineHeight){
    var words = String(text).split(" ");
    var line = "", lines = [];
    for (var i=0;i<words.length;i++){
      var test = (line ? line + " " : "") + words[i];
      var m = ctx.measureText(test);
      if (m.width > maxWidth && line){ lines.push(line); line = words[i]; }
      else { line = test; }
    }
    if (line) lines.push(line);
    var total = lines.length * lineHeight;
    ctx.translate(0, -total/2 + 6);
    for (var j=0;j<lines.length;j++){ ctx.fillText(lines[j], maxWidth, 0); ctx.translate(0, lineHeight); }
  }

  // ---- Resize & DPR scaling (menghindari canvas 0 & blur) ----
  function resizeCanvas(){
    var cssSize = Math.min(document.querySelector(".card").clientWidth - 32, 600);
    if (cssSize <= 0) cssSize = 300;
    canvas.style.width = cssSize + "px";
    canvas.style.height = cssSize + "px";

    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale semua gambar otomatis
    drawWheel(rotation);
  }

  // ---- Gambar roda ----
  function drawWheel(angle){
    if (typeof angle === "undefined") angle = rotation;
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);
    var r = Math.min(w, h) * 0.48;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.rotate(angle);

    for (var i=0;i<n;i++){
      var start = i * sector - Math.PI/2;
      var end = start + sector;

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,r,start,end);
      ctx.closePath();
      ctx.fillStyle = colorFor(entries[i]);
      ctx.fill();

      ctx.strokeStyle = "#0b0c10";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0,0,r,end,end);
      ctx.stroke();

      ctx.save();
      var mid = start + sector/2;
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Arial, sans-serif";
      wrapText(ctx, entries[i], r - 12, 20);
      ctx.restore();
    }

    // hub
    ctx.beginPath();
    ctx.fillStyle = "#111827";
    ctx.arc(0,0,r*0.18,0,TAU);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1f2937";
    ctx.stroke();

    ctx.restore();
  }

  // ---- Probabilitas spesifik ----
  // Kumulatif: ZONK 0.85, PERMEN 0.92, SNACK 0.98, KEY+LANY 0.995, DOORPRIZE 1.0
  function pickIndexBiased(){
    var groups = { ZONK:[], PERMEN:[], SNACK:[], KEYCHAIN:[], LANYARD:[], DOORPRIZE:[] };
    for (var i=0;i<n;i++){
      var L = entries[i].toUpperCase();
      if (L.indexOf("ZONK")>-1) groups.ZONK.push(i);
      else if (L.indexOf("PERMEN")>-1) groups.PERMEN.push(i);
      else if (L.indexOf("SNACK")>-1) groups.SNACK.push(i);
      else if (L.indexOf("KEYCHAIN")>-1) groups.KEYCHAIN.push(i);
      else if (L.indexOf("LANYARD")>-1) groups.LANYARD.push(i);
      else if (L.indexOf("DOORPRIZE")>-1) groups.DOORPRIZE.push(i);
    }

    var thresholds = [
      ["ZONK", 0.85],
      ["PERMEN", 0.92],
      ["SNACK", 0.98],
      ["KEY_LANY", 0.995],
      ["DOORPRIZE", 1.0]
    ];

    var r = Math.random(); var chosen = "DOORPRIZE";
    for (var t=0;t<thresholds.length;t++){ if (r < thresholds[t][1]) { chosen = thresholds[t][0]; break; } }

    var bag;
    if (chosen === "KEY_LANY"){
      bag = groups.KEYCHAIN.concat(groups.LANYARD);
      if (!bag.length) bag = groups.ZONK.length?groups.ZONK:(groups.PERMEN.length?groups.PERMEN:(groups.SNACK.length?groups.SNACK:groups.DOORPRIZE));
    } else {
      bag = groups[chosen] || [];
      if (!bag.length){
        bag = groups.ZONK.length?groups.ZONK:(groups.PERMEN.length?groups.PERMEN:(groups.SNACK.length?groups.SNACK:(groups.KEYCHAIN.concat(groups.LANYARD)).length?(groups.KEYCHAIN.concat(groups.LANYARD)):groups.DOORPRIZE));
      }
    }
    return bag[Math.floor(Math.random() * bag.length)];
  }

  // ---- Modal helpers ----
  function showModal(text){
    resultText.textContent = text;
    resultText.style.color = colorFor(text);
    modal.classList.add("show");
    modal.setAttribute("aria-hidden","false");
    continueBtn.focus();
  }
  function hideModal(){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");
    spinBtn.focus();
  }
  continueBtn.addEventListener("click", hideModal);
  modal.addEventListener("click", function(e){ if (e.target === modal) hideModal(); });
  window.addEventListener("keydown", function(e){ if (e.key === "Escape") hideModal(); });

  // ---- Spin animation ----
  function spin(){
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;

    var selected = pickIndexBiased();
    var targetAngle = normalize(-(selected + 0.5) * sector);
    var extraTurns = 4 + Math.floor(Math.random()*3); // 4..6 putaran
    var start = rotation;
    var endTarget = start + (extraTurns*TAU) + normalize(targetAngle - normalize(start));

    var duration = 4200;
    var startTime = Date.now();

    function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

    function frame(){
      var t = Math.min(1, (Date.now() - startTime) / duration);
      rotation = start + (endTarget - start) * easeOutCubic(t);
      drawWheel(rotation);
      if (t < 1) raf(frame);
      else {
        spinning = false;
        spinBtn.disabled = false;
        showModal(entries[selected]);
      }
    }
    raf(frame);
  }

  // ---- Init ----
  spinBtn.addEventListener("click", spin);
  // dukung tap di mobile
  spinBtn.addEventListener("touchstart", function(e){ e.preventDefault(); spin(); });

  resizeCanvas(); // set ukuran & gambar awal
  window.addEventListener("resize", resizeCanvas);
})();
