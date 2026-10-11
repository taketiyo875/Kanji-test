
/* 常用漢字マスター */
const DATA_URLS = [
  "https://cdn.jsdelivr.net/gh/mimneko/kanji-data@main/%E5%B8%B8%E7%94%A8%E6%BC%A2%E5%AD%97%E8%A1%A8%E6%9C%AC%E8%A1%A8.json",
  "https://raw.githubusercontent.com/mimneko/kanji-data/main/%E5%B8%B8%E7%94%A8%E6%BC%A2%E5%AD%97%E8%A1%A8%E6%9C%AC%E8%A1%A8.json"
];

const $ = (s) => document.querySelector(s);
let allKanji = [], filtered = [], shown = 0;
const PAGE_SIZE = 60;
let quizQuestions = [], questionIndex = 0, score = 0, locked = false;

let learned = new Set();
try {
  learned = new Set(JSON.parse(localStorage.getItem("kanji-master-learned") || "[]"));
} catch (_) {}

$("#learnedCount").textContent = learned.size;
renderAchievements();

function renderAchievements() {
  const n = learned.size;
  const badges = [
    {min:1,icon:"🌱",name:"はじめの一歩"},
    {min:50,icon:"📚",name:"ことばハンター"},
    {min:200,icon:"🐾",name:"にゃんこ博士"},
    {min:500,icon:"👑",name:"漢字マスター"}
  ];
  const root = $("#achievementBadges");
  if (!root) return;
  root.innerHTML = badges.map(b =>
    `<span class="achievement ${n >= b.min ? "unlocked" : "locked"}" title="${b.min}字以上学習で獲得"><span>${b.icon}</span>${b.name}${n >= b.min ? " ✓" : ""}</span>`
  ).join("");
}

function normalize(s) {
  return String(s || "").normalize("NFKC").toLowerCase().trim();
}

function readingsOf(item) {
  return Array.isArray(item.readings)
    ? item.readings
    : String(item.readings || "").split(/[、,／/]/).map(x => x.trim()).filter(Boolean);
}

function gradeLabel(item) {
  const g = item.grade;
  if (g === null || g === undefined || g === "") return "常用";
  if (Number(g) >= 1 && Number(g) <= 6) return `小学${g}年`;
  if (String(g).toLowerCase() === "secondary" || Number(g) === 8) return "中学以降";
  return String(g);
}

