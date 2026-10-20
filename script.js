(function () {
  'use strict';

  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var optionsEl = document.getElementById('options');
  var spinBtn = document.getElementById('spinBtn');
  var shuffleBtn = document.getElementById('shuffleBtn');
  var resultEl = document.getElementById('result');
  var historyEl = document.getElementById('history');
  var clearHistoryBtn = document.getElementById('clearHistory');
  var errorEl = document.getElementById('error');
  var countEl = document.getElementById('count');

  var PALETTE = ['#ff4d8d', '#ffc83d', '#21c1b0', '#7b5cff', '#ff8a3d', '#4cc9f0',
    '#06d6a0', '#ef476f', '#f9c74f', '#b5179e', '#3a86ff', '#f3722c'];
  var MAX = 12;
  var STORE_OPTIONS = 'decision-wheel.options';
  var STORE_HISTORY = 'decision-wheel.history';

  var rotation = 0;
  var spinning = false;
  var history = [];

  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      return;
    }
  }

  function rawOptions() {
    return optionsEl.value.split('\n')
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });
  }

  function getOptions() {
    return rawOptions().slice(0, MAX);
  }

  function updateCount() {
    countEl.textContent = rawOptions().length + ' / ' + MAX;
  }

  function saveOptions() {
    writeStore(STORE_OPTIONS, rawOptions());
  }

  function setError(message) {
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
    }
  }

  function draw() {
    var rect = canvas.getBoundingClientRect();
    var size = Math.max(rect.width, 240);
    var cx = size / 2;
    var cy = size / 2;
    var radius = size / 2 - 10;

    ctx.clearRect(0, 0, size, size);
    var list = getOptions();

    if (!list.length) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff3e2';
      ctx.fill();
      ctx.strokeStyle = '#ffd9b3';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#b08a6a';
      ctx.font = '600 16px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add options to build the wheel', cx, cy);
      return;
    }

    var seg = (Math.PI * 2) / list.length;
    var fontSize = Math.max(11, Math.min(20, 240 / list.length));

    for (var i = 0; i < list.length; i += 1) {
      var start = i * seg + rotation;
      var end = start + seg;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      var mid = start + seg / 2;
      var norm = ((mid % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      var flipped = norm > Math.PI / 2 && norm < Math.PI * 1.5;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);
      if (flipped) ctx.rotate(Math.PI);
      ctx.fillStyle = '#241b3a';
      ctx.font = '700 ' + fontSize + 'px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = flipped ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      var label = list[i];
      if (label.length > 18) label = label.slice(0, 17) + '…';
      ctx.fillText(label, flipped ? -(radius - 16) : radius - 16, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = '#fffaf2';
    ctx.fill();
    ctx.strokeStyle = '#241b3a';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var size = Math.max(rect.width, 240);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function winnerFrom(list) {
    var seg = (Math.PI * 2) / list.length;
    var pointerAngle = -Math.PI / 2;
    var local = ((pointerAngle - rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    var index = Math.floor(local / seg) % list.length;
    return list[index];
  }

  function renderHistory() {
    historyEl.textContent = '';
    if (!history.length) {
      var empty = document.createElement('li');
      empty.className = 'history-empty';
      empty.textContent = 'No spins recorded yet.';
      historyEl.appendChild(empty);
      return;
    }
    history.forEach(function (item, index) {
      var li = document.createElement('li');
      var rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(index + 1);
      var text = document.createElement('span');
      text.textContent = item;
      li.appendChild(rank);
      li.appendChild(text);
      historyEl.appendChild(li);
    });
  }

  function addHistory(winner) {
    history.unshift(winner);
    if (history.length > 8) history = history.slice(0, 8);
    writeStore(STORE_HISTORY, history);
    renderHistory();
  }

  function announce(winner) {
    resultEl.textContent = winner;
    resultEl.classList.remove('pop');
    void resultEl.offsetWidth;
    resultEl.classList.add('pop');
  }

  function spin() {
    if (spinning) return;
    var list = getOptions();
    if (list.length < 2) {
      setError('Add at least 2 options before spinning.');
      return;
    }
    if (rawOptions().length > MAX) {
      setError('You have more than ' + MAX + ' options. Only the first ' + MAX + ' are used.');
      return;
    }
    setError('');
    spinning = true;
    spinBtn.disabled = true;

    var seg = (Math.PI * 2) / list.length;
    var targetIndex = Math.floor(Math.random() * list.length);
    var jitter = (0.15 + Math.random() * 0.7) * seg;
    var pointerAngle = -Math.PI / 2;
    var desiredLocal = targetIndex * seg + jitter;
    var currentLocal = ((pointerAngle - rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    var delta = ((currentLocal - desiredLocal) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    var turns = 6 + Math.floor(Math.random() * 4);
    var total = turns * Math.PI * 2 + delta;
    var startRotation = rotation;
    var startTime = null;
    var duration = 4200;

    function frame(ts) {
      if (startTime === null) startTime = ts;
      var t = Math.min((ts - startTime) / duration, 1);
      rotation = startRotation + total * easeOutQuart(t);
      draw();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation = startRotation + total;
        draw();
        spinning = false;
        spinBtn.disabled = false;
        var winner = winnerFrom(list);
        announce(winner);
        addHistory(winner);
      }
    }

    requestAnimationFrame(frame);
  }

  function shuffle() {
    var list = rawOptions();
    if (list.length < 2) {
      setError('Add at least 2 options before shuffling.');
      return;
    }
    for (var i = list.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    optionsEl.value = list.join('\n');
    saveOptions();
    updateCount();
    setError('');
    draw();
  }

  optionsEl.addEventListener('input', function () {
    saveOptions();
    updateCount();
    setError('');
    draw();
  });

  spinBtn.addEventListener('click', spin);
  shuffleBtn.addEventListener('click', shuffle);

  clearHistoryBtn.addEventListener('click', function () {
    history = [];
    writeStore(STORE_HISTORY, history);
    renderHistory();
    resultEl.textContent = 'Ready when you are';
    resultEl.classList.remove('pop');
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== ' ' && event.code !== 'Space') return;
    var tag = (event.target && event.target.tagName ? event.target.tagName : '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;
    event.preventDefault();
    spin();
  });

  var saved = readStore(STORE_OPTIONS, null);
  optionsEl.value = Array.isArray(saved) && saved.length
    ? saved.join('\n')
    : ['Pizza', 'Sushi', 'Tacos', 'Burgers', 'Salad', 'Noodles'].join('\n');

  var savedHistory = readStore(STORE_HISTORY, []);
  history = Array.isArray(savedHistory) ? savedHistory.slice(0, 8) : [];
  renderHistory();
  updateCount();

  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(resizeCanvas);
})();
