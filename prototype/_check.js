
// ---------- STATE ----------
const S = {
  charName: "Гріндік",
  energy: 50, coins: 120, streak: 3, level: 1,
  goal:null, exp:null, budget:null, time:null, mode:null,
  combo:0, comboBonus:0, errors:0, correct:0, comboBurnUsed:0,
  curLesson:0, doneLessons:0
};
const GR = {
  // Гріндік стани (емодзі-плейсхолдери — у проді SVG-персонаж)
  neutral:"😎", happy:"🤩", fire:"🔥😎", sad:"😒", laugh:"😂", think:"🤔", flex:"💪😎", caveman:"🦴"
};
const screen = document.getElementById('screen');
const nav = document.getElementById('nav');

function setNav(show, tab){
  nav.style.display = show ? 'flex' : 'none';
  if(tab) [...nav.children].forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
}
nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{
  const t=b.dataset.tab;
  if(t==='lessons') mainScreen();
  else if(t==='shop') shopScreen();
  else if(t==='rating') ratingScreen();
  else profileScreen();
});

// ---------- ONBOARDING ----------
function welcome(){
  setNav(false);
  screen.innerHTML = `
   <div class="pad center" style="flex:1">
     <div class="grind" id="g">${GR.neutral}</div>
     <h1 style="margin-top:18px">GRINDSET</h1>
     <p class="muted" style="margin-top:6px">Арбітраж трафіку. Без інфоциган.</p>
     <div class="bubble" style="margin-top:30px">Йо. Я <b>Гріндік</b>. Зараз швидко налаштуємо все під тебе. Без води.</div>
     <button class="btn" onclick="quiz(0)">Погнали</button>
     <div class="hint">UA · RU · EN</div>
   </div>`;
}

const QUIZ = [
 {q:"Яка твоя ціль?", react:GR.think, opts:[
   {e:"💰",t:"Хочу заробляти"},{e:"📈",t:"Розвиватись як спеціаліст"},
   {e:"🔍",t:"Просто цікаво що це"},{e:"💼",t:"Запустити свій бізнес через рекламу"}], key:"goal"},
 {q:"Твій досвід?", react:GR.think, opts:[
   {e:"🦴",t:"Нічого. Перший раз чую"},{e:"📱",t:"Чув, читав, але не запускав"},
   {e:"🚀",t:"Запускав, є базовий досвід"},{e:"⚡",t:"Вже працюю в темі"}], key:"exp"},
 {q:"Бюджет на старт?", react:GR.neutral, opts:[
   {e:"🪙",t:"Мінімум — до $50"},{e:"💵",t:"Стандарт — $100-300"},
   {e:"💎",t:"Серйозно — $300+"},{e:"🤷",t:"Поки не знаю"}], key:"budget"},
 {q:"Скільки часу в день?", react:GR.neutral, opts:[
   {e:"⚡",t:"5-10 хвилин"},{e:"📚",t:"15-20 хвилин"},
   {e:"🔥",t:"30+ хвилин"},{e:"💪",t:"Скільки треба"}], key:"time"},
 {q:"Як вчимось?", react:GR.happy, opts:[
   {e:"📖",t:"Спочатку теорія, потім практика"},{e:"⚡",t:"Паралельно теорія + практика"}], key:"mode"},
];
function quiz(i){
  setNav(false);
  if(i>=QUIZ.length){ return nameStep(); }
  const step=QUIZ[i];
  const segs=QUIZ.map((_,k)=>`<div class="seg ${k<=i?'on':''}"></div>`).join('');
  screen.innerHTML=`
   <div class="step-prog">${segs}</div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column">
     <div class="qchar"><div class="mini">${step.react}</div><h2 style="margin-top:6px">${step.q}</h2></div>
     <div class="opts" id="opts">
       ${step.opts.map((o,k)=>`<div class="opt" data-k="${k}" onclick="pick(${i},${k})"><span class="em">${o.e}</span>${o.t}</div>`).join('')}
     </div>
     <button class="btn" id="next" disabled onclick="quiz(${i+1})">Далі</button>
   </div>`;
}
function pick(i,k){
  S[QUIZ[i].key]=QUIZ[i].opts[k].t;
  document.querySelectorAll('#opts .opt').forEach(o=>o.classList.toggle('sel',+o.dataset.k===k));
  document.getElementById('next').disabled=false;
}
function nameStep(){
  screen.innerHTML=`
   <div class="pad center" style="flex:1">
     <div class="grind">${GR.happy}</div>
     <h2 style="margin-top:16px">Як мене звати?</h2>
     <p class="muted">Дай мені ім'я. Будемо гріндити разом.</p>
     <input class="name" id="nm" value="Гріндік" maxlength="14">
     <button class="btn" onclick="setName()">Готово</button>
   </div>`;
}
function setName(){
  const v=document.getElementById('nm').value.trim();
  if(v) S.charName=v;
  diagnostic();
}

