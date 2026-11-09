
const micButton = document.getElementById("micButton");
const listenButton = document.getElementById("listenButton");
const stopButton = document.getElementById("stopButton");
const clearButton = document.getElementById("clearButton");
const messages = document.getElementById("messages");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const headline = document.getElementById("headline");
const subline = document.getElementById("subline");

let recognition = null;
let listening = false;
let waitingForCommand = false;
let speaking = false;
let restarting = false;
let history = [];
let audioPlayer = null;

function setStatus(text, active = false) {
  statusText.textContent = text;
  statusDot.style.background = active ? "#35e6a1" : "#718096";
}

function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `message ${role}`;

  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "assistant" ? "JARVIS" : "VOCÊ";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  item.appendChild(who);
  item.appendChild(paragraph);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

async function checkServer() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();

    if (data.ready) {
      setStatus("SISTEMAS ONLINE", true);
    } else {
      setStatus("CONFIGURAÇÃO INCOMPLETA");
      console.warn("Variáveis ausentes:", data.missing);
    }
  } catch (error) {
    setStatus("SERVIDOR INDISPONÍVEL");
    console.error(error);
  }
}

async function askJarvis(text) {
  addMessage("user", text);
  history.push({ role: "user", content: text });

  headline.textContent = "Processando...";
  subline.textContent = "Estou analisando sua solicitação.";

  setStatus("CONSULTANDO INTELIGÊNCIA", true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: history.slice(-10, -1)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha na comunicação.");
    }

    const reply = data.reply || "Não consegui formular uma resposta.";

    history.push({ role: "assistant", content: reply });
    addMessage("assistant", reply);

    headline.textContent = "À sua disposição.";
    subline.textContent = "Aguardando novo comando.";

    await speak(reply);

  } catch (error) {
    console.error(error);
    addMessage("assistant", "Senhor, não consegui acessar minha inteligência. " + error.message);
    headline.textContent = "Aguardando.";
    setStatus("ERRO NA COMUNICAÇÃO");
  }
}

async function speak(text) {
  speaking = true;

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }

  setStatus("JARVIS RESPONDENDO", true);

  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Falha ao gerar áudio.");
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);

    audioPlayer = new Audio(audioUrl);

    audioPlayer.onended = () => {
      URL.revokeObjectURL(audioUrl);
      audioPlayer = null;
      speaking = false;
      setStatus("ESCUTANDO", true);
      restartRecognition();
    };

    audioPlayer.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      audioPlayer = null;
      speaking = false;
      setStatus("ERRO NO ÁUDIO");
      restartRecognition();
    };

    await audioPlayer.play();

  } catch (error) {
    console.error("Fish Audio:", error);
    speaking = false;
    setStatus("VOZ INDISPONÍVEL");
    restartRecognition();
  }
}

function processTranscript(transcript) {
  const text = transcript.trim();
  if (!text) return;

  const normalized = text
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:]/g, " ");

  if (waitingForCommand) {
    waitingForCommand = false;
    askJarvis(text);
    return;
  }

  const wakeIndex = normalized.indexOf("jarvis");

  if (wakeIndex !== -1) {
    const command = text.slice(wakeIndex + 6).trim();

    headline.textContent = "Estou ouvindo.";
    subline.textContent = "Pode falar, senhor.";

    if (command.length > 1) {
      askJarvis(command);
    } else {
      waitingForCommand = true;
      setStatus("AGUARDANDO COMANDO", true);
    }
  }
}

function restartRecognition() {
  if (!listening || speaking || !recognition || restarting) return;

  restarting = true;

  try {
    recognition.start();
  } catch (error) {
    console.warn("Reconhecimento:", error.message);
  }

  setTimeout(() => {
    restarting = false;
  }, 1000);
}

function initializeRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addMessage(
      "assistant",
      "Seu navegador não oferece reconhecimento de voz. Utilize o Google Chrome atualizado."
    );
    setStatus("VOZ NÃO SUPORTADA");
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    restarting = false;
    setStatus("ESCUTANDO", true);
    headline.textContent = "À sua disposição.";
    subline.textContent = 'Diga "Jarvis" para iniciar uma conversa.';
  };

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];

    if (result.isFinal && !speaking) {
      processTranscript(result[0].transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error("Microfone:", event.error);

    if (event.error === "not-allowed" ||
        event.error === "service-not-allowed") {
      listening = false;
      updateButtons();
      setStatus("MICROFONE BLOQUEADO");
      subline.textContent = "Autorize o microfone nas configurações do navegador.";
    }
  };

  recognition.onend = () => {
    restarting = false;

    if (listening && !speaking) {
      setTimeout(restartRecognition, 700);
    } else if (!listening) {
      setStatus("SISTEMA EM PAUSA");
    }
  };

  return true;
}

function updateButtons() {
  listenButton.disabled = listening;
  stopButton.disabled = !listening;
  micButton.classList.toggle("active", listening);
}

function startListening() {
  if (listening) return;

  if (!recognition && !initializeRecognition()) return;

  listening = true;
  waitingForCommand = false;
  updateButtons();

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
    setStatus("ERRO AO ATIVAR MICROFONE");
  }
}

function stopListening() {
  listening = false;
  waitingForCommand = false;
  speaking = false;

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }

  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }

  updateButtons();
  setStatus("SISTEMA EM PAUSA");
  headline.textContent = "À sua disposição.";
  subline.textContent = "Escuta pausada.";
}

listenButton.addEventListener("click", startListening);
micButton.addEventListener("click", () => {
  if (listening) {
    stopListening();
  } else {
    startListening();
  }
});

stopButton.addEventListener("click", stopListening);

clearButton.addEventListener("click", () => {
  history = [];
  messages.innerHTML = "";
  addMessage("assistant", "Histórico limpo. Continuo à sua disposição.");
});

checkServer();

