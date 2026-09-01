// QA harness for the EMMI patient-knowledge audit. Drives the real chat composer so every answer
// comes from the same code path a patient uses. Loaded only in local development.
window.__ALL = JSON.parse(localStorage.getItem('__auditAfter') || '[]');
window.__tick = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
window.__spin = async ms => { const t = Date.now(); while (Date.now() - t < ms) await window.__tick(); };
window.__THINK = /^(EMMI is thinking|EMMI está pensando|EMMI ap reflechi)/i;
window.__lastTurnId = () => { const l = JSON.parse(sessionStorage.getItem('itera.emmi.prototype.audit.v1') || '[]'); const t = (l[l.length - 1]?.answerTurns) || []; return t.length ? t[t.length - 1] : null; };
window.__ready = async (ms = 25000) => { const t = Date.now(); while (Date.now() - t < ms) { const i = document.querySelector('#assistant-question'); if (i && !i.disabled) return true; await window.__spin(80); } return false; };
window.__ask1 = async function (q, timeoutMs = 30000) {
  const sel = '.assistant-message.assistant .assistant-message-bubble';
  const form = document.querySelector('.assistant-question-form'), inp = document.querySelector('#assistant-question');
  if (!form || !inp || inp.disabled) return { q, a: null, error: 'busy_or_missing' };
  const before = document.querySelectorAll(sel).length;
  inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); form.requestSubmit();
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await window.__tick();
    const n = document.querySelectorAll(sel);
    if (n.length > before) {
      const txt = n[n.length - 1].innerText.replace(/^EMMI\s*/, '').trim();
      const box = document.querySelector('#assistant-question');
      if (txt && !window.__THINK.test(txt) && box && !box.disabled) {
        await window.__spin(150);
        const f = document.querySelectorAll(sel);
        const t2 = f[f.length - 1].innerText.replace(/^EMMI\s*/, '').trim();
        if (t2 && !window.__THINK.test(t2)) return { q, a: t2, ms: Date.now() - t0 };
      }
    }
  }
  return { q, a: null, error: 'timeout' };
};
window.__emmiAsk = async (q, t = 30000) => { await window.__ready(); let r = await window.__ask1(q, t); if (r.error) { await window.__ready(); await window.__spin(500); r = await window.__ask1(q, t); } return r; };
window.__runSync = async (pairs, gap = 120) => {
  const t0 = Date.now(); const errs = [];
  for (const p of pairs) {
    const id = p[0], q = p[1];
    const before = window.__lastTurnId()?.turnId || '';
    const r = await window.__emmiAsk(q);
    let tr = window.__lastTurnId(); if (tr && tr.turnId === before) tr = null;
    window.__ALL.push({ id, q, a: r.a, err: r.error || null, intent: tr?.intent || null, mode: tr?.responseMode || null, model: tr?.modelVersion || null, tools: tr?.toolCalls || [], chunks: tr?.knowledgeChunkIds || [], rq: tr?.retrievalQuery || null, screen: tr?.screenId || null });
    if (r.error) errs.push(id);
    if (window.__ALL.length % 10 === 0) localStorage.setItem('__auditAfter', JSON.stringify(window.__ALL));
    await window.__spin(gap);
  }
  localStorage.setItem('__auditAfter', JSON.stringify(window.__ALL));
  return { ms: Date.now() - t0, n: pairs.length, errs };
};
window.__view = (pred, len = 260) => {
  const map = new Map(); const out = [];
  for (const r of window.__ALL.filter(pred)) {
    const txt = r.a || ('ERR:' + (r.err || '')); let code = map.get(txt);
    const base = { id: r.id, m: (r.mode || '-').replace('DETERMINISTIC_', 'D_').replace('_GROUNDED', '_G'), i: r.intent, t: (r.tools || []).join(',') };
    if (!code) { code = 'U' + (map.size + 1); map.set(txt, code); out.push(Object.assign(base, { c: code, a: txt.slice(0, len) })); }
    else out.push(Object.assign(base, { a: '==' + code }));
  }
  return JSON.stringify(out);
};
window.__open = async () => {
  if (document.querySelector('#assistant-question')) return 'already';
  const b = [...document.querySelectorAll('button')].filter(x => /Ask EMMI|Preguntar a EMMI|Mande EMMI|Open EMMI/i.test((x.textContent || '') + ' ' + (x.getAttribute('aria-label') || '')));
  if (!b.length) return 'no-button';
  b[0].click();
  for (let i = 0; i < 90; i++) { await window.__spin(120); if (document.querySelector('#assistant-question')) return 'opened'; }
  return 'timeout';
};
window.__reset = () => {
  localStorage.setItem('__auditAfter', JSON.stringify(window.__ALL));
  localStorage.removeItem('itera.emmi.conversation.v1');
  sessionStorage.removeItem('itera.emmi.conversation.session.v1');
  sessionStorage.removeItem('itera.emmi.prototype.audit.v1');
  location.reload();
};
window.__boot = async () => {
  const clickText = async re => { const b = [...document.querySelectorAll('button')].find(x => re.test((x.textContent || '').trim())); if (b) { b.click(); await window.__spin(1200); return true; } return false; };
  await clickText(/^Save and continue$/); await clickText(/^Go to My Care$/);
  return window.__open();
};
'harness ready';
