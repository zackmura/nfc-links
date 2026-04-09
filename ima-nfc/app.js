document.addEventListener("DOMContentLoaded", async () => {
    // 1. Pega o ID da URL (ex: seu_site.com/ima-nfc/index.html?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const clienteId = urlParams.get('id');

    const tituloEl = document.getElementById("nomes-cliente");

    // Se a pessoa tentar acessar sem passar um ID na URL
    if (!clienteId) {
        tituloEl.innerText = "Aproxime seu celular do Ímã Mini Mundo!";
        return;
    }

    tituloEl.innerText = "Carregando surpresa...";

    // 2. Chama o seu banco de dados no Google Sheets
    // COLOQUE AQUI A SUA URL DO APP DA WEB
    const webAppUrl = "https://script.google.com/macros/s/AKfycbxaubKWb7f9DiIlR8WLryYv8UClrCIbaSM4biGwgkwxUnDFGHsCsL7JQrLEGEZNwRvtdg/exec"; 
    
    try {
        const resposta = await fetch(`${webAppUrl}?id=${clienteId}`);
        const dadosCliente = await resposta.json();

        // Se o ID não existir na planilha
        if (dadosCliente.erro) {
            tituloEl.innerText = "Lembrança não encontrada.";
            return;
        }

        // 3. Preenche a tela com os dados vindos da planilha
        tituloEl.innerText = dadosCliente.nomes;
        
        const fotoEl = document.getElementById("foto-cliente");
        const videoEl = document.getElementById("video-cliente");
        const mensagemEl = document.getElementById("mensagem-cliente");

        if (dadosCliente.fase === "teaser") {
            fotoEl.src = dadosCliente.foto; // A foto precisa estar na mesma pasta do GitHub
            fotoEl.style.display = "block";
            videoEl.style.display = "none";
            mensagemEl.innerText = dadosCliente.mensagemTeaser;
            mensagemEl.style.display = "block";
        } else if (dadosCliente.fase === "video") {
            fotoEl.style.display = "none";
            videoEl.src = dadosCliente.linkVideoYoutube;
            videoEl.style.display = "block";
            mensagemEl.style.display = "none";
        }
    } catch (erro) {
        console.error("Erro na integração:", erro);
        tituloEl.innerText = "Erro ao carregar a lembrança.";
    }
});
