import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors()); // Permite que o seu frontend acesse este servidor
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://googleapis.com{GEMINI_API_KEY}`;

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
        const { history } = req.body;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "Chave de API não configurada no servidor." });
        }

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: history,
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("Resposta inválida da IA");
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        res.json(JSON.parse(aiResponseText));

    } catch (error) {
        console.error("Erro no servidor:", error);
        res.status(500).json({ error: "Erro interno ao processar a história." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