// ---------- DIAGNOSTIC ----------
function diagnostic(){
  // визначаємо стартовий стан персонажа за відповіддю про досвід
  let charState=GR.caveman, lvlName="Неандерталець";
  if(S.exp && S.exp.includes("Чув")){charState="🧠";lvlName="Гомо Сапієнс";}
  else if(S.exp && (S.exp.includes("Запускав")||S.exp.includes("працюю"))){charState="⚡";lvlName="Ранній Цивілізатор";}
  screen.innerHTML=`
   <div class="pad center" style="flex:1">
     <div class="grind">${charState}</div>
     <div class="lvl" style="color:var(--gold);font-weight:700;margin-top:6px">Старт: ${lvlName}</div>
     <h2 style="margin-top:18px">Діагностичний тест</h2>
     <p class="muted">10-15 питань щоб точно зрозуміти твій рівень і зібрати трек. Пропустиш — підемо з базового.</p>
     <div class="bubble">Не парся за помилки. Це не іспит — це налаштування маршруту.</div>
     <button class="btn" onclick="mainScreen()">Пройти тест</button>
     <button class="btn ghost" onclick="mainScreen()" style="margin-top:10px">Пропустити → базовий трек</button>
   </div>`;
}

// ---------- MAIN SCREEN ----------
function topbar(){
  return `<div class="topbar">
    <span class="stat course">FB АРБІТРАЖ</span>
    <span class="stat" style="color:var(--fire)">🔥<small>${S.streak}</small></span>
    <span class="stat" style="color:var(--gold)">🪙<small>${S.coins}</small></span>
    <span class="stat" style="color:var(--accent)">⚡<small>${S.energy}</small></span>
  </div>`;
}
const LESSONS=[
 {t:"Що таке арбітраж трафіку", off:""},
 {t:"Екосистема: хто кому платить", off:"off-r"},
 {t:"Медіабаєр і його день", off:"off-r"},
 {t:"Моделі оплати: CPA / CPL / CPS", off:""},
 {t:"Чому Facebook — головний канал", off:"off-l"},
 {t:"Доходи і математика новачка", off:"off-l"},
];
function mainScreen(){
  setNav(true,'lessons');
  let lvlTitle = ["Щойно дізнався що є арбітраж","Вже читав про це в телеграмі","Злив перший бюджет на навчання"][Math.min(S.level-1,2)]||"Junior. Реально вміє";
  const nodes=LESSONS.map((l,i)=>{
    let cls='lock', em='🔒';
    if(i<S.doneLessons){cls='done';em='✓';}
    else if(i===S.doneLessons){cls='cur';em='▶';}
    return `<div class="modtag" style="${i===0?'':'display:none'}">МОДУЛЬ 01 · ЩО ТАКЕ АРБІТРАЖ</div>
      <div class="node ${cls} ${l.off}" onclick="${cls==='lock'?'':`startLesson(${i})`}">${em}
        <span class="tag">${l.t}</span></div>`;
  }).join('');
  screen.innerHTML=`
   ${topbar()}
   <div class="screen" style="overflow:visible">
     <div class="path">
       <div class="char-hero">
         <div class="grind" style="font-size:70px">${S.level<2?GR.caveman:GR.neutral}</div>
         <div style="font-weight:800;margin-top:6px">${S.charName}</div>
         <div class="lvl">Lvl ${S.level} — «${lvlTitle}»</div>
       </div>
       ${nodes}
     </div>
   </div>`;
}

