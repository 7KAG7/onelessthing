async function getOutfit() {
  const city = document.getElementById('city').value.trim();
  const gender = document.getElementById('gender').value;
  if (!city) return alert('Enter a city');
  const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}&gender=${encodeURIComponent(gender)}`);
  if (!res.ok) {
    const err = await res.json();
    return alert('Error: ' + (err.error || res.statusText));
  }
  const data = await res.json();
  renderResult(data);
}

function renderResult(data) {
  const weather = data.weather;
  const tiles = data.tiles;
  const summary = document.getElementById('weatherSummary');
  summary.innerText = `Location: ${weather.name} — ${Math.round(weather.main.temp)}°F, ${weather.weather[0].description}`;

  const container = document.getElementById('tiles');
  container.innerHTML = '';

  const order = ['head', 'torso', 'bottoms', 'footwear', 'accessories'];
  order.forEach((slot) => {
    const v = tiles[slot];
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach((it) => container.appendChild(tileElement(slot, it)));
    } else {
      container.appendChild(tileElement(slot, v));
    }
  });
}

function tileElement(slot, item) {
  const el = document.createElement('div');
  el.className = 'tile';
  const name = document.createElement('div');
  name.className = 'tile-name';
  name.innerText = item.name;
  const reason = document.createElement('div');
  reason.className = 'tile-reason';
  reason.innerText = item.reason || '';
  const link = document.createElement('a');
  link.href = item.link || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.innerText = 'Buy';

  el.appendChild(name);
  el.appendChild(reason);
  el.appendChild(link);
  return el;
}

document.getElementById('get').addEventListener('click', getOutfit);
