import { curriculum, lessons, totalLessons, totalQuestions } from './curriculum.js';
import { autoAdvanceEnabled, playAnswerEffect, renderAudioPanel, setupAudioReader, stopPageAudio } from './voice.js';

const STORAGE_KEY = 'eduportal-learning-v1';
const iconPaths = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/><path d="M8.5 11h4.6M10.8 8.7v4.6"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  arrow: '<path d="M19 12H5m7 7-7-7 7-7"/>',
  searchSmall: '<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 15 1 2.5 2 1-2 1-1 2.5-1-2.5-2-1 2-1 1-2.5Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 19V5m0 14h17"/><path d="m7 15 4-4 3 2 5-6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="m8.2 13-1 8 4.8-2.7 4.8 2.7-1-8"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2"/>',
  play: '<path d="m9 6 10 6-10 6V6Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  bookOpen: '<path d="M12 7v14m0-14C9 4 5 4 3 5v13c2-1 6-1 9 2m0-13c3-3 7-3 9-2v13c-2-1-6-1-9 2"/>',
  sunMoon: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18V3Z"/>'
};

const icon = (name, size = 20, extra = '') => `<svg class="icon ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.book}</svg>`;
const allQuizIndexes = () => curriculum.quiz.map((_, i) => i);

function emptyState() {
  return { completedLessons: [], quizSelections: {}, quizConfirmed: {}, theme: 'light' };
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return emptyState();
    return {
      completedLessons: Array.isArray(saved.completedLessons) ? saved.completedLessons.filter((id) => lessons.some((lesson) => lesson.id === id)) : [],
      quizSelections: saved.quizSelections && typeof saved.quizSelections === 'object' ? saved.quizSelections : {},
      quizConfirmed: saved.quizConfirmed && typeof saved.quizConfirmed === 'object' ? saved.quizConfirmed : {},
      theme: saved.theme === 'dark' ? 'dark' : 'light'
    };
  } catch { return emptyState(); }
}

let state = readState();
document.body.dataset.theme = state.theme;
const $ = (selector) => document.querySelector(selector);

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { announce('تعذّر حفظ التقدم في هذا المتصفح.'); }
}

function announce(message) {
  const region = $('#toastRegion');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}

