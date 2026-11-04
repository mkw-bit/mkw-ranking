'use strict';
const $ = id => document.getElementById(id);
let dataset = null;
const text = value => document.createTextNode(String(value ?? ''));
function elt(tag, cls, value) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value !== undefined) el.append(text(value));
  return el;
}
function cell(tag, cls, value) { return elt(tag, cls, value); }
function decorate(value) {
  const v = String(value ?? '');
  const b = elt('span', 'badge');
  if (/^(1st|1位)/i.test(v)) b.classList.add('first');
  else if (/^(2nd|2位)/i.test(v)) b.classList.add('second');
  else if (/^(3rd|3位)/i.test(v)) b.classList.add('third');
  else if (/\bSF\b|Semifinal/i.test(v)) b.classList.add('sf');
  else if (/^A\s*\//.test(v)) b.classList.add('absent');
  else b.classList.add('other');
  b.append(text(v)); return b;
}
function headers() {
  const tr = document.createElement('tr');
  for (const [label, cls] of [['順位','sticky-rank'],['プレイヤー名','sticky-name'],['累計Points','num'],['大会数','num']]) tr.append(cell('th',cls,label));
  for (const ev of dataset.events) {
    const th = elt('th','',ev.name);
    const sm = elt('small','',ev.date);
    th.append(sm);tr.append(th);
  }
  $('thead').replaceChildren(tr);
}
function render() {
  if (!dataset) return;
  const q = $('search').value.trim().toLocaleLowerCase();
  const sort = $('sort').value;
  const lim = $('limit').value;
  let rows = dataset.players.filter(p => p.name.toLocaleLowerCase().includes(q));
  rows.sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name,'ja') :
    sort === 'participations' ? b.participations-a.participations || a.rank-b.rank : a.rank-b.rank);
  const total = rows.length;
  if (lim !== 'all') rows = rows.slice(0,Number(lim));
  const frag = document.createDocumentFragment();
  for (const p of rows) {
    const tr = document.createElement('tr');
    tr.append(cell('td','sticky-rank rank',p.rank));
    tr.append(cell('td','sticky-name',p.name));
    tr.append(cell('td','num points',Number(p.points).toLocaleString('ja-JP')));
    tr.append(cell('td','num',p.participations));
    for (const v of p.results) {const td=elt('td');td.append(decorate(v));tr.append(td);}
    frag.append(tr);
  }
  $('tbody').replaceChildren(frag);
  $('shown').textContent=`${total.toLocaleString()}名が該当 / ${rows.length.toLocaleString()}名を表示`;
  $('status').textContent=total ? '' : '該当するプレイヤーはいません。';
}
async function start() {
  try {
    const resp = await fetch('ranking.json',{cache:'no-store'});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    dataset=await resp.json();
    if (!Array.isArray(dataset.players) || !Array.isArray(dataset.events)) throw new Error('JSON形式が正しくありません');
    $('players-count').textContent=dataset.players.length.toLocaleString('ja-JP');
    $('events-count').textContent=dataset.events.length.toLocaleString('ja-JP');
    $('updated').textContent=dataset.updated ? 'データ更新：'+dataset.updated : '更新日未設定';
    if (!dataset.players.length) $('status').textContent='公開データがまだありません。export_ranking.pyを実行してranking.jsonを作成してください。';
    headers();render();
    for (const id of ['search','sort','limit']) $(id).addEventListener(id === 'search'?'input':'change',render);
  } catch (e) {
    $('tbody').replaceChildren(cell('tr','', ''));
    $('status').textContent='ランキングを読み込めませんでした。ranking.jsonの配置を確認してください。';
    console.error(e);
  }
}
start();