function sortData(list) {
  return [...list].sort((a, b) => {
    if ($("#sortSelect").value === "char") return a.kanji.localeCompare(b.kanji, "ja");
    return (Number(a.grade) || 99) - (Number(b.grade) || 99) || a.kanji.localeCompare(b.kanji, "ja");
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

function render() {
  const list = sortData(filtered);
  const slice = list.slice(0, shown);

  $("#kanjiGrid").innerHTML = slice.map((item, i) =>
    `<button class="kanji-card" data-index="${i}" aria-label="${escapeHtml(item.kanji)}の詳細"><span class="kanji-char">${escapeHtml(item.kanji)}</span><span class="kanji-reading">${escapeHtml(readingsOf(item).slice(0,2).join("・") || "読み未登録")}</span><span class="kanji-grade">${escapeHtml(gradeLabel(item))}</span></button>`
  ).join("");

  $("#resultCount").textContent = `${list.length.toLocaleString()}件`;
  $("#loadMore").classList.toggle("hidden", shown >= list.length);
  $("#dataStatus").textContent = allKanji.length
    ? `全${allKanji.length.toLocaleString()}字のデータを読み込みました。漢字をタップすると詳細が見られます。`
    : "データを読み込んでいます…";
}

function search() {
  const q = normalize($("#searchInput").value);
  filtered = allKanji.filter(item =>
    !q || normalize([
      item.kanji,
      readingsOf(item).join(" "),
      item.meanings,
      item.examples
    ].join(" ")).includes(q)
  );
  shown = PAGE_SIZE;
  render();
}

function showDetail(item) {
  const reads = readingsOf(item);

  $("#detailContent").innerHTML =
    `<p class="eyebrow">KANJI DETAIL</p>
    <div class="detail-big">${escapeHtml(item.kanji)}</div>
    <div class="detail-reading">${escapeHtml(reads.join("・") || "読み未登録")}</div>
    <div class="detail-tags"><span>${escapeHtml(gradeLabel(item))}</span><span>${escapeHtml(item.strokes ? `${item.strokes}画` : "常用漢字")}</span></div>
    <div class="detail-block"><h4>読み方</h4><p>${escapeHtml(reads.join("、") || "データ未登録")}</p></div>
    <div class="detail-block"><h4>意味</h4><p>${escapeHtml(Array.isArray(item.meanings) ? item.meanings.join("、") : (item.meanings || "意味データ未登録"))}</p></div>
    <div class="detail-block"><h4>熟語・例</h4><p>${escapeHtml(Array.isArray(item.examples) ? item.examples.join("、") : (item.examples || "例データ未登録"))}</p></div>
    <button id="markLearned" class="primary full">${learned.has(item.kanji) ? "学習済み ✓" : "学習済みにする"}</button>`;

  $("#detailDialog").showModal();

  $("#markLearned").onclick = () => {
    if (learned.has(item.kanji)) learned.delete(item.kanji);
    else learned.add(item.kanji);

    localStorage.setItem("kanji-master-learned", JSON.stringify([...learned]));
    $("#learnedCount").textContent = learned.size;
    renderAchievements();
    $("#markLearned").textContent = learned.has(item.kanji) ? "学習済み ✓" : "学習済みにする";
  };
}

function validQuizData() {
  return allKanji.filter(x => x.kanji && readingsOf(x).length);
}

function pickUnique(arr, n) {
  const out = [];
  const pool = [...arr];
  while (pool.length && out.length < n) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function shuffle(arr) {
  return arr.map(v => ({v, r: Math.random()}))
    .sort((a, b) => a.r - b.r)
    .map(x => x.v);
}

function poolReadings() {
  return [...new Set(validQuizData().flatMap(readingsOf))].filter(Boolean);
}

function startQuiz() {
  const pool = validQuizData();

  if (pool.length < 4) {
    alert("クイズには読み方が登録された漢字データが必要です。データの準備を確認してください。");
    return;
  }

  const mode = document.querySelector('input[name="quizMode"]:checked').value;

  quizQuestions = pickUnique(pool, Math.min(10, pool.length)).map(item => {
    const type = mode === "mixed"
      ? (Math.random() < .5 ? "reading" : "writing")
      : mode;
    return {item, type};
  });

  questionIndex = 0;
  score = 0;
  locked = false;

  $("#quizStart").classList.add("hidden");
  $("#quizResult").classList.add("hidden");
  $("#quizArea").classList.remove("hidden");
  renderQuestion();
}

function renderQuestion() {
  locked = false;

  const q = quizQuestions[questionIndex];
  const item = q.item;
  const reading = readingsOf(item);

  $("#questionNumber").textContent = `${questionIndex + 1} / ${quizQuestions.length}`;
  $("#scoreLabel").textContent = `正解 ${score}`;
  $("#progressBar").style.width = `${questionIndex / quizQuestions.length * 100}%`;
  $("#questionType").textContent = q.type === "reading" ? "読み方を選ぼう" : "この読みの漢字を選ぼう";
  $("#questionPrompt").textContent = q.type === "reading" ? item.kanji : reading[0];
  $("#questionSub").textContent = q.type === "reading"
    ? "正しい読み方を4つから選んでください"
    : "読み方に合う漢字を選んでください";

  let options;

  if (q.type === "reading") {
    const correct = reading[0];
    const distractors = pickUnique(poolReadings().filter(x => x !== correct), 3);
    options = shuffle([correct, ...distractors]);
  } else {
    const correct = item.kanji;
    const distractors = pickUnique(validQuizData().filter(x => x.kanji !== correct), 3).map(x => x.kanji);
    options = shuffle([correct, ...distractors]);
  }

  $("#answerOptions").innerHTML = options.map(opt =>
    `<button class="answer-option" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`
  ).join("");

  $("#answerOptions").querySelectorAll("button").forEach(btn => {
    btn.onclick = () => answer(btn.textContent, btn);
  });

  $("#answerFeedback").classList.add("hidden");
  $("#nextQuestion").classList.add("hidden");
}

function answer(value, button) {
  if (locked) return;
  locked = true;

  const q = quizQuestions[questionIndex];
  const correct = q.type === "reading" ? readingsOf(q.item)[0] : q.item.kanji;
  const ok = value === correct;

  if (ok) score++;

  $("#answerOptions").querySelectorAll("button").forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correct) btn.classList.add("correct");
    else if (btn === button) btn.classList.add("wrong");
  });

  $("#answerFeedback").classList.remove("hidden");
  $("#answerFeedback").innerHTML =
    `<strong>${ok ? "正解！" : "おしい！"}</strong>${escapeHtml(q.item.kanji)}：${escapeHtml(readingsOf(q.item).join("・"))}${q.item.meanings ? `<br>意味：${escapeHtml(Array.isArray(q.item.meanings) ? q.item.meanings.join("、") : q.item.meanings)}` : ""}`;

  $("#scoreLabel").textContent = `正解 ${score}`;
  $("#progressBar").style.width = `${(questionIndex + 1) / quizQuestions.length * 100}%`;
  $("#nextQuestion").classList.remove("hidden");
  $("#nextQuestion").textContent = questionIndex === quizQuestions.length - 1 ? "結果を見る →" : "次の問題 →";
}

function nextQuestion() {
  questionIndex++;

  if (questionIndex >= quizQuestions.length) {
    $("#quizArea").classList.add("hidden");
    $("#quizResult").classList.remove("hidden");
    $("#resultTitle").textContent = score === quizQuestions.length
      ? "全問正解！すばらしい！"
      : score >= 7 ? "よくできました！" : "復習してもう一度挑戦！";
    $("#resultScore").textContent =
      `${quizQuestions.length}問中 ${score}問正解（正答率 ${Math.round(score / quizQuestions.length * 100)}%）`;

    if (score === quizQuestions.length) {
      $("#resultTitle").textContent = "にゃんこ先生もびっくり！全問正解！";
    }
    return;
  }

  renderQuestion();
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === btn));
    $("#searchPanel").classList.toggle("hidden", btn.dataset.tab !== "search");
    $("#quizPanel").classList.toggle("hidden", btn.dataset.tab !== "quiz");
  });
});