function parseRoute() {
  const route = location.hash.replace(/^#\/?/, '');
  if (!route || route === 'home') return { type: 'home' };
  const [type, value] = route.split('/');
  if (type === 'lesson' && lessons.some((lesson) => lesson.id === value)) return { type, value };
  if (type === 'quiz') {
    const index = Number(value || 0);
    if (Number.isInteger(index) && index >= 0 && index < totalQuestions) return { type, value: index };
  }
  if (type === 'results') return { type };
  return { type: 'home' };
}

function completedCount() { return state.completedLessons.length; }
function courseProgress() { return Math.round((completedCount() / totalLessons) * 100); }
function quizProgress() { return Object.keys(state.quizConfirmed).filter((key) => Number(key) >= 0 && Number(key) < totalQuestions).length; }
function firstIncompleteQuestion() { return allQuizIndexes().find((i) => state.quizConfirmed[i] === undefined) ?? 0; }

function renderSidebar(route) {
  const progress = courseProgress();
  const lessonNav = curriculum.modules.map((module, moduleIndex) => {
    const firstLesson = module.lessons[0];
    const activeModule = route.type === 'lesson' && module.lessons.some((lesson) => lesson.id === route.value);
    const lessonLinks = module.lessons.map((lesson) => {
      const done = state.completedLessons.includes(lesson.id);
      const active = route.type === 'lesson' && route.value === lesson.id;
      return `<a class="lesson-link ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}" data-lesson-link data-search-title="${escapeAttr(lesson.title)}" href="#/lesson/${lesson.id}" ${active ? 'aria-current="page"' : ''}>
        <span class="lesson-status">${done ? icon('check', 13) : `<span>${moduleIndex + 1}.${module.lessons.indexOf(lesson) + 1}</span>`}</span>
        <span class="lesson-link-text">${lesson.title}</span><span class="lesson-duration">${lesson.duration}</span>
      </a>`;
    }).join('');
    return `<section class="toc-module ${activeModule ? 'is-current' : ''}" data-toc-module>
      <a class="module-link" href="#/lesson/${firstLesson.id}"><span class="module-icon module-icon--${module.color}">${icon(module.icon, 17)}</span><span class="module-link-copy"><strong>${module.title}</strong><small>${module.lessons.length} دروس</small></span>${icon('chevron', 15, 'module-chevron')}</a>
      <div class="lesson-links">${lessonLinks}</div>
    </section>`;
  }).join('');
  const quizActive = route.type === 'quiz' || route.type === 'results';
  $('#sidebar').innerHTML = `
    <div class="sidebar-head">
      <a class="brand" href="#/home" aria-label="العودة إلى الصفحة الرئيسية">
        <span class="brand-mark"><img src="/assets/brand-mark.svg" alt="" /></span>
        <span class="brand-name"><strong>مِداد</strong><small>مساحة للتعلّم الواعي</small></span>
      </a>
      <button class="icon-button sidebar-close" type="button" data-action="close-menu" aria-label="إغلاق القائمة">${icon('close', 20)}</button>
    </div>
    <div class="sidebar-course">
      <span class="course-label">المسار الحالي</span>
      <a href="#/home" class="sidebar-course-title">${curriculum.title}</a>
      <span class="sidebar-course-subtitle">${curriculum.level} <span class="dot-separator">·</span> ٣ وحدات</span>
    </div>
    <div class="toc-heading"><span>محتوى المسار</span><span class="toc-count">${totalLessons} دروس</span></div>
    <nav class="toc-list" aria-label="التنقل بين الوحدات والدروس">
      <a class="home-link ${route.type === 'home' ? 'is-active' : ''}" href="#/home" ${route.type === 'home' ? 'aria-current="page"' : ''}>${icon('bookOpen', 17)}<span>نظرة عامة</span></a>
      ${lessonNav}
      <a class="quiz-link ${quizActive ? 'is-active' : ''}" href="#/quiz/${firstIncompleteQuestion()}" ${quizActive ? 'aria-current="page"' : ''}>
        <span class="quiz-link-icon">${icon('target', 18)}</span><span class="quiz-link-copy"><strong>الاختبار الختامي</strong><small>${totalQuestions} أسئلة قصيرة</small></span>${icon('chevron', 15, 'module-chevron')}
      </a>
    </nav>
    <div class="sidebar-bottom">
      <div class="sidebar-progress-head"><span>تقدّمك في المسار</span><strong>${progress}%</strong></div>
      <div class="progress-track" role="progressbar" aria-label="التقدم في الدروس" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div>
      <div class="sidebar-progress-note">أتممت ${completedCount()} من ${totalLessons} دروس</div>
      <button class="reset-link" type="button" data-action="reset-progress">${icon('refresh', 15)} إعادة ضبط التقدم</button>
    </div>`;
}

function escapeAttr(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function routeTitle(route) {
  if (route.type === 'home') return 'نظرة عامة';
  if (route.type === 'lesson') return lessons.find((lesson) => lesson.id === route.value)?.title || 'الدرس';
  if (route.type === 'quiz') return 'الاختبار الختامي';
  return 'نتيجتك';
}

function renderTopbar(route) {
  $('#topbar').innerHTML = `
    <div class="topbar-leading">
      <button class="icon-button menu-trigger" type="button" data-action="open-menu" aria-label="فتح فهرس المحتوى" aria-expanded="false">${icon('menu', 21)}</button>
      <div class="breadcrumbs"><span>مساري التعليمي</span>${icon('chevron', 14)}<strong>${routeTitle(route)}</strong></div>
    </div>
    <div class="topbar-actions">
      <label class="search-box">${icon('searchSmall', 17)}<span class="sr-only">ابحث في الدروس</span><input id="tocSearch" type="search" autocomplete="off" placeholder="ابحث في الدروس" /><kbd>⌘ K</kbd></label>
      <span class="topbar-divider"></span>
      <button class="icon-button theme-toggle" type="button" data-action="toggle-theme" aria-label="التبديل إلى ${state.theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}">${icon(state.theme === 'light' ? 'moon' : 'sun', 19)}</button>
      <span class="profile-avatar" aria-label="المتعلم">م</span>
    </div>`;
}

function progressBar(value, label) {
  return `<div class="progress-track ${label ? 'progress-track--wide' : ''}" role="progressbar" aria-label="${label || 'التقدم'}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value}%"></span></div>`;
}

function renderHome() {
  const continueLesson = lessons.find((lesson) => !state.completedLessons.includes(lesson.id)) || lessons[0];
  const nextTitle = completedCount() === totalLessons ? 'أعد زيارة أول درس' : completedCount() === 0 ? 'ابدأ رحلتك' : 'تابع من حيث وصلت';
  const cards = curriculum.modules.map((module, i) => {
    const done = module.lessons.filter((lesson) => state.completedLessons.includes(lesson.id)).length;
    const first = module.lessons[0];
    return `<a class="unit-card" href="#/lesson/${first.id}">
      <div class="unit-card-top"><span class="module-icon module-icon--${module.color}">${icon(module.icon, 19)}</span><span class="unit-number">٠${i + 1}</span></div>
      <h3>${module.title}</h3><p>${module.description}</p>
      <div class="unit-card-bottom"><span>${done} من ${module.lessons.length} دروس</span>${icon('arrow', 17)}</div>
    </a>`;
  }).join('');
  const percent = courseProgress();
  $('#page').innerHTML = `
    <section class="welcome-panel">
      <div class="welcome-copy audio-block">
        <span class="eyebrow"><span class="eyebrow-dot"></span> ${curriculum.level} <span class="eyebrow-divider">/</span> مهارات الحياة الرقمية</span>
        <h1>تعلّم بوعي.<br /><span>واستخدم المعرفة بثقة.</span></h1>
        <p class="welcome-description">${curriculum.subtitle}</p>
        <div class="hero-actions"><a class="button button-primary" href="#/lesson/${continueLesson.id}">${icon('play', 17)} ${nextTitle}</a><a class="text-button" href="#/lesson/${lessons.at(-1).id}">استكشف الوحدات ${icon('arrow', 16)}</a></div>
      </div>
      <div class="welcome-art" aria-hidden="true"><div class="art-orbit art-orbit--one"></div><div class="art-orbit art-orbit--two"></div><div class="art-paper"><span class="art-mini-mark">مِداد</span><span class="art-line art-line--strong"></span><span class="art-line"></span><span class="art-line art-line--short"></span><span class="art-check">${icon('check', 17)}</span><span class="art-stamp">${icon('spark', 20)}</span></div><span class="art-leaf art-leaf--one"></span><span class="art-leaf art-leaf--two"></span></div>
      <div class="hero-index"><span>٠١</span><span class="hero-index-line"></span><span>مسار من ٣ وحدات</span></div>
    </section>
    <section class="learning-status" aria-label="ملخص التقدم">
      <div class="status-intro"><span class="status-icon">${icon('chart', 19)}</span><div><strong>تقدّمك حتى الآن</strong><small>${completedCount() === 0 ? 'كل بداية تفتح باباً جديداً.' : `أتممت ${completedCount()} من أصل ${totalLessons} دروس.`}</small></div></div>
      <div class="status-progress">${progressBar(percent, 'نسبة إنجاز الدروس')}<div class="status-progress-label"><span>إنجاز المسار</span><strong>${percent}%</strong></div></div>
      <div class="status-stat"><span class="stat-value">${totalLessons.toLocaleString('ar')}</span><span>دروس عملية</span></div>
      <div class="status-stat"><span class="stat-value">${totalQuestions.toLocaleString('ar')}</span><span>أسئلة ختامية</span></div>
    </section>
    <section class="units-section">
      <div class="section-heading"><div><span class="section-kicker">خريطة التعلّم</span><h2>ثلاث خطوات نحو معرفة أرسخ</h2></div><span class="section-aside">تعلّم بالممارسة، خطوةً خطوة.</span></div>
      <div class="units-grid">${cards}</div>
    </section>
    <section class="start-strip"><span class="start-strip-icon">${icon('spark', 19)}</span><div><strong>التعلّم الجيد يُقاس بما تستطيع فعله</strong><span>كل درس ينتهي بخطوة عملية يمكنك تطبيقها اليوم.</span></div><a href="#/lesson/${continueLesson.id}">${completedCount() === 0 ? 'ابدأ الآن' : 'أكمل المسار'} ${icon('arrow', 16)}</a></section>`;
}

function renderBlock(block) {
  switch (block.type) {
    case 'lead': return `<p class="lesson-lead audio-block">${block.text}</p>`;
    case 'heading': return `<h2 class="lesson-heading audio-block">${block.text}</h2>`;
    case 'paragraph': return `<p class="lesson-paragraph audio-block">${block.text}</p>`;
    case 'list': return `<div class="lesson-list-block audio-block"><h3>${block.title}</h3><ul>${block.items.map((item) => `<li>${item}</li>`).join('')}</ul></div>`;
    case 'steps': return `<div class="steps-block audio-block"><h3>${block.title}</h3><ol>${block.items.map((item, i) => `<li><span class="step-number">${String(i + 1).padStart(2, '0')}</span><span>${item}</span></li>`).join('')}</ol></div>`;
    case 'figure': return `<figure class="lesson-figure audio-block"><img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt)}" loading="lazy" /><figcaption>${block.caption}</figcaption></figure>`;
    case 'callout': return `<aside class="callout callout--${block.tone} audio-block"><span class="callout-icon">${icon(block.tone === 'warning' ? 'shield' : block.tone === 'practice' ? 'target' : 'spark', 19)}</span><div><h3>${block.title}</h3><p>${block.text}</p></div></aside>`;
    default: return '';
  }
}

function renderLesson(lesson) {
  const index = lessons.findIndex((item) => item.id === lesson.id);
  const isDone = state.completedLessons.includes(lesson.id);
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;
  const moduleIndex = curriculum.modules.findIndex((module) => module.id === lesson.module.id);
  const coursePercent = Math.round((completedCount() / totalLessons) * 100);
  $('#page').innerHTML = `
    <section class="lesson-page">
      <div class="lesson-topline"><a href="#/home" class="back-overview">${icon('arrow', 15)} نظرة عامة</a><span class="lesson-counter">${String(index + 1).padStart(2, '0')} <span>/</span> ${String(totalLessons).padStart(2, '0')}</span></div>
      <header class="lesson-header"><span class="lesson-unit-tag"><span class="tag-dot tag-dot--${lesson.module.color}"></span> الوحدة ${String(moduleIndex + 1).padStart(2, '0')} <span>·</span> ${lesson.module.title}</span><h1>${lesson.title}</h1><p>${lesson.summary}</p><div class="lesson-meta"><span>${icon('clock', 16)} ${lesson.duration}</span><span>${icon('book', 16)} ${lesson.blocks.length} محاور</span>${isDone ? `<span class="done-meta">${icon('check', 15)} درس مكتمل</span>` : ''}</div></header>
      <div class="lesson-progress-row"><span>تقدّم المسار</span>${progressBar(coursePercent, 'التقدم العام في المسار')}<strong>${coursePercent}%</strong></div>
      <article class="lesson-article">${lesson.blocks.map(renderBlock).join('')}</article>
      <div class="lesson-complete-row"><div><strong>${isDone ? 'أحسنت، هذا الدرس مكتمل.' : 'وصلت إلى نهاية هذا الدرس.'}</strong><span>${isDone ? 'يمكنك المتابعة أو العودة إلى أي درس في أي وقت.' : 'ثبّت ما تعلمته، ثم انتقل إلى الخطوة التالية.'}</span></div><button type="button" class="button ${isDone ? 'button-complete' : 'button-secondary'}" data-action="complete-lesson" data-lesson-id="${lesson.id}">${isDone ? icon('check', 17) : icon('check', 17)} ${isDone ? 'تم الإكمال' : 'أنهيت هذا الدرس'}</button></div>
      <nav class="lesson-navigation" aria-label="التنقل بين الدروس">
        ${previous ? `<a class="lesson-nav-button lesson-nav-button--previous" href="#/lesson/${previous.id}"><span class="nav-arrow">${icon('arrow', 18)}</span><span><small>الدرس السابق</small><strong>${previous.title}</strong></span></a>` : `<a class="lesson-nav-button lesson-nav-button--previous" href="#/home"><span class="nav-arrow">${icon('arrow', 18)}</span><span><small>العودة إلى</small><strong>نظرة عامة</strong></span></a>`}
        ${next ? `<a class="lesson-nav-button lesson-nav-button--next" href="#/lesson/${next.id}" data-complete-on-next="${lesson.id}"><span><small>الدرس التالي</small><strong>${next.title}</strong></span><span class="nav-arrow">${icon('arrow', 18)}</span></a>` : `<a class="lesson-nav-button lesson-nav-button--next" href="#/quiz/0" data-complete-on-next="${lesson.id}"><span><small>اكتملت الوحدات</small><strong>اختبر ما تعلّمت</strong></span><span class="nav-arrow">${icon('arrow', 18)}</span></a>`}
      </nav>
    </section>`;
}

function renderQuiz(route) {
  const index = Number(route.value) || 0;
  const question = curriculum.quiz[index];
  const confirmed = state.quizConfirmed[index];
  const selected = confirmed !== undefined ? confirmed : state.quizSelections[index];
  const correct = confirmed !== undefined && confirmed === question.answer;
  const qProgress = Math.round((quizProgress() / totalQuestions) * 100);
  const options = question.options.map((option, i) => {
    const isChosen = selected === i;
    let classes = 'answer-option';
    if (isChosen) classes += ' is-selected';
    if (confirmed !== undefined && i === question.answer) classes += ' is-correct';
    if (confirmed !== undefined && isChosen && !correct) classes += ' is-incorrect';
    return `<button type="button" class="${classes} audio-block" role="radio" aria-checked="${isChosen}" ${confirmed !== undefined ? 'disabled' : ''} data-action="select-answer" data-choice="${i}"><span class="answer-marker">${confirmed !== undefined && i === question.answer ? icon('check', 14) : String.fromCharCode(0x0623 + i)}</span><span class="answer-copy">${option}</span>${isChosen && confirmed === undefined ? `<span class="selected-check">${icon('check', 15)}</span>` : ''}</button>`;
  }).join('');
  const tracker = curriculum.quiz.map((item, i) => {
    const answered = state.quizConfirmed[i] !== undefined;
    const right = answered && state.quizConfirmed[i] === item.answer;
    return `<a href="#/quiz/${i}" class="question-step ${i === index ? 'is-current' : ''} ${answered ? (right ? 'is-right' : 'is-wrong') : ''}" aria-label="السؤال ${String(i + 1).padStart(2, '0')}${answered ? (right ? '، إجابة صحيحة' : '، إجابة خاطئة') : ''}" ${i === index ? 'aria-current="step"' : ''}>${answered ? (right ? icon('check', 14) : '×') : String(i + 1).padStart(2, '0')}</a>`;
  }).join('');
  const isLast = index === totalQuestions - 1;
  $('#page').innerHTML = `
    <section class="quiz-page">
      <div class="quiz-topline"><a href="#/home" class="back-overview">${icon('arrow', 15)} نظرة عامة</a><span class="quiz-safe-note">${icon('lock', 14)} تقدمك محفوظ تلقائياً</span></div>
      <header class="quiz-header"><span class="section-kicker">المراجعة الختامية</span><h1>دع معرفتك تجيب.</h1><p>ثمانية أسئلة قصيرة لتراجع أهم ما مررت به في المسار.</p></header>
      <div class="quiz-layout">
        <div class="quiz-main-card">
          <div class="question-card-head"><span class="question-label">السؤال <strong>${String(index + 1).padStart(2, '0')}</strong> <i>من ${String(totalQuestions).padStart(2, '0')}</i></span><span class="question-points">اختيار واحد</span></div>
          <div class="question-progress">${progressBar(qProgress, 'تقدم الاختبار')}</div>
          <h2 class="question-text audio-block">${question.question}</h2>
          <div class="answer-list" role="radiogroup" aria-label="خيارات الإجابة">${options}</div>
          ${confirmed !== undefined ? `<div class="answer-feedback ${correct ? 'feedback--correct' : 'feedback--incorrect'}" role="status"><span class="feedback-icon">${icon(correct ? 'check' : 'refresh', 18)}</span><div><strong>${correct ? 'إجابة صحيحة، أحسنت.' : 'ليست هذه الإجابة.'}</strong><p>${correct ? question.explanation : `الإجابة الصحيحة: ${question.options[question.answer]}. ${question.explanation}`}</p></div></div>` : ''}
          <div class="question-actions">
            <button type="button" class="button button-primary confirm-answer" data-action="confirm-answer" ${selected === undefined || confirmed !== undefined ? 'disabled' : ''}>${icon('check', 17)} تأكيد الإجابة</button>
            ${confirmed !== undefined ? `<a class="button button-next-question" href="${isLast ? '#/results' : `#/quiz/${index + 1}`}">${isLast ? 'عرض النتيجة' : 'السؤال التالي'} ${icon('arrow', 16)}</a>` : ''}
          </div>
          ${index > 0 ? `<a href="#/quiz/${index - 1}" class="previous-question">${icon('arrow', 14)} العودة إلى السؤال السابق</a>` : ''}
        </div>
        <aside class="quiz-aside"><div class="quiz-aside-head"><span class="aside-icon">${icon('target', 19)}</span><div><strong>مسار الأسئلة</strong><small>اختر أي سؤال للمراجعة</small></div></div><div class="question-tracker" aria-label="الأسئلة">${tracker}</div><div class="tracker-legend"><span><i class="legend-dot legend-dot--done"></i> أُجيب عنه</span><span><i class="legend-dot"></i> لم يُجب عنه</span></div><div class="quiz-aside-progress"><div><span>إجابات مؤكدة</span><strong>${quizProgress()} / ${totalQuestions}</strong></div>${progressBar(qProgress, 'نسبة الأسئلة المؤكدة')}</div><div class="quiz-aside-note">لا يمكن تعديل الإجابة بعد تأكيدها. تنقّل بين الأرقام لمراجعة إجاباتك المؤكدة.</div></aside>
      </div>
    </section>`;
}

function scoreMessage(percent) {
  if (percent >= 90) return { title: 'إتقان رائع!', text: 'أظهرت فهماً راسخاً للمفاهيم. استمر في تطبيقها ومشاركة ما تعلّمته.', icon: 'award' };
  if (percent >= 75) return { title: 'أداء مميّز!', text: 'لديك أساس قوي. مراجعة النقاط التي أخطأت فيها ستضيف إلى ثقتك.', icon: 'spark' };
  if (percent >= 50) return { title: 'خطوة موفّقة.', text: 'أنجزت المسار، وكل محاولة تمنحك فهماً أعمق. راجع الدروس وعد إلى التقييم متى شئت.', icon: 'target' };
  return { title: 'بداية تستحق الفخر.', text: 'أكملت الرحلة وهذا بحد ذاته إنجاز. راجع الدروس بهدوء، ثم جرّب الاختبار مرة أخرى.', icon: 'bookOpen' };
}

function renderResults() {
  const correct = curriculum.quiz.reduce((count, question, i) => count + (state.quizConfirmed[i] === question.answer ? 1 : 0), 0);
  const incorrect = totalQuestions - correct;
  const percent = Math.round((correct / totalQuestions) * 100);
  const message = scoreMessage(percent);
  const review = curriculum.quiz.map((question, i) => {
    const right = state.quizConfirmed[i] === question.answer;
    return `<a class="review-row ${right ? 'review-row--right' : 'review-row--wrong'}" href="#/quiz/${i}"><span class="review-status">${icon(right ? 'check' : 'close', 15)}</span><span class="review-question"><small>السؤال ${String(i + 1).padStart(2, '0')}</small><strong>${question.question}</strong></span><span class="review-result">${right ? 'صحيحة' : 'تحتاج مراجعة'} ${icon('chevron', 14)}</span></a>`;
  }).join('');
  $('#page').innerHTML = `
    <section class="results-page">
      <div class="results-intro audio-block"><span class="section-kicker">اكتمل التقييم</span><h1>هذه ثمرة رحلتك.</h1><p>كل ما تعلمته خطوة يمكنك البناء عليها من اليوم.</p></div>
      <div class="result-main-card"><div class="result-score-wrap audio-block"><div class="score-ring" style="--score:${percent}"><div class="score-ring-inner"><span>${percent}<small>%</small></span><i>نتيجتك</i></div></div><div class="score-caption">من ${totalQuestions} أسئلة</div></div><div class="result-message audio-block"><span class="result-award">${icon(message.icon, 22)}</span><span class="section-kicker">${percent >= 75 ? 'تقييم المسار' : 'مواصلة التعلّم'}</span><h2>${message.title}</h2><p>${message.text}</p><div class="result-actions"><button type="button" class="button button-primary" data-action="retake-quiz">${icon('refresh', 16)} إعادة الاختبار</button><a href="#/home" class="button button-secondary">العودة إلى المسار ${icon('arrow', 16)}</a></div></div></div>
      <div class="result-stats"><div class="result-stat result-stat--right"><span class="result-stat-icon">${icon('check', 18)}</span><span><small>إجابات صحيحة</small><strong>${correct.toLocaleString('ar')}</strong></span></div><div class="result-stat result-stat--wrong"><span class="result-stat-icon">${icon('close', 18)}</span><span><small>إجابات خاطئة</small><strong>${incorrect.toLocaleString('ar')}</strong></span></div><div class="result-stat"><span class="result-stat-icon">${icon('book', 18)}</span><span><small>دروس مكتملة</small><strong>${completedCount().toLocaleString('ar')} / ${totalLessons.toLocaleString('ar')}</strong></span></div></div>
      <section class="review-section"><div class="section-heading"><div><span class="section-kicker">مراجعة الإجابات</span><h2>تعلّم من كل إجابة</h2></div><a class="text-button" href="#/quiz/0">العودة إلى الاختبار ${icon('arrow', 16)}</a></div><div class="review-list">${review}</div></section>
    </section>`;
}

function closeMenu() {
  document.body.classList.remove('sidebar-open');
  const trigger = document.querySelector('[data-action="open-menu"]');
  trigger?.setAttribute('aria-expanded', 'false');
}

function installPageAudio(route) {
  let pageKey;
  let generatedSrc = null;
  if (route.type === 'home') { pageKey = 'home'; generatedSrc = '/audio/overview.mp3'; }
  else if (route.type === 'lesson') {
    pageKey = `lesson:${route.value}`;
    generatedSrc = `/audio/${route.value}.mp3`;
  } else if (route.type === 'quiz') {
    pageKey = `quiz:${route.value}`;
    generatedSrc = `/audio/quiz-${route.value}.mp3`;
  } else pageKey = 'results';
  $('#page').insertAdjacentHTML('afterbegin', renderAudioPanel(pageKey, generatedSrc));
  setupAudioReader(pageKey, generatedSrc);
}

function render() {
  let route = parseRoute();
  if (route.type === 'results' && quizProgress() < totalQuestions) {
    location.hash = `#/quiz/${firstIncompleteQuestion()}`;
    return;
  }
  stopPageAudio();
  renderSidebar(route);
  renderTopbar(route);
  if (route.type === 'home') renderHome();
  else if (route.type === 'lesson') renderLesson(lessons.find((lesson) => lesson.id === route.value));
  else if (route.type === 'quiz') renderQuiz(route);
  else renderResults();
  installPageAudio(route);
  const search = $('#tocSearch');
  if (search) search.value = currentSearch;
  if (route.type !== 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMenu();
  updateSearchFilter(currentSearch);
}

let currentSearch = '';
function updateSearchFilter(query) {
  currentSearch = query;
  const normalized = query.trim().toLocaleLowerCase('ar');
  document.querySelectorAll('[data-toc-module]').forEach((module) => {
    const links = [...module.querySelectorAll('[data-lesson-link]')];
    let visible = 0;
    links.forEach((link) => {
      const show = !normalized || link.dataset.searchTitle.toLocaleLowerCase('ar').includes(normalized);
      link.hidden = !show;
      if (show) visible++;
    });
    module.hidden = visible === 0;
  });
}

function markLessonDone(id) {
  if (!state.completedLessons.includes(id)) {
    state.completedLessons.push(id);
    saveState();
    announce('تم حفظ إكمال الدرس.');
  }
}

function updateSelectedAnswer(choice) {
  document.querySelectorAll('.answer-option').forEach((option, index) => {
    const selected = index === choice;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
    option.querySelector('.selected-check')?.remove();
    if (selected) option.insertAdjacentHTML('beforeend', `<span class="selected-check">${icon('check', 15)}</span>`);
  });
  const confirm = document.querySelector('[data-action="confirm-answer"]');
  if (confirm) confirm.disabled = false;
}

document.addEventListener('eduportal:readerended', (event) => {
  if (!autoAdvanceEnabled()) return;
  const route = parseRoute();
  const pageKey = event.detail?.pageKey;
  if (route.type === 'home' && pageKey === 'home') {
    location.hash = `#/lesson/${lessons[0].id}`;
  } else if (route.type === 'lesson' && pageKey === `lesson:${route.value}`) {
    const index = lessons.findIndex((lesson) => lesson.id === route.value);
    markLessonDone(route.value);
    location.hash = index < lessons.length - 1 ? `#/lesson/${lessons[index + 1].id}` : `#/quiz/${firstIncompleteQuestion()}`;
  } else if (route.type === 'quiz' && pageKey === `quiz:${route.value}` && state.quizConfirmed[route.value] !== undefined) {
    const next = curriculum.quiz.findIndex((_, i) => state.quizConfirmed[i] === undefined);
    location.hash = next < 0 ? '#/results' : `#/quiz/${next}`;
  }
});

function handleAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'open-menu') {
    document.body.classList.add('sidebar-open');
    button.setAttribute('aria-expanded', 'true');
  } else if (action === 'close-menu') closeMenu();
  else if (action === 'toggle-theme') {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = state.theme;
    saveState();
    render();
    announce(state.theme === 'dark' ? 'تم تفعيل الوضع الداكن.' : 'تم تفعيل الوضع الفاتح.');
  } else if (action === 'complete-lesson') {
    markLessonDone(button.dataset.lessonId);
    render();
  } else if (action === 'confirm-answer') {
    const route = parseRoute();
    const index = Number(route.value);
    if (state.quizSelections[index] === undefined || state.quizConfirmed[index] !== undefined) return;
    state.quizConfirmed[index] = state.quizSelections[index];
    saveState();
    playAnswerEffect(state.quizConfirmed[index] === curriculum.quiz[index].answer);
    render();
    announce(state.quizConfirmed[index] === curriculum.quiz[index].answer ? 'إجابة صحيحة. تم حفظ الإجابة.' : 'إجابة غير صحيحة. تم حفظ الإجابة ولا يمكن تغييرها.');
  } else if (action === 'select-answer') {
    const route = parseRoute();
    const index = Number(route.value);
    if (state.quizConfirmed[index] !== undefined) return;
    state.quizSelections[index] = Number(button.dataset.choice);
    saveState();
    updateSelectedAnswer(state.quizSelections[index]);
  } else if (action === 'retake-quiz') {
    if (!window.confirm('ستُمسح إجابات الاختبار الحالي فقط. هل تريد البدء من جديد؟')) return;
    state.quizSelections = {};
    state.quizConfirmed = {};
    saveState();
    location.hash = '#/quiz/0';
  } else if (action === 'reset-progress') {
    if (!window.confirm('سيُمسح تقدم الدروس وإجابات الاختبار المحفوظة على هذا الجهاز. هل تريد المتابعة؟')) return;
    const theme = state.theme;
    state = { ...emptyState(), theme };
    saveState();
    location.hash = '#/home';
    render();
    announce('تمت إعادة ضبط التقدم.');
  }
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-action]')) { handleAction(event); return; }
  const nextLink = event.target.closest('[data-complete-on-next]');
  if (nextLink) markLessonDone(nextLink.dataset.completeOnNext);
  if (event.target.closest('#sidebar a')) closeMenu();
  if (event.target.id === 'sidebarBackdrop') closeMenu();
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'tocSearch') updateSearchFilter(event.target.value);
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('#tocSearch')?.focus();
  }
  if (event.key === 'Escape') closeMenu();
});
window.addEventListener('hashchange', render);

render();