// ---------- LESSON ENGINE ----------
const LESSON_DATA = {
 title:"Урок 1.1 — Що таке арбітраж трафіку",
 steps:[
  { layer:1, type:"choice",
    q:"Що в двох словах робить арбітражник трафіку?",
    char:GR.think,
    opts:["Купує товари оптом і перепродає дорожче",
          "Купує рекламу дешевше, ніж отримує з партнерки за дію",
          "Створює власні товари і продає їх",
          "Інвестує в акції рекламних компаній"],
    a:1,
    okMsg:"Точно. Купив трафік дешевше — отримав за дію дорожче. Різниця = твоє.",
    noMsg:"Не. Арбітраж = різниця між ціною трафіку і виплатою за дію." },

  { layer:1, type:"fill",
    q:"Заповни ланцюг екосистеми:",
    char:GR.neutral,
    template:["Рекламодавець → ", " → Арбітражник → Трафік"],
    opts:["Партнерська мережа","Банк","Податкова"],
    a:0,
    okMsg:"Так. Партнерка — посередник між рекламодавцем і тобою.",
    noMsg:"Ні. Між рекламодавцем і тобою стоїть партнерська мережа." },

  { layer:1, type:"choice",
    q:"Модель CPA — це оплата за що?",
    char:GR.think,
    opts:["За кожен клік по рекламі","За цільову дію (напр. підтверджене замовлення)",
          "За показ реклами 1000 разів","За відсоток від продажу щомісяця"],
    a:1,
    okMsg:"Вірно. CPA = Cost Per Action. Платять за дію, не за клік.",
    noMsg:"CPA = Cost Per Action — оплата за цільову дію, а не за клік чи показ." },

  { layer:2, type:"choice",
    q:"Сценарна задача — порахуй у голові:",
    char:GR.fire,
    scenario:"Офер платить <b>$12</b> за підтверджене замовлення (CPA). Ти відкрутив <b>$300</b> реклами і отримав <b>30 лідів</b>, з яких підтвердили <b>20</b>.",
    sub:"Який твій результат?",
    opts:["+$60 у плюс","−$60 у мінус","Рівно в нуль","+$300 у плюс"],
    a:0,
    okMsg:"Красава. 20×$12 = $240 виплата − $300 витрат = ... стоп. Дивись пояснення нижче 👇",
    noMsg:"Рахуємо разом нижче 👇",
    explain:"20 підтверджених × $12 = $240. Витрати $300. $240 − $300 = <b>−$60</b>. Це мінус — правильна відповідь була «−$60». Перший запуск часто в мінус, поки вчишся. Норма." ,
    a:1, // коригуємо нижче
  },
 ]
};
// fix: третя сценарна — правильна −$60
LESSON_DATA.steps[3].a=1;
LESSON_DATA.steps[3].okMsg="Точно. 20×$12=$240 − $300 = −$60. Перший запуск часто в мінус — це норма, поки вчишся.";

