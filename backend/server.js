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

app.use(cors());
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

// Configuração do multer
const upload = multer({
    dest: "uploads/",
    limits: {
        // Limite individual alto o suficiente para permitir vários arquivos,
        // enquanto o controle real do total será feito manualmente abaixo.
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const extensao = path.extname(file.originalname).toLowerCase();

        if (!extensoesPermitidas.includes(extensao)) {
            return cb(new Error("Tipo de arquivo não permitido. Envie PDF, JPG, JPEG, PNG, DOC ou DOCX."));
        }

        cb(null, true);
    }
});

// Função para apagar arquivos temporários
function removerArquivosTemporarios(arquivos) {
    if (!arquivos || !Array.isArray(arquivos)) return;

    for (const arquivo of arquivos) {
        if (arquivo.path && fs.existsSync(arquivo.path)) {
            fs.unlinkSync(arquivo.path);
        }
    }
}

// Rota de teste
app.get("/", (req, res) => {
    res.send("Backend funcionando");
});

// Rota para receber o formulário com vários arquivos
app.post("/enviar", upload.array("documento", 10), async (req, res) => {
    const { nome, "nome-imob": nomeImob, intencao, obs } = req.body;

    // Agora req.files é um array
    const arquivos = req.files || [];

    try {
        // Validação dos campos
        if (!nome || !nomeImob || !intencao) {
            removerArquivosTemporarios(arquivos);

            return res.status(400).json({
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        // Valida se pelo menos 1 arquivo foi enviado
        if (arquivos.length === 0) {
            return res.status(400).json({
                mensagem: "Envie pelo menos um documento."
            });
        }

        // Soma o tamanho total dos arquivos
        let tamanhoTotal = 0;
        for (const arquivo of arquivos) {
            tamanhoTotal += arquivo.size;
        }

        // Bloqueia se o total ultrapassar 10 MB
        if (tamanhoTotal > LIMITE_TOTAL_BYTES) {
            removerArquivosTemporarios(arquivos);

            return res.status(400).json({
                mensagem: "O tamanho total dos arquivos não pode ultrapassar 10 MB."
            });
        }

        // Prepara anexos para o Resend
        const anexos = arquivos.map((arquivo) => {
            const arquivoBuffer = fs.readFileSync(arquivo.path);

            return {
                filename: arquivo.originalname,
                content: arquivoBuffer
            };
        });

        const htmlEmail = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Novo envio de contrato</h2>
                <p><strong>Nome do corretor:</strong> ${nome}</p>
                <p><strong>Nome da Imobiliária:</strong> ${nomeImob}</p>
                <p><strong>Tipo do contrato:</strong> ${intencao}</p>
                <p><strong>Observação:</strong> ${obs || "Não informada"}</p>
                <p><strong>Quantidade de arquivos:</strong> ${arquivos.length}</p>
            </div>
        `;

        await resend.emails.send({
            from: process.env.EMAIL_REMETENTE,
            to: process.env.EMAIL_DESTINO,
            subject: `Novo contrato enviado - ${nomeImob}`,
            html: htmlEmail,
            attachments: anexos
        });

        // Remove arquivos temporários após envio
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

// Middleware global de erro
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