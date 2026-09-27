import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

const app = express();
const allowedOrigins = new Set(
    (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5500,http://127.0.0.1:5500')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
);

app.use(cors({
    origin(origin, callback) {
        callback(null, !origin || allowedOrigins.has(origin));
    },
    methods: ['POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false
}));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_HISTORY_ENTRIES = 20;
const MAX_HISTORY_CHARACTERS = 16000;

function isValidHistory(history) {
    if (!Array.isArray(history) || history.length === 0 || history.length > MAX_HISTORY_ENTRIES) {
        return false;
    }

    let totalCharacters = 0;

    for (const message of history) {
        const text = message?.parts?.[0]?.text;

        if (
            !['user', 'model'].includes(message?.role) ||
            !Array.isArray(message.parts) ||
            message.parts.length !== 1 ||
            typeof text !== 'string' ||
            text.length === 0 ||
            text.length > 4000
        ) {
            return false;
        }

        totalCharacters += text.length;
        if (totalCharacters > MAX_HISTORY_CHARACTERS) return false;
    }

    return true;
}

const SYSTEM_INSTRUCTIONS = `Você é o mestre de um jogo de RPG de aventura textual. 
O jogo tem apenas UM final vitorioso definitivo.
A cada turno, você deve fornecer a continuação da história e exatamente 4 opções de escolha para o jogador.
Regras estritas:
1. Uma das opções deve avançar em direção ao final correto.
2. Algumas opções podem causar a MORTE do personagem ou levar a caminhos sem saída.
3. Se o jogador morrer, avise no texto da história e defina o parâmetro "status" como "dead".
4. Se o jogador vencer e chegar ao único final possível, defina o parâmetro "status" como "win".
Você DEVE responder estritamente em formato JSON com a seguinte estrutura:
{
  "story": "Texto do cenário atual aqui...",
  "status": "alive",
  "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"]
}`;

app.post('/api/chat', async (req, res) => {
    try {
        const { history } = req.body ?? {};

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "Chave de API não configurada no servidor." });
        }

        if (!isValidHistory(history)) {
            return res.status(400).json({ error: 'Histórico inválido ou acima do limite permitido.' });
        }

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY
            },
            body: JSON.stringify({
                contents: history,
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
                generationConfig: { responseMimeType: "application/json" }
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            console.error(`Gemini API retornou HTTP ${response.status}.`);
            return res.status(502).json({ error: 'Serviço de IA indisponível.' });
        }

        const data = await response.json();

        const aiResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof aiResponseText !== 'string') {
            return res.status(502).json({ error: 'Resposta inválida do serviço de IA.' });
        }

        const gameData = JSON.parse(aiResponseText);
        const validGameData =
            typeof gameData.story === 'string' &&
            ['alive', 'dead', 'win'].includes(gameData.status) &&
            Array.isArray(gameData.options) &&
            gameData.options.length === 4 &&
            gameData.options.every(option => typeof option === 'string');

        if (!validGameData) {
            return res.status(502).json({ error: 'Resposta inválida do serviço de IA.' });
        }

        return res.json(gameData);

    } catch (error) {
        console.error('Erro ao processar a solicitação da IA:', error.name);
        res.status(500).json({ error: "Erro interno ao processar a história." });
    }
});

app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Requisição acima do tamanho permitido.' });
    }

    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({ error: 'JSON inválido.' });
    }

    return res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
