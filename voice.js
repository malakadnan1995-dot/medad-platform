const DB_NAME = 'medad-personal-voice-v1';
const DB_STORE = 'recordings';
const AUTO_ADVANCE_KEY = 'eduportal-audio-auto-advance';
let activeReader = null;
let dbPromise;
let audioContext;

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('التخزين المحلي غير مدعوم في هذا المتصفح.'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'pageKey' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('تعذّر فتح التخزين المحلي.'));
    });
  }
  return dbPromise;
}

async function getRecording(pageKey) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(pageKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveRecording(recording) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(recording);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecording(pageKey) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(pageKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function autoAdvanceEnabled() {
  return localStorage.getItem(AUTO_ADVANCE_KEY) === 'true';
}

export function renderAudioPanel(pageKey, generatedSrc = null) {
  const auto = autoAdvanceEnabled();
  const hasAi = Boolean(generatedSrc);
  return `<section class="audio-panel" data-audio-panel data-page-key="${pageKey}" data-generated-src="${generatedSrc || ''}" aria-label="قارئ الصفحة الصوتي">
    <span class="audio-brand-icon">${svg('sound')}</span>
    <div class="audio-copy"><strong data-audio-title>استمع إلى الصفحة</strong><small data-audio-status>${hasAi ? 'صوت عربي مولّد بالذكاء الاصطناعي' : 'قراءة صوتية عربية'}</small></div>
    <div class="audio-controls">
      <button type="button" class="audio-control audio-control--play" data-audio-action="toggle" aria-label="تشغيل القراءة الصوتية" title="تشغيل / إيقاف مؤقت">${svg('play')}</button>
      <button type="button" class="audio-control" data-audio-action="replay" aria-label="إعادة تشغيل الصوت" title="إعادة التشغيل">${svg('replay')}</button>
    </div>
    <div class="audio-timeline"><input type="range" class="audio-range" data-audio-seek min="0" max="1000" value="0" aria-label="موضع القراءة الصوتية" disabled /><span class="audio-time" data-audio-time>٠٠:٠٠ / ٠٠:٠٠</span></div>
    <div class="audio-options">
      <label class="audio-upload-label" title="ارفع تسجيلاً صوتياً لهذه الصفحة">${svg('upload')} <span data-upload-label>استبدل بتسجيلك</span><input class="audio-file-input" type="file" data-audio-upload accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm" aria-label="رفع ملف صوتي لاستبدال الصوت الآلي" /></label>
      <button type="button" class="audio-restore" data-audio-action="restore" hidden>${svg('restore')} استعادة الصوت الآلي</button>
      <label class="audio-auto-label" title="الانتقال بعد اكتمال القراءة الصوتية"><input type="checkbox" data-audio-auto ${auto ? 'checked' : ''} /> انتقال تلقائي بعد انتهاء الصوت</label>
    </div>
    <audio class="audio-element" data-audio-element preload="metadata" hidden></audio>
    <span class="sr-only" role="status" aria-live="polite" data-audio-live></span>
  </section><div class="audio-sync-line" aria-hidden="true"><span data-audio-sync-progress></span></div>`;
}

function svg(name) {
  const shapes = {
    play: '<path d="m9 6 10 6-10 6V6Z"/>', pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
    replay: '<path d="M3 11a9 9 0 0 1 15.4-6.4L21 7"/><path d="M21 3v4h-4M21 13a9 9 0 0 1-15.4 6.4L3 17"/><path d="M3 21v-4h4"/>',
    sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/>',
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 15v4h14v-4"/>',
    restore: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/>'
  };
  return `<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.sound}</svg>`;
}

function readableBlocks(panel) {
  return [...document.querySelectorAll('#page .audio-block')].filter((node) => !panel.contains(node));
}

function cleanSpeechText(node) {
  return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
}

function syncProgress(panel, ratio, charIndex = null) {
  const progress = panel.querySelector('[data-audio-sync-progress]');
  if (progress) progress.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  const blocks = readableBlocks(panel);
  if (!blocks.length) return;
  let activeIndex = 0;
  if (charIndex !== null && activeReader?.blocks === blocks) {
    let running = 0;
    activeIndex = blocks.findIndex((block) => {
      const length = cleanSpeechText(block).length + 1;
      if (charIndex < running + length) return true;
      running += length;
      return false;
    });
    if (activeIndex < 0) activeIndex = blocks.length - 1;
  } else {
    const lengths = blocks.map((block) => Math.max(cleanSpeechText(block).length, 20));
    const total = lengths.reduce((a, b) => a + b, 0);
    const target = Math.max(0, ratio) * total;
    let accumulated = 0;
    activeIndex = lengths.findIndex((length) => {
      accumulated += length;
      return target <= accumulated;
    });
    if (activeIndex < 0) activeIndex = blocks.length - 1;
  }
  blocks.forEach((block, i) => block.classList.toggle('is-reading', i === activeIndex));
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function announce(panel, message) {
  const live = panel.querySelector('[data-audio-live]');
  if (live) live.textContent = message;
}

function setPlaybackIcon(panel, playing) {
  const button = panel.querySelector('[data-audio-action="toggle"]');
  if (!button) return;
  button.innerHTML = svg(playing ? 'pause' : 'play');
  button.setAttribute('aria-label', playing ? 'إيقاف القراءة الصوتية مؤقتاً' : 'تشغيل القراءة الصوتية');
}

function stopReader({ clearHighlight = true } = {}) {
  if (!activeReader) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    return;
  }
  const { audio, panel, objectUrl } = activeReader;
  audio?.pause();
  if (audio) { audio.removeAttribute('src'); audio.load(); }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (clearHighlight && panel?.isConnected) {
    readableBlocks(panel).forEach((block) => block.classList.remove('is-reading'));
    const progress = panel.querySelector('[data-audio-sync-progress]');
    if (progress) progress.style.width = '0%';
    setPlaybackIcon(panel, false);
  }
  activeReader = null;
}

export async function setupAudioReader(pageKey, generatedSrc = null) {
  const panel = document.querySelector('[data-audio-panel]');
  if (!panel) return;
  stopReader();
  const audio = panel.querySelector('[data-audio-element]');
  const seek = panel.querySelector('[data-audio-seek]');
  const timeLabel = panel.querySelector('[data-audio-time]');
  const restore = panel.querySelector('[data-audio-action="restore"]');
  const title = panel.querySelector('[data-audio-title]');
  const status = panel.querySelector('[data-audio-status]');
  const uploadLabel = panel.querySelector('[data-upload-label]');
  const token = Symbol(pageKey);
  const blocks = readableBlocks(panel);
  const text = blocks.map(cleanSpeechText).filter(Boolean).join('. ');
  activeReader = { token, pageKey, panel, audio, seek, timeLabel, blocks, text, generatedSrc, mode: 'speech', playing: false, objectUrl: null, ended: false };
  try {
    const recording = await getRecording(pageKey);
    if (!activeReader || activeReader.token !== token || !panel.isConnected) return;
    if (recording?.blob) {
      const objectUrl = URL.createObjectURL(recording.blob);
      activeReader.objectUrl = objectUrl;
      activeReader.mode = 'file';
      audio.src = objectUrl;
      title.textContent = 'تسجيلك الصوتي';
      status.textContent = recording.name || 'تسجيل خاص محفوظ على هذا الجهاز';
      uploadLabel.textContent = 'استبدل التسجيل';
      restore.hidden = false;
      seek.disabled = false;
    } else if (generatedSrc) {
      activeReader.mode = 'file';
      audio.src = generatedSrc;
      title.textContent = 'استمع إلى الصفحة';
      status.textContent = 'صوت عربي مولّد بالذكاء الاصطناعي';
      uploadLabel.textContent = 'استبدل بتسجيلك';
      restore.hidden = true;
      seek.disabled = false;
    } else {
      activeReader.mode = 'speech';
      title.textContent = 'استمع إلى الصفحة';
      status.textContent = 'صوت عربي من قارئ الجهاز';
      restore.hidden = true;
      seek.disabled = true;
    }
  } catch (error) {
    console.warn('Audio storage unavailable', error);
    status.textContent = 'يمكن تشغيل القراءة أو رفع تسجيل لهذا الجهاز';
    activeReader.mode = 'speech';
  }

  audio.addEventListener('loadedmetadata', () => {
    if (!panel.isConnected) return;
    if (Number.isFinite(audio.duration)) {
      timeLabel.textContent = `${formatTime(0)} / ${formatTime(audio.duration)}`;
      seek.disabled = false;
    }
  });
  audio.addEventListener('timeupdate', () => {
    if (activeReader?.token !== token) return;
    const duration = audio.duration || 0;
    if (duration) {
      const ratio = audio.currentTime / duration;
      seek.value = String(Math.round(ratio * 1000));
      timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
      syncProgress(panel, ratio);
    }
  });
  audio.addEventListener('ended', () => finishReader(token));
  audio.addEventListener('error', () => {
    if (!panel.isConnected || !generatedSrc || activeReader?.objectUrl) return;
    status.textContent = 'تعذّر تحميل الصوت؛ استخدم القراءة الصوتية أو ارفع تسجيلاً';
    announce(panel, 'تعذّر تحميل الملف الصوتي لهذه الصفحة.');
  });
}

function finishReader(token) {
  if (!activeReader || activeReader.token !== token) return;
  const { panel, pageKey, mode } = activeReader;
  activeReader.playing = false;
  activeReader.ended = true;
  setPlaybackIcon(panel, false);
  syncProgress(panel, 1);
  if (activeReader.seek && mode === 'file') activeReader.seek.value = '1000';
  announce(panel, 'اكتملت القراءة الصوتية.');
  document.dispatchEvent(new CustomEvent('eduportal:readerended', { detail: { pageKey } }));
}

function playDeviceSpeech(reader) {
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) {
    announce(reader.panel, 'ميزة القراءة الصوتية غير متاحة في هذا المتصفح.');
    reader.panel.querySelector('[data-audio-status]').textContent = 'الصوت غير متاح في هذا المتصفح';
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(reader.text || 'لا يوجد نص لقراءته في هذه الصفحة.');
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((item) => /^ar-JO/i.test(item.lang)) || voices.find((item) => /^ar/i.test(item.lang));
  utterance.lang = voice?.lang || 'ar-JO';
  if (voice) utterance.voice = voice;
  utterance.rate = 0.94;
  utterance.pitch = 1;
  utterance.onstart = () => {
    if (activeReader?.token !== reader.token) return;
    reader.playing = true;
    setPlaybackIcon(reader.panel, true);
    announce(reader.panel, 'بدأت القراءة الصوتية.');
  };
  utterance.onboundary = (event) => {
    if (activeReader?.token !== reader.token) return;
    const ratio = reader.text.length ? event.charIndex / reader.text.length : 0;
    syncProgress(reader.panel, ratio, event.charIndex);
    reader.panel.querySelector('[data-audio-time]').textContent = `${Math.round(ratio * 100)}% · قراءة مباشرة`;
  };
  utterance.onend = () => finishReader(reader.token);
  utterance.onerror = (event) => {
    if (event.error === 'canceled' || event.error === 'interrupted' || activeReader?.token !== reader.token) return;
    reader.playing = false;
    setPlaybackIcon(reader.panel, false);
    reader.panel.querySelector('[data-audio-status]').textContent = 'الصوت المحلي غير متاح؛ ارفع تسجيلاً لهذه الصفحة';
    announce(reader.panel, 'لم يتوفر صوت عربي على هذا الجهاز. يمكنك رفع تسجيل صوتي لهذه الصفحة.');
  };
  reader.utterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function startPlayback(reader, restart = false) {
  if (!reader || !reader.panel.isConnected) return;
  if (reader.mode === 'file') {
    if (restart || reader.ended) reader.audio.currentTime = 0;
    reader.audio.play().then(() => {
      reader.playing = true;
      reader.ended = false;
      setPlaybackIcon(reader.panel, true);
      announce(reader.panel, 'بدأت القراءة الصوتية.');
    }).catch(() => {
      reader.panel.querySelector('[data-audio-status]').textContent = 'اضغط تشغيل للسماح بقراءة الصوت';
      announce(reader.panel, 'تعذّر تشغيل الصوت، حاول الضغط على التشغيل مجدداً.');
    });
    return;
  }
  if (restart || reader.ended) {
    window.speechSynthesis.cancel();
    reader.ended = false;
    playDeviceSpeech(reader);
  } else if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  } else if (!window.speechSynthesis.speaking) {
    playDeviceSpeech(reader);
  }
}

async function handleAudioClick(event) {
  const button = event.target.closest('[data-audio-action]');
  if (!button) return;
  const action = button.dataset.audioAction;
  if (action === 'toggle') {
    if (!activeReader) return;
    if (activeReader.playing) {
      if (activeReader.mode === 'file') activeReader.audio.pause();
      else window.speechSynthesis.pause();
      activeReader.playing = false;
      setPlaybackIcon(activeReader.panel, false);
      announce(activeReader.panel, 'أُوقفت القراءة الصوتية مؤقتاً.');
    } else startPlayback(activeReader);
  } else if (action === 'replay') {
    if (activeReader) startPlayback(activeReader, true);
  } else if (action === 'restore') {
    const panel = button.closest('[data-audio-panel]');
    if (!panel) return;
    const pageKey = panel.dataset.pageKey;
    try {
      await deleteRecording(pageKey);
      const src = panel.dataset.generatedSrc || null;
      await setupAudioReader(pageKey, src);
      announce(panel, src ? 'تمت استعادة القراءة الآلية لهذه الصفحة.' : 'تم حذف التسجيل الشخصي من هذه الصفحة.');
    } catch {
      announce(panel, 'تعذّر حذف الملف من التخزين المحلي.');
    }
  }
}

document.addEventListener('click', handleAudioClick);
document.addEventListener('change', async (event) => {
  if (event.target.matches('[data-audio-auto]')) {
    localStorage.setItem(AUTO_ADVANCE_KEY, String(event.target.checked));
    const panel = event.target.closest('[data-audio-panel]');
    if (panel) announce(panel, event.target.checked ? 'سيتم الانتقال تلقائياً بعد انتهاء الصوت.' : 'تم إيقاف الانتقال التلقائي.');
    return;
  }
  if (!event.target.matches('[data-audio-upload]')) return;
  const input = event.target;
  const panel = input.closest('[data-audio-panel]');
  const file = input.files?.[0];
  if (!panel || !file) return;
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|webm|aac|flac)$/i.test(file.name)) {
    announce(panel, 'اختر ملفاً صوتياً صالحاً.'); input.value = ''; return;
  }
  if (file.size > 50 * 1024 * 1024) {
    announce(panel, 'حجم الملف يتجاوز الحد الأقصى وهو ٥٠ ميغابايت.'); input.value = ''; return;
  }
  try {
    const pageKey = panel.dataset.pageKey;
    await saveRecording({ pageKey, blob: file, name: file.name, type: file.type, savedAt: Date.now() });
    await setupAudioReader(pageKey, panel.dataset.generatedSrc || null);
    announce(panel, `حُفظ تسجيل ${file.name} لهذه الصفحة على هذا الجهاز، واستُبدل به الصوت الآلي.`);
  } catch {
    announce(panel, 'تعذّر حفظ التسجيل. قد تكون مساحة التخزين المحلية غير متاحة.');
  }
  input.value = '';
});
document.addEventListener('input', (event) => {
  if (!event.target.matches('[data-audio-seek]') || !activeReader || activeReader.mode !== 'file') return;
  const duration = activeReader.audio.duration;
  if (Number.isFinite(duration)) activeReader.audio.currentTime = (Number(event.target.value) / 1000) * duration;
});

export function playAnswerEffect(isCorrect) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const tones = isCorrect ? [660, 880] : [330, 247];
    tones.forEach((frequency, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + index * (isCorrect ? .105 : .16);
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(isCorrect ? .12 : .08, start + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, start + (isCorrect ? .20 : .24));
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.start(start); osc.stop(start + (isCorrect ? .22 : .26));
    });
  } catch { /* الصوت المؤثر تجميلي، ولا يعطّل اختبار الإجابة. */ }
}

export function stopPageAudio() { stopReader(); }
