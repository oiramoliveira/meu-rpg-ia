const BACKEND_URL = "https://onrender.com/api/chat"; // Troque pela URL real do serviço no Render.
const MAX_HISTORY_ENTRIES = 20;

let storyHistory = [];
let selectedGenre = "";

function selectGenre(button, genre) {
    document.querySelectorAll(".genre-btn").forEach(genreButton => {
        genreButton.classList.remove("selected");
        genreButton.setAttribute("aria-pressed", "false");
    });

    button.classList.add("selected");
    button.setAttribute("aria-pressed", "true");
    selectedGenre = genre;
}

function trimStoryHistory() {
    if (storyHistory.length > MAX_HISTORY_ENTRIES) {
        storyHistory = storyHistory.slice(-MAX_HISTORY_ENTRIES);
        if (storyHistory[0]?.role === "model") storyHistory.shift();
    }
}

async function fetchFromBackend(prompt) {
    showLoading();

    storyHistory.push({ role: "user", parts: [{ text: prompt }] });
    trimStoryHistory();

    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history: storyHistory })
        });

        if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);

        const gameData = await response.json();
        if (
            typeof gameData.story !== "string" ||
            !["alive", "dead", "win"].includes(gameData.status) ||
            !Array.isArray(gameData.options) ||
            gameData.options.length !== 4 ||
            !gameData.options.every(option => typeof option === "string")
        ) {
            throw new Error("Resposta inválida do servidor");
        }

        storyHistory.push({
            role: "model",
            parts: [{ text: JSON.stringify(gameData) }]
        });
        trimStoryHistory();

        renderGame(gameData);

    } catch (error) {
        console.error("Erro ao conectar com o servidor:", error);
        const storyText = document.getElementById("story-text");
        storyText.style.display = "block";
        storyText.classList.remove("loading");
        storyText.textContent = "O servidor está descansando. Tente novamente em instantes.";
    }
}

function startGame() {
    if (!selectedGenre) {
        alert("Por favor, selecione um tipo de aventura antes de começar!");
        return;
    }

    const charName = document.getElementById("char-name").value.trim().slice(0, 40) || "Aventureiro";
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("story-text").style.display = "block";
    storyHistory = [];
    fetchFromBackend(`Inicie uma história inédita do gênero "${selectedGenre}". O protagonista se chama "${charName}". Introduza o cenário inicial e crie as 4 primeiras opções.`);
}

function makeChoice(choiceText) {
    fetchFromBackend(`O jogador escolheu a opção: "${choiceText}". Avance o cenário respeitando as ramificações.`);
}

function renderGame(data) {
    const storyTextEl = document.getElementById("story-text");
    const optionsBox = document.getElementById("options-box");
    storyTextEl.style.display = "block";
    storyTextEl.classList.remove("loading");
    storyTextEl.textContent = data.story;
    optionsBox.replaceChildren();

    if (data.status === "dead") {
        addPrimaryButton(optionsBox, "💀 Você Morreu! Tentar Novamente", resetGame);
    } else if (data.status === "win") {
        addPrimaryButton(optionsBox, "🏆 Parabéns, Você Venceu!", resetGame);
    } else {
        data.options.forEach(option => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "choice-btn";
            btn.textContent = option;
            btn.onclick = () => makeChoice(option);
            optionsBox.appendChild(btn);
        });
    }
}

function addPrimaryButton(container, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-btn";
    button.textContent = label;
    button.onclick = action;
    container.appendChild(button);
}

function showLoading() {
    const optionsBox = document.getElementById("options-box");
    const storyText = document.getElementById("story-text");
    optionsBox.replaceChildren();
    storyText.style.display = "block";
    storyText.textContent = "A IA está tecendo o destino...";
    storyText.classList.add("loading");
}

function resetGame() {
    storyHistory = [];
    selectedGenre = "";
    document.getElementById("setup-screen").style.display = "block";
    document.getElementById("story-text").style.display = "none";
    document.getElementById("story-text").classList.remove("loading");
    document.getElementById("story-text").textContent = "";

    document.querySelectorAll(".genre-btn").forEach(button => {
        button.classList.remove("selected");
        button.setAttribute("aria-pressed", "false");
    });

    const optionsBox = document.getElementById("options-box");
    optionsBox.replaceChildren();
    addPrimaryButton(optionsBox, "Criar Minha Aventura", startGame);
}
