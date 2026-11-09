const $ = (id) => document.getElementById(id);
const micButton = $("micButton");
const listenButton = $("listenButton");
const stopButton = $("stopButton");
const messages = $("messages");
const statusDot = $("statusDot");
const statusText = $("statusText");
const headline = $("headline");
const subline = $("subline");

let recognition = null;
let listening = false;
let speaking = false;
let busy = false;
let history = [];
let restartTimer = null;

function setStatus(text, active = false) {
  statusText.textContent = text;
  statusDot.parentElement.classList.toggle("active", active);
}
function setMode(mode, title, subtitle) {
  document.body.classList.toggle("listening", mode === "listening");
  document.body.classList.toggle("speaking", mode === "speaking");
  headline.textContent = title;
  subline.textContent = subtitle;
}
function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `message ${role}`;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "user" ? "VOCÊ" : "JARVIS";
  const p = document.createElement("p");
  p.textContent = text;
  wrap.append(who, p);
  messages.append(wrap);
  messages.scrollTop = messages.scrollHeight;
}
function makeRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("NAVEGADOR INCOMPATÍVEL");
    setMode("idle", "Reconhecimento indisponível", "Abra este assistente no Google Chrome atualizado.");
    listenButton.disabled = true;
    return null;
  }
  const r = new SpeechRecognition();
  r.lang = "pt-BR";
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;

  r.onresult = async (event) => {
    if (!listening || speaking || busy) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue;
      const transcript = event.results[i][0].transcript.trim();
      const normalized = transcript.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const match = normalized.match(/\bjarvis\b[\s,.:;!?-]*(.*)$/i);
      if (match) {
        const question = match[1].trim();
        if (question) {
          await askJarvis(question);
        } else {
          setMode("listening", "Estou ouvindo.", "Pode falar, senhor.");
          setStatus("AGUARDANDO COMANDO", true);
          // The next finalized phrase after the wake word is treated as the command.
          waitForNextPhrase = true;
        }
      } else if (waitForNextPhrase) {
        waitForNextPhrase = false;
        await askJarvis(transcript);
      }
    }
  };
  r.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      listening = false;
      updateControls();
      setStatus("MICROFONE BLOQUEADO");
      setMode("idle", "Permita o microfone", "Toque no ícone ao lado do endereço do site e autorize o microfone.");
    }
  };
  r.onend = () => {
    if (listening && !speaking && !busy) {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        try { recognition.start(); } catch {}
      }, 450);
    }
  };
  return r;
}
let waitForNextPhrase = false;

function updateControls() {
  listenButton.disabled = listening;
  stopButton.disabled = !listening;
  listenButton.textContent = listening ? "ESCUTA ATIVA" : "ATIVAR ESCUTA";
}
async function startListening() {
  if (!recognition) recognition = makeRecognition();
  if (!recognition) return;
  try {
    listening = true;
    updateControls();
    setStatus("ESCUTA ATIVA", true);
    setMode("listening", "Sistema em escuta.", "Diga “Jarvis” seguido da sua pergunta.");
    recognition.start();
  } catch (e) {
    // start() may throw if the recognizer is already running.
  }
}
function stopListening() {
  listening = false;
  waitForNextPhrase = false;
  clearTimeout(restartTimer);
  try { recognition?.stop(); } catch {}
  updateControls();
  setStatus("EM ESPERA");
  setMode("idle", "À sua disposição.", "Toque em Ativar escuta quando quiser conversar.");
}
async function askJarvis(question) {
  if (!question || busy) return;
  busy = true;
  waitForNextPhrase = false;
  setStatus("PROCESSANDO", true);
  setMode("thinking", "Analisando.", "Um instante, senhor.");
  addMessage("user", question);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao consultar o assistente.");
    const reply = data.reply;
    history.push({ role: "user", content: question }, { role: "assistant", content: reply });
    history = history.slice(-20);
    addMessage("assistant", reply);
    await speak(reply);
  } catch (error) {
    addMessage("assistant", `Não consegui concluir a solicitação. ${error.message}`);
    setStatus("ERRO DE CONEXÃO");
    setMode("idle", "Ocorreu uma falha.", "Confira a conexão e as configurações do servidor.");
  } finally {
    busy = false;
    if (listening && !speaking) {
      setStatus("ESCUTA ATIVA", true);
      setMode("listening", "Sistema em escuta.", "Diga “Jarvis” seguido da sua pergunta.");
      // SpeechRecognition often ends when stopped for TTS; restart after playback.
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        if (listening && !speaking && !busy) {
          try { recognition?.start(); } catch {}
        }
      }, 500);
    }
  }
}
async function speak(text) {
  speaking = true;
  try { recognition?.stop(); } catch {}
  setStatus("FALANDO", true);
  setMode("speaking", "Respondendo.", "Transmitindo pela voz selecionada.");
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Falha no Fish Audio.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await new Promise((resolve, reject) => {
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
    URL.revokeObjectURL(url);
  } catch (error) {
    addMessage("assistant", `Não consegui reproduzir a voz personalizada: ${error.message}`);
  } finally {
    speaking = false;
  }
}
listenButton.addEventListener("click", startListening);
micButton.addEventListener("click", () => listening ? stopListening() : startListening());
stopButton.addEventListener("click", stopListening);
$("clearButton").addEventListener("click", () => {
  history = [];
  messages.replaceChildren();
  addMessage("assistant", "Histórico limpo. Continuo à sua disposição.");
});
(async function init() {
  try {
    const r = await fetch("/api/status");
    const data = await r.json();
    if (data.ready) {
      setStatus("SISTEMAS PRONTOS", true);
      setMode("idle", "À sua disposição.", "Diga “Jarvis” para iniciar uma conversa.");
    } else {
      setStatus("CONFIGURAÇÃO PENDENTE");
      setMode("idle", "Quase pronto.", "O servidor ainda precisa das chaves de API e do Voice ID.");
    }
  } catch {
    setStatus("SERVIDOR INDISPONÍVEL");
    setMode("idle", "Aguardando conexão.", "Inicie o servidor para acessar o JARVIS.");
  }
})();
