// Quando você publicar no Render, mudará esta URL para o link que o Render te der
const BACKEND_URL = "http://localhost:3000/api/chat"; 

let storyHistory = [];

async function fetchFromBackend(prompt) {
    showLoading();
    
    storyHistory.push({ role: "user", parts: [{ text: prompt }] });

    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history: storyHistory })
        });

        const gameData = await response.json();
        
        // Adiciona a resposta estruturada ao histórico para manter o contexto na IA
        storyHistory.push({ 
            role: "model", 
            parts: [{ text: JSON.stringify(gameData) }] 
        });
        
        renderGame(gameData);

    } catch (error) {
        console.error("Erro ao conectar com o servidor:", error);
        document.getElementById("story-text").innerText = "O servidor está descansando. Tente novamente em instantes.";
    }
}

function startGame() {
    storyHistory = [];
    fetchFromBackend("Comece uma nova história de aventura épica em uma floresta proibida.");
}

function makeChoice(choiceText) {
    fetchFromBackend(`O jogador escolheu a opção: "${choiceText}". Avance o cenário respeitando as ramificações.`);
}

function renderGame(data) {
    const storyTextEl = document.getElementById("story-text");
    const optionsBox = document.getElementById("options-box");
    
    storyTextEl.innerText = data.story;
    optionsBox.innerHTML = "";

    if (data.status === "dead") {
        optionsBox.innerHTML = `<button id="start-btn" onclick="startGame()">💀 Você Morreu! Tentar Novamente</button>`;
    } else if (data.status === "win") {
        optionsBox.innerHTML = `<button id="start-btn" onclick="startGame()">🏆 Parabéns, Você Venceu!</button>`;
    } else {
        data.options.forEach(option => {
            const btn = document.createElement("button");
            btn.innerText = option;
            btn.onclick = () => makeChoice(option);
            optionsBox.appendChild(btn);
        });
    }
}

function showLoading() {
    document.getElementById("options-box").innerHTML = "";
    document.getElementById("story-text").innerHTML = `<div class="loading">A IA está tecendo o destino...</div>`;
}
