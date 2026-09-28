const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const BACKEND_URL = isLocalPreview
    ? "http://127.0.0.1:3000/api/chat"
    : "https://meu-rpg-ia.onrender.com/api/chat";
const MAX_HISTORY_ENTRIES = 20;
const MAX_HISTORY_CHARACTERS = 12000;
const IMAGE_GENERATION_URL = "https://image.pollinations.ai/prompt/";
const SURPRISE_GENRES = ["RPG de Ação", "Aventura", "Terror", "Investigação", "Fantasia", "Ficção Científica", "Romance"];

let storyHistory = [];
let selectedGenre = "";
let activeGenre = "";
let characterName = "Aventureiro";
let imageRequestId = 0;
let chapterNumber = 0;

const sceneArt = document.getElementById("scene-art");
const sceneImage = document.getElementById("scene-image");
const sceneCaption = document.getElementById("scene-caption");
const imageStatus = document.getElementById("image-status");

sceneImage.onerror = () => {
    sceneArt.classList.add("is-unavailable");
    imageStatus.textContent = "A gravura não ficou pronta; a história continua na página.";
};

function updateSceneIllustration(imageKeywords, story) {
    const prompt = [
        "A refined hand-painted gouache illustration printed inside an antique Portuguese storybook",
        `Genre: ${activeGenre}`,
        `Scene keywords: ${imageKeywords.trim().slice(0, 240)}`,
        "old paper texture, cinematic composition, detailed environment, no words, no letters, no typography"
    ].join(". ");
    const requestId = ++imageRequestId;

    sceneArt.classList.remove("is-unavailable");
    sceneImage.setAttribute("aria-busy", "true");
    sceneImage.alt = `Gravura da aventura de ${activeGenre}: ${story.slice(0, 120)}`;
    sceneCaption.textContent = story.slice(0, 150);
    imageStatus.textContent = "A gravura desta página está sendo revelada…";

    sceneImage.onload = () => {
        if (requestId !== imageRequestId) return;
        sceneImage.removeAttribute("aria-busy");
        imageStatus.textContent = "";
    };
    sceneImage.onerror = () => {
        if (requestId !== imageRequestId) return;
        sceneImage.removeAttribute("aria-busy");
        sceneArt.classList.add("is-unavailable");
        imageStatus.textContent = "A gravura não ficou pronta; a história continua na página.";
    };
    sceneImage.src = `${IMAGE_GENERATION_URL}${encodeURIComponent(prompt)}?width=1200&height=900&nologo=true&seed=${Date.now()}`;
}

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

async function fetchFromBackend(prompt) {
    showLoading();

    storyHistory.push({ role: "user", parts: [{ text: prompt }] });
    trimStoryHistory();

    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history: storyHistory, genre: activeGenre, characterName })
        });

        if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);

        const gameData = await response.json();
        if (
            typeof gameData.story !== "string" ||
            !["alive", "dead", "win"].includes(gameData.status) ||
            typeof gameData.image_keywords !== "string" ||
            gameData.image_keywords.trim().length === 0 ||
            gameData.image_keywords.length > 240 ||
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
        hideLoading();
        const storyText = document.getElementById("story-text");
        storyText.style.display = "block";
        storyText.textContent = "O fluxo do livro travou. Verifique sua conexão com o servidor e tente novamente.";
    }
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

    document.getElementById("setup-page").classList.add("is-hidden");
    document.getElementById("story-page").classList.remove("is-hidden");
    document.getElementById("book-shell").dataset.genre = activeGenre;
    document.getElementById("active-genre").textContent = activeGenre;
    document.getElementById("story-text").style.display = "block";
    chapterNumber = 0;
    storyHistory = [];
    fetchFromBackend(`Inicie uma história inédita de ${activeGenre}. O protagonista é ${characterName}. Estabeleça o cenário sem sair do gênero e apresente as quatro primeiras opções.`);
}

function makeChoice(choiceText) {
    fetchFromBackend(`O jogador escolheu a opção: "${choiceText}". Avance o cenário respeitando as ramificações.`);
}

function renderGame(data) {
    const storyTextEl = document.getElementById("story-text");
    const optionsBox = document.getElementById("options-box");
    hideLoading();
    chapterNumber += 1;
    document.getElementById("page-number").textContent = String(chapterNumber).padStart(2, "0");
    storyTextEl.style.display = "block";
    storyTextEl.textContent = data.story;
    updateSceneIllustration(data.image_keywords, data.story);
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
    storyText.style.display = "none";
    storyText.replaceChildren();
    document.getElementById("loader").classList.add("is-visible");
}

function hideLoading() {
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
    hideLoading();
    document.getElementById("story-text").style.display = "none";
    document.getElementById("story-text").textContent = "";
    document.getElementById("char-name").value = "";
    document.getElementById("active-genre").textContent = "";
    document.getElementById("page-number").textContent = "01";
    sceneImage.src = "https://image.pollinations.ai/prompt/an%20antique%20open%20storybook%20with%20a%20quiet%20forest%20painted%20on%20the%20page?width=1200&height=900&nologo=true";
    sceneCaption.textContent = "Uma página em branco, pronta para guardar um novo mundo.";
    imageStatus.textContent = "";
    sceneArt.classList.remove("is-unavailable");

    document.querySelectorAll(".genre-btn").forEach(button => {
        button.classList.remove("selected");
        button.setAttribute("aria-pressed", "false");
    });

    const optionsBox = document.getElementById("options-box");
    optionsBox.replaceChildren();
    addPrimaryButton(optionsBox, "Criar Minha Aventura", startGame);
}
