import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { Resend } from "resend";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 CORS restrito ao seu domínio
app.use(cors({
  origin: [
    "https://weiqueandrade.adv.br",
    "https://www.weiqueandrade.adv.br"
  ],
  methods: ["POST"],
}));

app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

// 📁 Cria pasta uploads se não existir
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// 📎 Extensões permitidas
const extensoesPermitidas = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

// 📏 Limite total 10MB
const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

// 📤 Configuração do multer
const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const extensao = path.extname(file.originalname).toLowerCase();

        if (!extensoesPermitidas.includes(extensao)) {
            return cb(new Error("Tipo de arquivo não permitido."));
        }

        cb(null, true);
    }
});

// 🧹 Remove arquivos temporários
function removerArquivosTemporarios(arquivos) {
    if (!arquivos || !Array.isArray(arquivos)) return;

    for (const arquivo of arquivos) {
        if (arquivo.path && fs.existsSync(arquivo.path)) {
            fs.unlinkSync(arquivo.path);
        }
    }
}

// 🔐 Função para evitar HTML malicioso
function escaparHTML(texto) {
    return texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// 🌐 Rota teste
app.get("/", (req, res) => {
    res.send("Backend funcionando");
});

// 📩 Rota principal
app.post("/enviar", upload.array("documento", 10), async (req, res) => {
    const { nome, "nome-imob": nomeImob, intencao, obs } = req.body;
    const arquivos = req.files || [];

    try {
        // ❌ validação básica
        if (!nome || !nomeImob || !intencao) {
            removerArquivosTemporarios(arquivos);
            return res.status(400).json({ mensagem: "Preencha os campos obrigatórios." });
        }

        if (arquivos.length === 0) {
            return res.status(400).json({ mensagem: "Envie pelo menos um arquivo." });
        }

        // 📏 soma tamanho total
        let tamanhoTotal = 0;
        for (const arquivo of arquivos) {
            tamanhoTotal += arquivo.size;
        }

        if (tamanhoTotal > LIMITE_TOTAL_BYTES) {
            removerArquivosTemporarios(arquivos);
            return res.status(400).json({
                mensagem: "Arquivos ultrapassam 10MB."
            });
        }

        // 🔐 sanitização
        const nomeSeguro = escaparHTML(nome);
        const nomeImobSeguro = escaparHTML(nomeImob);
        const intencaoSeguro = escaparHTML(intencao);

        // 📝 observação com quebra de linha preservada
       let obsSegura = "";
       if (obs && obs.trim() !== "") {
            obsSegura = escaparHTML(obs);
        }
        // 📎 anexos
        const anexos = arquivos.map((arquivo) => {
            const buffer = fs.readFileSync(arquivo.path);

            return {
                filename: arquivo.originalname,
                content: buffer
            };
        });

        // 📧 HTML do email (melhorado)
        const htmlEmail = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Novo envio de contrato</h2>

                <p><strong>Nome do corretor:</strong> ${nomeSeguro}</p>
                <p><strong>Nome da Imobiliária:</strong> ${nomeImobSeguro}</p>
                <p><strong>Tipo do contrato:</strong> ${intencaoSeguro}</p>

                <p><strong>Observação:</strong></p>
                <div style="background:#f5f5f5;padding:10px;border-radius:6px;white-space: pre-wrap;font-family: Arial, sans-serif;">
                    ${obsSegura || "Não informada"}
                </div>

                <p><strong>Quantidade de arquivos:</strong> ${arquivos.length}</p>
            </div>
        `;

        await resend.emails.send({
            from: process.env.EMAIL_REMETENTE,
            to: process.env.EMAIL_DESTINO,
            subject: `Novo contrato enviado - ${nomeImobSeguro}`,
            html: htmlEmail,
            attachments: anexos
        });

        removerArquivosTemporarios(arquivos);

        return res.status(200).json({
            mensagem: "Formulário enviado com sucesso."
        });

    } catch (erro) {
        removerArquivosTemporarios(arquivos);
        console.error("Erro:", erro);

        return res.status(500).json({
            mensagem: "Erro interno no servidor."
        });
    }
});

// 🚨 tratamento de erro global
app.use((erro, req, res, next) => {
    console.error("Erro capturado:", erro);

    if (erro instanceof multer.MulterError) {
        return res.status(400).json({
            mensagem: "Erro no upload."
        });
    }

    return res.status(400).json({
        mensagem: erro.message || "Erro na requisição."
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});