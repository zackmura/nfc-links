// 1. Pega o nome do livro pela URL (ex: ?book=aventura)
const urlParams = new URLSearchParams(window.location.search);
const bookName = urlParams.get('book') || 'default'; // Se não houver, carrega um padrão

// 2. Caminho do arquivo no seu GitHub
const bookPath = `./books/${bookName}.epub`;

// 3. Inicializa o Epub.js
const book = ePub(bookPath);
const rendition = book.renderTo("viewer", {
    width: "100%",
    height: "100%",
    flow: "paginated", // Isso faz com que pareça páginas de livro
    manager: "default"
});

// 4. Exibe o livro
rendition.display().then(() => {
    console.log("Livro carregado com sucesso!");
});

// Adiciona suporte a setas do teclado para virar página
document.addEventListener("keyup", function(e) {
    if ((e.keyCode || e.which) == 37) rendition.prev();
    if ((e.keyCode || e.which) == 39) rendition.next();
}, false);
