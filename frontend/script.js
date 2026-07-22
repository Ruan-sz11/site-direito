const formulario = document.getElementById("formulario-envio");
const mensagemStatus = document.getElementById("mensagem-status");
const campoArquivos = document.getElementById("documento");
const inputArquivos = document.getElementById("arquivo");

let arquivosSelecionados = [];

inputArquivos.addEventListener("change", (e) => {

    const novosArquivos = Array.from(e.target.files);

    arquivosSelecionados.push(...novosArquivos);

    // remove arquivos duplicados
    arquivosSelecionados = arquivosSelecionados.filter(
        (arquivo, indice, lista) =>
            indice ===
            lista.findIndex(
                a =>
                    a.name === arquivo.name &&
                    a.size === arquivo.size &&
                    a.lastModified === arquivo.lastModified
            )
    );

    atualizarListaArquivos();

    inputArquivos.value = "";
});

function atualizarListaArquivos() {

    const lista = document.getElementById("listaArquivos");

    lista.innerHTML = "";

    arquivosSelecionados.forEach((arquivo, indice) => {

        const item = document.createElement("div");

        item.className = "arquivo-item";

        item.innerHTML = `
            <span>${arquivo.name}</span>
            <button type="button" onclick="removerArquivo(${indice})">
                Remover
            </button>
        `;

        lista.appendChild(item);

    });

}

function removerArquivo(indice){

    arquivosSelecionados.splice(indice,1);

    atualizarListaArquivos();

}
// URL do backend
const API_URL = "https://api.weiqueandrade.adv.br/enviar";

// Limite total de 10 MB
const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    mensagemStatus.textContent = "";
    mensagemStatus.className = "";

    // Pega todos os arquivos selecionados
    const arquivos = arquivosSelecionados;

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
    const formData = new FormData();

formData.append("nome", formulario.nome.value);
formData.append("nome-imob", formulario["nome-imob"].value);
formData.append("intencao", formulario.intencao.value);
formData.append("obs", formulario.obs.value);

arquivosSelecionados.forEach((arquivo) => {
    formData.append("documento", arquivo);
});

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
        arquivosSelecionados = [];
        atualizarListaArquivos();
    } catch (erro) {
        mensagemStatus.textContent = erro.message || "Erro ao enviar.";
        mensagemStatus.classList.add("erro");

        console.error("Erro:", erro);
    }
});