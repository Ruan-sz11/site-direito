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

// CORS restrito ao domínio do site
app.use(cors({
    origin: [
        "https://weiqueandrade.adv.br",
        "https://www.weiqueandrade.adv.br"
    ],
    methods: ["POST", "GET"]
}));

app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

// Cria a pasta uploads se não existir
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// Extensões permitidas
const extensoesPermitidas = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

// Limite total de 10 MB
const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

// Configuração do upload
const upload = multer({
    dest: "uploads/",
    limits: {
        // limite individual; o total será validado manualmente depois
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const extensao = path.extname(file.originalname).toLowerCase();

        if (!extensoesPermitidas.includes(extensao)) {
            return cb(
                new Error("Tipo de arquivo não permitido. Envie PDF, JPG, JPEG, PNG, DOC ou DOCX.")
            );
        }

        cb(null, true);
    }
});

// Remove arquivos temporários
function removerArquivosTemporarios(arquivos) {
    if (!arquivos || !Array.isArray(arquivos)) return;

    for (const arquivo of arquivos) {
        if (arquivo.path && fs.existsSync(arquivo.path)) {
            fs.unlinkSync(arquivo.path);
        }
    }
}

// Escapa HTML para evitar conteúdo malicioso/quebrado
function escaparHTML(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Formata a observação para HTML preservando parágrafos e quebras de linha
function formatarTextoParaHTML(texto) {
    return texto
        // normaliza quebras do Windows
        .replace(/\r\n/g, "\n")
        // separa parágrafos (2 ou mais quebras)
        .replace(/\n{2,}/g, "</p><p style=\"margin: 0 0 12px 0;\">")
        // quebra simples dentro do mesmo parágrafo
        .replace(/\n/g, "<br>");
}

// Rota de teste
app.get("/", (req, res) => {
    res.send("Backend funcionando");
});

// Rota principal
app.post("/enviar", upload.array("documento", 10), async (req, res) => {
    const { nome, "nome-imob": nomeImob, intencao, obs } = req.body;
    const arquivos = req.files || [];

    try {
        // Validação de campos obrigatórios
        if (!nome || !nomeImob || !intencao) {
            removerArquivosTemporarios(arquivos);

            return res.status(400).json({
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        // Validação de anexos
        if (arquivos.length === 0) {
            return res.status(400).json({
                mensagem: "Envie pelo menos um documento."
            });
        }

        // Soma do tamanho total dos arquivos
        let tamanhoTotal = 0;
        for (const arquivo of arquivos) {
            tamanhoTotal += arquivo.size;
        }

        if (tamanhoTotal > LIMITE_TOTAL_BYTES) {
            removerArquivosTemporarios(arquivos);

            return res.status(400).json({
                mensagem: "O tamanho total dos arquivos não pode ultrapassar 10 MB."
            });
        }

        // Sanitização dos campos
        const nomeSeguro = escaparHTML(nome);
        const nomeImobSeguro = escaparHTML(nomeImob);
        const intencaoSeguro = escaparHTML(intencao);

        // Formatação da observação
        let obsFormatada = "Não informada";

        if (obs && obs.trim() !== "") {
            const obsSegura = escaparHTML(obs);
            obsFormatada = formatarTextoParaHTML(obsSegura);
        }

        // Monta anexos para envio
        const anexos = arquivos.map((arquivo) => {
            const buffer = fs.readFileSync(arquivo.path);

            return {
                filename: arquivo.originalname,
                content: buffer
            };
        });

        // HTML do email
        const htmlEmail = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
                <h2 style="margin-bottom: 20px;">Novo envio de contrato</h2>

                <p><strong>Nome do corretor:</strong> ${nomeSeguro}</p>
                <p><strong>Nome da Imobiliária:</strong> ${nomeImobSeguro}</p>
                <p><strong>Tipo do contrato:</strong> ${intencaoSeguro}</p>

                <p><strong>Observação:</strong></p>

                <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-family: Arial, sans-serif; word-break: break-word;">
                    <p style="margin: 0;">
                        ${obsFormatada}
                    </p>
                </div>

                <p style="margin-top: 18px;"><strong>Quantidade de arquivos:</strong> ${arquivos.length}</p>
            </div>
        `;

        await resend.emails.send({
            from: process.env.EMAIL_REMETENTE,
            to: process.env.EMAIL_DESTINO,
            subject: `Novo contrato enviado - ${nomeImobSeguro}`,
            html: htmlEmail,
            attachments: anexos
        });

        // Remove arquivos temporários após o envio
        removerArquivosTemporarios(arquivos);

        return res.status(200).json({
            mensagem: "Formulário enviado com sucesso."
        });
    } catch (erro) {
        removerArquivosTemporarios(arquivos);

        console.error("Erro no servidor:", erro);

        return res.status(500).json({
            mensagem: "Erro interno ao enviar o formulário."
        });
    }
});

// Tratamento global de erros
app.use((erro, req, res, next) => {
    console.error("Erro capturado:", erro);

    if (erro instanceof multer.MulterError) {
        return res.status(400).json({
            mensagem: "Erro no upload dos arquivos."
        });
    }

    return res.status(400).json({
        mensagem: erro.message || "Erro na requisição."
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});