$("#searchInput").addEventListener("input", search);
$("#clearSearch").onclick = () => {
  $("#searchInput").value = "";
  search();
};
$("#sortSelect").onchange = render;
$("#loadMore").onclick = () => {
  shown += PAGE_SIZE;
  render();
};

$("#kanjiGrid").addEventListener("click", e => {
  const card = e.target.closest(".kanji-card");
  if (card) {
    const item = sortData(filtered)[Number(card.dataset.index)];
    if (item) showDetail(item);
  }
});

$("#closeDialog").onclick = () => $("#detailDialog").close();
$("#detailDialog").addEventListener("click", e => {
  if (e.target === $("#detailDialog")) $("#detailDialog").close();
});

$("#startQuiz").onclick = startQuiz;
$("#nextQuestion").onclick = nextQuestion;
$("#retryQuiz").onclick = startQuiz;
$("#backToSearch").onclick = () => document.querySelector('[data-tab="search"]').click();

function pickKanjiChar(x) {
  return x["通用字体"] || x["漢字"] || x["漢字"]?.["通用字体"] ||
    x.kanji || x.character || x.literal || x.char || "";
}

function normalizeOfficialItem(x) {
  const ch = pickKanjiChar(x);
  const soundList = x["音訓"] || x["音訓・例"] || x.readings || [];
  const reads = [];
  const examples = [];

  if (Array.isArray(soundList)) {
    for (const entry of soundList) {
      if (typeof entry === "string") {
        reads.push(entry);
        continue;
      }

      if (entry && typeof entry === "object") {
        const r = entry["音訓"] || entry["音"] || entry["訓"] || entry.reading || entry.kana || "";
        if (r) reads.push(String(r).replace(/[（(].*?[）)]/g, "").trim());

        const ex = entry["例"] || entry.examples || [];
        if (Array.isArray(ex)) {
          examples.push(...ex.map(v => typeof v === "string" ? v : (v["語"] || v["例"] || "")));
        } else if (ex) {
          examples.push(String(ex));
        }
      }
    }
  } else if (soundList && typeof soundList === "object") {
    Object.values(soundList).forEach(v => {
      if (typeof v === "string") reads.push(v);
      else if (v && typeof v === "object") {
        if (v.reading) reads.push(v.reading);
        if (v["音訓"]) reads.push(v["音訓"]);
      }
    });
  }

  const grade = x["学年"] || x.grade || x["区分"] || "";

  return {
    kanji: ch,
    readings: [...new Set(reads.filter(Boolean))],
    meanings: x["意味"] || x.meanings || "",
    grade,
    strokes: x["画数"] || x.strokes || "",
    examples: [...new Set(examples.filter(Boolean))]
  };
}

async function loadData() {
  let lastError;

  for (const url of DATA_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`データ取得エラー: ${res.status}`);

      const raw = await res.json();
      let source = Array.isArray(raw)
        ? raw
        : (raw.kanji || raw.characters || raw["常用漢字"] || raw["本表"] || []);

      if (!Array.isArray(source)) source = Object.values(source);

      allKanji = source.map(normalizeOfficialItem).filter(x => x.kanji);

      const unique = new Map();
      for (const item of allKanji) {
        if (!unique.has(item.kanji)) unique.set(item.kanji, item);
      }
      allKanji = [...unique.values()];

      if (allKanji.length < 2000) {
        throw new Error("漢字データの形式を認識できませんでした");
      }

      $("#totalCount").textContent = allKanji.length.toLocaleString();
      filtered = [...allKanji];
      shown = PAGE_SIZE;
      render();
      return;
    } catch (err) {
      lastError = err;
    }
  }

  $("#totalCount").textContent = "—";
  $("#dataStatus").innerHTML =
    `漢字データを読み込めませんでした。インターネット接続を確認して再読み込みしてください。<br>このサイトは公開漢字データをCDNから取得します。ネット接続がない場合は一覧・クイズを利用できません。`;
  $("#kanjiGrid").innerHTML = "";
  $("#resultCount").textContent = "0件";
  $("#loadMore").classList.add("hidden");
  console.error(lastError);
}

loadData();
