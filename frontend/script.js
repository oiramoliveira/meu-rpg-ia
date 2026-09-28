const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const BACKEND_URL = isLocalPreview
    ? "http://127.0.0.1:3000/api/chat"
    : "https://meu-rpg-ia.onrender.com/api/chat";
const MAX_HISTORY_ENTRIES = 20;
const MAX_HISTORY_CHARACTERS = 12000;
const SURPRISE_GENRES = ["RPG de Ação", "Aventura", "Terror", "Investigação", "Fantasia", "Ficção Científica", "Romance"];

let storyHistory = [];
let selectedGenre = "";
let activeGenre = "";
let characterName = "Aventureiro";
let chapterNumber = 0;
let requestInProgress = false;
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
    const characterCount = () => storyHistory.reduce(
        (total, message) => total + (message.parts?.[0]?.text?.length ?? 0),
        0
    );

    while (
        storyHistory.length > MAX_HISTORY_ENTRIES ||
        characterCount() > MAX_HISTORY_CHARACTERS
    ) {
        storyHistory.splice(0, Math.min(2, storyHistory.length));
    }
}

async function fetchFromBackend(prompt, isFirstPage = false) {
    if (requestInProgress) return;
    requestInProgress = true;
    showLoading(isFirstPage);

    storyHistory.push({ role: "user", parts: [{ text: prompt }] });
    trimStoryHistory();

    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history: storyHistory, genre: activeGenre, characterName })
        });

        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(responseData.message || responseData.error || `Backend returned HTTP ${response.status}`);
            error.providerStatus = responseData.providerStatus;
            throw error;
        }

        const gameData = responseData;
        if (
            typeof gameData.story !== "string" ||
            !["alive", "dead", "win"].includes(gameData.status) ||
            !Array.isArray(gameData.options) ||
            gameData.options.length !== 4 ||
            !gameData.options.every(option => typeof option === "string")
        ) {
            throw new Error("Resposta inválida do servidor");
        }

        storyHistory.push({ role: "model", parts: [{ text: JSON.stringify(gameData) }] });
        trimStoryHistory();
        renderGame(gameData, isFirstPage);

    } catch (error) {
        console.error("Erro ao conectar com o servidor:", error);
        storyHistory.pop();
        hideLoading(isFirstPage);
        const errorElement = document.getElementById(isFirstPage ? "setup-error" : "game-error");
        const message = error.providerStatus === 403
            ? error.message
            : error.providerStatus === 429
                ? error.message
                : "O fluxo do livro não conseguiu buscar a história. Verifique a conexão com o Render e tente novamente.";
        showError(errorElement, message);
    } finally {
        requestInProgress = false;
    }
}

function showError(element, message) {
    element.replaceChildren(document.createTextNode(message));
    element.classList.remove("is-hidden");
}

function startGame() {
    if (!selectedGenre) {
        alert("Por favor, selecione um tipo de aventura antes de começar!");
        return;
    }

    characterName = document.getElementById("char-name").value.trim().slice(0, 40) || "Aventureiro";
    activeGenre = selectedGenre === "Surpreenda-me"
        ? SURPRISE_GENRES[Math.floor(Math.random() * SURPRISE_GENRES.length)]
        : selectedGenre;

    document.getElementById("book-shell").dataset.genre = activeGenre;
    document.getElementById("active-genre").textContent = activeGenre;
    document.getElementById("setup-error").classList.add("is-hidden");
    chapterNumber = 0;
    storyHistory = [];
    fetchFromBackend(`Inicie uma história inédita de ${activeGenre}. O protagonista é ${characterName}. Estabeleça o cenário sem sair do gênero e apresente as quatro primeiras opções.`, true);
}

function makeChoice(choiceText) {
    fetchFromBackend(`O jogador escolheu a opção: "${choiceText}". Avance o cenário respeitando as ramificações.`);
}

function renderGame(data, isFirstPage) {
    const storyTextEl = document.getElementById("story-text");
    const optionsBox = document.getElementById("options-box");
    document.getElementById("game-error").classList.add("is-hidden");
    chapterNumber += 1;
    document.getElementById("page-number").textContent = String(chapterNumber).padStart(2, "0");
    storyTextEl.style.display = "block";
    storyTextEl.textContent = data.story;
    optionsBox.replaceChildren();
    optionsBox.style.removeProperty("display");

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

    if (isFirstPage) {
        document.getElementById("setup-page").classList.add("is-hidden");
        document.getElementById("story-page").classList.remove("is-hidden");
    }
    hideLoading(isFirstPage);
}

function addPrimaryButton(container, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-btn";
    button.textContent = label;
    button.onclick = action;
    container.appendChild(button);
}

function showLoading(isFirstPage) {
    if (isFirstPage) {
        document.getElementById("submit-btn").classList.add("is-hidden");
        document.getElementById("submit-btn").disabled = true;
        document.getElementById("setup-loader").classList.add("is-visible");
        return;
    }

    document.getElementById("game-error").classList.add("is-hidden");
    document.getElementById("options-box").style.display = "none";
    document.getElementById("loader").classList.add("is-visible");
}

function hideLoading(isFirstPage) {
    if (isFirstPage) {
        document.getElementById("submit-btn").classList.remove("is-hidden");
        document.getElementById("submit-btn").disabled = false;
        document.getElementById("setup-loader").classList.remove("is-visible");
        return;
    }

    document.getElementById("options-box").style.removeProperty("display");
    document.getElementById("loader").classList.remove("is-visible");
}

function resetGame() {
    storyHistory = [];
    selectedGenre = "";
    activeGenre = "";
    characterName = "Aventureiro";
    chapterNumber = 0;
    document.getElementById("book-shell").removeAttribute("data-genre");
    document.getElementById("setup-page").classList.remove("is-hidden");
    document.getElementById("story-page").classList.add("is-hidden");
    hideLoading(false);
    hideLoading(true);
    document.getElementById("setup-error").classList.add("is-hidden");
    document.getElementById("game-error").classList.add("is-hidden");
    document.getElementById("story-text").style.display = "none";
    document.getElementById("story-text").textContent = "";
    document.getElementById("char-name").value = "";
    document.getElementById("active-genre").textContent = "";
    document.getElementById("page-number").textContent = "01";
    document.querySelectorAll(".genre-btn").forEach(button => {
        button.classList.remove("selected");
        button.setAttribute("aria-pressed", "false");
    });

    const optionsBox = document.getElementById("options-box");
    optionsBox.replaceChildren();
    addPrimaryButton(optionsBox, "Criar Minha Aventura", startGame);
}