let LS = {idx:0, answered:false, badSeg:[]};
function startLesson(i){
  S.curLesson=i; LS={idx:0,answered:false,badSeg:[]};
  S.combo=0;S.errors=0;S.correct=0;S.comboBonus=0;S.comboBurnUsed=0;
  renderStep();
}
function renderStep(){
  setNav(false);
  const total=LESSON_DATA.steps.length;
  const st=LESSON_DATA.steps[LS.idx];
  const pct=(LS.idx/total)*100;
  const segFill = LS.badSeg.includes(LS.idx)
     ? `<div class="fillbad" style="width:${100/total}%"></div>` : '';
  let body='';
  if(st.type==='choice'){
    body=`<div class="opts" id="opts">
      ${st.opts.map((o,k)=>`<div class="opt" data-k="${k}" onclick="answer(${k})">${o}</div>`).join('')}</div>`;
  } else if(st.type==='fill'){
    body=`<div style="font-size:17px;line-height:2;margin:8px 0 14px">
        ${st.template[0]}<span id="blank" style="display:inline-block;min-width:120px;border-bottom:2px dashed var(--accent);color:var(--accent);font-weight:700;text-align:center">____</span>${st.template[1]}</div>
      <div class="opts" id="opts">
      ${st.opts.map((o,k)=>`<div class="opt" data-k="${k}" onclick="answer(${k})">${o}</div>`).join('')}</div>`;
  }
  screen.innerHTML=`
   <div class="lhead">
     <button class="x" onclick="mainScreen()">✕</button>
     <div class="pbar"><div class="fill" style="width:${pct}%"></div>${segFill}</div>
     <div class="combo">${S.combo>0?'🔥 x'+S.combo:''}</div>
   </div>
   <div class="lbody">
     <div class="layer-tag">${st.layer===1?'ШАР 1 · РОЗУМІННЯ':'ШАР 2 · ЗАСТОСУВАННЯ'}</div>
     <div class="qchar"><div class="mini" id="mini">${st.char}</div><h2 style="margin-top:4px">${st.q}</h2></div>
     ${st.scenario?`<div class="scenario">${st.scenario}${st.sub?`<div style="margin-top:8px;font-weight:700;color:var(--txt)">${st.sub}</div>`:''}</div>`:''}
     ${body}
     <div class="feedback" id="fb"></div>
     <button class="btn" id="cont" style="display:none" onclick="nextStep()">Далі</button>
   </div>`;
}
function answer(k){
  if(LS.answered) return;
  LS.answered=true;
  const st=LESSON_DATA.steps[LS.idx];
  const opts=document.querySelectorAll('#opts .opt');
  const mini=document.getElementById('mini');
  const fb=document.getElementById('fb');
  const ok = k===st.a;
  opts.forEach(o=>{
    const kk=+o.dataset.k;
    if(kk===st.a) o.classList.add('correct');
    if(kk===k && !ok) o.classList.add('wrong');
    o.onclick=null;
  });
  if(st.type==='fill'){ document.getElementById('blank').textContent=st.opts[st.a]; }
  if(ok){
    S.correct++; S.combo++;
    S.comboBonus=Math.min(20, S.combo*2);
    S.coins+=5;
    mini.textContent = S.combo>=3?GR.fire:GR.happy;
    mini.style.transform="scale(1.2)";
    fb.className="feedback ok show";
    fb.innerHTML=`<span class="big">${S.combo>=3?'🔥':'👍'}</span><div>${st.okMsg}${st.explain&&ok?'<br><span style="font-weight:400;color:var(--txt)">'+st.explain+'</span>':''}</div>`;
  } else {
    S.errors++;
    LS.badSeg.push(LS.idx);
    const burnLeft = S.comboBurnUsed<2;
    S.combo=0; S.comboBonus=0;
    mini.textContent = [GR.laugh,GR.sad][S.errors%2];
    mini.style.transform="rotate(-8deg)";
    fb.className="feedback no show";
    fb.innerHTML=`<span class="big">👎</span><div>${st.noMsg}${st.explain?'<br><span style="font-weight:400;color:var(--txt)">'+st.explain+'</span>':''}
      ${burnLeft?'<br><span style="font-size:12px;color:var(--gold)">💡 Комбо згоріло. Можна відмінити за перегляд реклами (залишилось '+(2-S.comboBurnUsed)+').</span>':''}</div>`;
  }
  // оновити комбо-індикатор
  document.querySelector('.combo').innerHTML = S.combo>0?'🔥 x'+S.combo:'';
  document.getElementById('cont').style.display='block';
}
function nextStep(){
  LS.idx++; LS.answered=false;
  if(LS.idx>=LESSON_DATA.steps.length) return results();
  renderStep();
}

// ---------- RESULTS ----------
function results(){
  setNav(false);
  if(S.curLesson===S.doneLessons) S.doneLessons++;
  const accuracy=Math.round(S.correct/(S.correct+S.errors)*100);
  const base=20;
  const bonusCoins=Math.round(base*S.comboBonus/100);
  const totalCoins=base+bonusCoins+S.correct*5;
  const perfect = S.errors===0;
  if(S.doneLessons>=2) S.level=2;
  const achievement = perfect ? `
    <div class="ach"><span class="em">😎</span><div>
      <div style="font-weight:800">Бездоганний тест!</div>
      <div class="muted" style="font-size:13px">Золоті сонцезахисні окуляри — ексклюзив, іншим способом не отримати.</div>
    </div>`:'';
  screen.innerHTML=`
   <div class="pad center" style="flex:1">
     <div class="confetti">${perfect?'🎉😎🎉':'✅'}</div>
     <h1 style="margin-top:10px">${perfect?'Ідеально!':'Урок пройдено'}</h1>
     <p class="muted">${perfect?'Жодної помилки. Ти ростеш, красава.':'Норм. Помилки — частина процесу.'}</p>
     ${achievement}
     <div class="reward">🪙 +${totalCoins}</div>
     <div style="width:100%;margin-top:6px">
       <div class="rstat"><span>Вірних відповідей</span><b style="color:var(--accent)">${S.correct}</b></div>
       <div class="rstat"><span>Помилок</span><b style="color:${S.errors?'var(--red)':'var(--accent)'}">${S.errors}</b></div>
       <div class="rstat"><span>Точність</span><b>${accuracy}%</b></div>
       <div class="rstat"><span>Макс. комбо-бонус</span><b style="color:var(--fire)">+${S.comboBonus}%</b></div>
     </div>
     <div style="margin-top:14px">
       ${S.errors? '<span class="pill">📌 Уточнити: математика новачка</span>':'<span class="pill">🏆 Топ 12% за швидкістю</span>'}
     </div>
     <div class="bubble" style="margin-top:18px">Наступний: <b>${LESSONS[S.doneLessons]?LESSONS[S.doneLessons].t:'Модуль завершено!'}</b></div>
     <button class="btn" onclick="mainScreen()">Забрати ${totalCoins} 🪙</button>
   </div>`;
}

