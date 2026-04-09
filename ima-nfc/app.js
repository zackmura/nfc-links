// app.js
document.addEventListener("DOMContentLoaded", () => {
    // Preenche os textos básicos
    document.getElementById("nomes-cliente").innerText = dadosCliente.nomes;
    
    const fotoEl = document.getElementById("foto-cliente");
    const videoEl = document.getElementById("video-cliente");
    const mensagemEl = document.getElementById("mensagem-cliente");

    // Verifica em qual fase o projeto está
    if (dadosCliente.fase === "teaser") {
        fotoEl.src = dadosCliente.foto;
        fotoEl.style.display = "block";
        videoEl.style.display = "none";
        mensagemEl.innerText = dadosCliente.mensagemTeaser;
        mensagemEl.style.display = "block";
    } else if (dadosCliente.fase === "video") {
        fotoEl.style.display = "none";
        videoEl.src = dadosCliente.linkVideoYoutube;
        videoEl.style.display = "block";
        mensagemEl.style.display = "none"; // Oculta o texto para dar foco total ao vídeo
    }
});
