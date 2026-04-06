const formulario = document.getElementById("formulario-envio");
const mensagemStatus = document.getElementById("mensagem-status");
const campoArquivos = document.getElementById("documento");

// URL do backend
const API_URL = "https://site-direito.onrender.com/enviar";

// Limite total de 10 MB
const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    mensagemStatus.textContent = "";
    mensagemStatus.className = "";

    // Pega todos os arquivos selecionados
    const arquivos = campoArquivos.files;

    // Soma o tamanho total dos arquivos
    let tamanhoTotal = 0;
    for (const arquivo of arquivos) {
        tamanhoTotal += arquivo.size;
    }

    // Valida se passou de 10 MB
    if (tamanhoTotal > LIMITE_TOTAL_BYTES) {
        mensagemStatus.textContent = "O tamanho total dos arquivos não pode ultrapassar 10 MB.";
        mensagemStatus.classList.add("erro");
        return;
    }

    // Cria o FormData com todos os campos do formulário
    const formData = new FormData(formulario);

    try {
        mensagemStatus.textContent = "Enviando...";

        const resposta = await fetch(API_URL, {
            method: "POST",
            body: formData
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.mensagem || "Erro ao enviar formulário.");
        }

        mensagemStatus.textContent = resultado.mensagem;
        mensagemStatus.classList.add("sucesso");

        formulario.reset();
    } catch (erro) {
        mensagemStatus.textContent = erro.message || "Erro ao enviar.";
        mensagemStatus.classList.add("erro");

        console.error("Erro:", erro);
    }
});