// ---------- SHOP ----------
function shopScreen(){
  setNav(true,'shop');
  const items=[
    {e:"⚡",n:"+20 енергії",p:40},{e:"🔋",n:"Повне відновлення енергії",p:90},
    {e:"❄️",n:"Заморозка стріку",p:60},{e:"🛡️",n:"Захист комбо ×3",p:50},
    {e:"💡",n:"Підказка в завданні",p:25},{e:"✖️2",n:"Подвійні коїни на урок",p:80},
    {e:"📦",n:"Додаткові матеріали",p:150},{e:"🎨",n:"Кастомізація персонажа",p:120},
  ];
  screen.innerHTML=`${topbar()}<div class="pad" style="padding-bottom:90px">
    <h2>Магазин</h2><p class="muted" style="margin-bottom:14px">Витрачай коїни з розумом.</p>
    ${items.map(it=>`<div class="opt" style="cursor:default">
      <span class="em">${it.e}</span><div style="flex:1">${it.n}</div>
      <span class="pill" style="margin:0">🪙 ${it.p}</span></div>`).join('')}
  </div>`;
}
// ---------- RATING ----------
function ratingScreen(){
  setNav(true,'rating');
  const league=[
    {n:"Maksym",xp:1240,me:false},{n:"olha_traf",xp:1100,me:false},
    {n:S.charName+" (ти)",xp:980,me:true},{n:"buyer_99",xp:870,me:false},
    {n:"NoLeads",xp:640,me:false},
  ];
  screen.innerHTML=`${topbar()}<div class="pad" style="padding-bottom:90px">
    <h2>🏆 Срібна ліга</h2>
    <p class="muted" style="margin-bottom:6px">До золотої ліги — 2 місця. Не зупиняйся.</p>
    <div class="modtag">ТИЖНЕВИЙ РЕЙТИНГ · 4 дні залишилось</div>
    ${league.map((p,i)=>`<div class="fieldrow" style="${p.me?'color:var(--accent);font-weight:800':''}">
      <span>${i+1}. ${p.n}</span><b>${p.xp} XP</b></div>`).join('')}
  </div>`;
}
// ---------- PROFILE ----------
function profileScreen(){
  setNav(true,'profile');
  screen.innerHTML=`${topbar()}<div class="pad" style="padding-bottom:90px">
    <div class="center">
      <div class="grind" style="font-size:64px">${S.level<2?GR.caveman:GR.neutral}</div>
      <div style="font-weight:800;font-size:18px;margin-top:8px">${S.charName}</div>
      <div class="lvl" style="color:var(--gold);font-size:13px">Lvl ${S.level} — «${S.level<2?'Щойно дізнався що є арбітраж':'Злив перший бюджет на навчання'}»</div>
      <span class="pill" style="margin-top:8px">📊 Потенційний дохід: росте</span>
    </div>
    <div class="label" style="margin-top:24px">Прогрес</div>
    <div class="fieldrow"><span>Уроків пройдено</span><b>${S.doneLessons} / 42</b></div>
    <div class="fieldrow"><span>Стрік</span><b style="color:var(--fire)">🔥 ${S.streak} дні</b></div>
    <div class="fieldrow"><span>Надолуження помилок</span><b style="color:${S.errors?'var(--red)':'var(--accent)'}">${S.errors?'1 тема':'—'}</b></div>
    <div class="label" style="margin-top:20px">Налаштування</div>
    <div class="fieldrow"><span>Мова</span><b>UA ▾</b></div>
    <div class="fieldrow"><span>Підписка</span><b style="color:var(--muted)">Безкоштовна ▾</b></div>
    <div class="fieldrow"><span>Сповіщення</span><b>Увімк.</b></div>
    <button class="btn ghost" style="margin-top:20px" onclick="welcome()">↺ Перезапустити демо</button>
  </div>`;
}

welcome();
