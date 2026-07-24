const VERSAO_ATUAL_SISTEMA = "7.8.23";
const API_NOVERA = "https://bdfernando.alwaysdata.net/api";

let TOKEN_ONIONSYS = localStorage.getItem('novera_onionsys_key') || "";
let KEY_IMGBB = localStorage.getItem('novera_imgbb_key') || "";

let rotulosGlobal = [], estoqueGlobal = [], gastosGlobal = [], vendasGlobal = [];
let encomendasGlobal = [], comprasGlobal = [], producaoGlobal = [];
let logsGlobal = []; 
let usuarioLogado = ""; 
let usuarioCargo = ""; 
let dadosCarregados = false; 

let chartRGBase = null, chartStatusBase = null;
let estoqueAgrupado = {};

// ==========================================
// FUNÇÃO DO CRACHÁ (Segurança JWT)
// ==========================================
const cabecalhoAuth = () => {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (localStorage.getItem('novera_token') || '')
    };
};

function aplicarVersao() {
    document.querySelectorAll('.app-version').forEach(el => el.innerText = "v" + VERSAO_ATUAL_SISTEMA);
    const txtModal = document.getElementById('texto-versao-modal');
    if (txtModal) txtModal.innerText = "Atualização - Versão " + VERSAO_ATUAL_SISTEMA;
}

document.addEventListener('input', function (e) {
    if (e.target.classList.contains('mask-money')) {
        let value = e.target.value.replace(/\D/g, '');
        if (value === "") { e.target.value = ""; return; }
        value = (parseInt(value) / 100).toFixed(2) + '';
        value = value.replace(".", ",");
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        e.target.value = "R$ " + value;

        if (e.target.id === 'g-valor') calcularTotalGasto();
        if (e.target.id === 'edit-g-valor') calcularEditGasto();
        if (e.target.id === 'mc-valor-unit') calcularTotalCompraModal();
    }
});

function padronizarTexto(texto) { return texto ? String(texto).trim().replace(/\s+/g, ' ').toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase()) : ""; }
const fmt = val => "R$ " + (Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPlanilha = val => "R$ " + (Number(val) || 0).toFixed(2).replace('.', ',');

function parseDinheiro(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace(/R\$\s?/gi, '');
    if (str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.includes(',')) str = str.replace(',', '.');
    return parseFloat(str) || 0;
}

function safeFmt(val) { return fmt(parseDinheiro(val)); }
function dataBR(isoStr) { if (!isoStr) return ""; const p = isoStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }

function formatarNomeProdutoHtml(nome, tipo) {
    const prod = estoqueGlobal.find(e => e.nome === nome);
    if (prod && prod.codigo) {
        if (tipo === 'cobranca') return `<span style="background:#fff9e6; border:1px solid #fde047; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:900; margin-right:5px; display:inline-block; transform:translateY(-1px);">${prod.codigo}</span>${nome}`;
        else return `<span style="background:#fdf5f7; border:1px solid #f3d8e2; color:#966178; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:900; margin-right:5px; display:inline-block; transform:translateY(-1px);">${prod.codigo}</span>${nome}`;
    }
    return nome;
}

function formatarNomeProdutoTexto(nome) {
    const prod = estoqueGlobal.find(e => e.nome === nome);
    if (prod && prod.codigo) return `[${prod.codigo}] ${nome}`;
    return nome;
}

function mostrarLoading(m) {
    const syncEl = document.getElementById("sync-status");
    if (syncEl) { syncEl.innerText = "🔄"; syncEl.classList.add('spin-anim'); }
    if (!dadosCarregados) { const l = document.getElementById("global-loader"); if (l) { l.querySelector("p").innerText = m; l.style.display = "flex"; } }
}

function ocultarLoading() {
    const syncEl = document.getElementById("sync-status");
    if (syncEl) { syncEl.classList.remove('spin-anim'); syncEl.innerText = "✔️"; setTimeout(() => { if (syncEl.innerText === "✔️") syncEl.innerText = "☁️"; }, 3000); }
    const l = document.getElementById("global-loader"); if (l) l.style.display = "none";
}

function mostrarAlerta(titulo, texto, tipo) {
    const modal = document.getElementById("custom-modal"); const icone = document.getElementById("modal-icone-alert"); const btnEl = document.getElementById("btn-modal-ok"); const tituloEl = document.getElementById("modal-titulo-alert");
    tituloEl.innerText = titulo; document.getElementById("modal-texto-alert").innerText = texto;
    if (tipo === "success") { icone.innerText = "✨"; tituloEl.style.color = "var(--primary-dark)"; btnEl.style.background = "var(--primary-dark)"; btnEl.style.boxShadow = "0 4px 0 #7a4a5e"; }
    else if (tipo === "warning") { icone.innerText = "⚠️"; tituloEl.style.color = "#D4A373"; btnEl.style.background = "#D4A373"; btnEl.style.boxShadow = "0 4px 0 #bc8f5f"; }
    else { icone.innerText = "❌"; tituloEl.style.color = "#A05252"; btnEl.style.background = "#A05252"; btnEl.style.boxShadow = "0 4px 0 #803f3f"; }
    modal.style.display = "flex"; if ("vibrate" in navigator) navigator.vibrate(50);
}

function abrirConfirmacao(titulo, texto, icone, corHex, sombraHex, textoBtn, callback) {
    document.getElementById('modal-conf-title').innerText = titulo; document.getElementById('modal-conf-title').style.color = corHex; document.getElementById('modal-conf-icon').innerText = icone; document.getElementById('texto-confirmar').innerText = texto;
    const btn = document.getElementById('btn-confirmar-acao'); btn.innerText = textoBtn; btn.style.background = corHex; btn.style.boxShadow = `0 4px 0 ${sombraHex}`;
    btn.onclick = function () { if (callback) callback(); document.getElementById('modal-confirmar').style.display = 'none'; };
    document.getElementById('modal-confirmar').style.display = 'flex';
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    if (usuarioCargo !== 'Admin' && tabId !== 'vendas' && tabId !== 'configuracoes') tabId = 'vendas';

    const navBtnTarget = document.getElementById('tab-' + tabId);
    if (navBtnTarget) navBtnTarget.classList.add('active');

    if (tabId !== 'configuracoes' && tabId !== 'dashboard') { const navBtn = document.getElementById('nav-' + tabId); if (navBtn) navBtn.classList.add('active'); }
    if (tabId === 'dashboard') { setTimeout(() => { renderizarDashboard(); }, 50); }
    if (tabId === 'logs') { renderizarLogs(); }
    if (tabId === 'gastos' && !document.getElementById('g-data').value) { document.getElementById('g-data').valueAsDate = new Date(); document.getElementById('c-data').valueAsDate = new Date(); }
    if (tabId === 'vendas' && !document.getElementById('v-data').value) { document.getElementById('v-data').valueAsDate = new Date(); document.getElementById('e-data').valueAsDate = new Date(); }
}

function toggleVendasTab(tab) {
    const vReg = document.getElementById('vendas-registro-view'), vLot = document.getElementById('vendas-lotes-view'), vEnc = document.getElementById('vendas-encomendas-view');
    const btnReg = document.getElementById('btn-sub-registro'), btnLot = document.getElementById('btn-sub-lotes'), btnEnc = document.getElementById('btn-sub-encomendas');
    document.querySelectorAll('.sub-nav-btn', document.getElementById('tab-vendas')).forEach(b => { b.classList.remove('active'); });
    vReg.style.display = 'none'; vLot.style.display = 'none'; vEnc.style.display = 'none';
    if (tab === 'registro') { vReg.style.display = 'block'; btnReg.classList.add('active'); } else if (tab === 'lotes') { vLot.style.display = 'block'; btnLot.classList.add('active'); } else { vEnc.style.display = 'block'; btnEnc.classList.add('active'); }
}

function toggleGastosTab(tab) {
    const gDes = document.getElementById('gastos-despesas-view'), gComp = document.getElementById('gastos-compras-view');
    const btnDes = document.getElementById('btn-sub-despesas'), btnComp = document.getElementById('btn-sub-compras');
    document.querySelectorAll('.sub-nav-btn', document.getElementById('tab-gastos')).forEach(b => { b.classList.remove('active'); });
    gDes.style.display = 'none'; gComp.style.display = 'none';
    if (tab === 'despesas') { gDes.style.display = 'block'; btnDes.classList.add('active'); } else { gComp.style.display = 'block'; btnComp.classList.add('active'); }
}

function atualizarDatalistsDinamicos() {
    let sociosSet = new Set(); vendasGlobal.forEach(v => { if (v.socio) sociosSet.add(String(v.socio).trim()) }); gastosGlobal.forEach(g => { if (g.socio) sociosSet.add(String(g.socio).trim()) });
    let sociosHtml = [...sociosSet].sort((a, b) => a.localeCompare(b)).map(s => `<option value="${s}">`).join(''); document.getElementById('lista-socios').innerHTML = sociosHtml; document.getElementById('lista-socios-dinamica').innerHTML = sociosHtml;
    let filtroSocioV = document.getElementById('f-v-socio'); let sVAtual = filtroSocioV.value; filtroSocioV.innerHTML = '<option value="">Todos</option>' + [...sociosSet].sort((a, b) => a.localeCompare(b)).map(s => `<option value="${s}">${s}</option>`).join(''); filtroSocioV.value = sVAtual;
    let filtroSocioG = document.getElementById('f-socio'); let sGAtual = filtroSocioG.value; filtroSocioG.innerHTML = '<option value="">Todos</option>' + [...sociosSet].sort((a, b) => a.localeCompare(b)).map(s => `<option value="${s}">${s}</option>`).join(''); filtroSocioG.value = sGAtual;

    let locaisGastosSet = new Set(); gastosGlobal.forEach(g => { if (g.local) locaisGastosSet.add(String(g.local).trim()) }); let locaisHtml = [...locaisGastosSet].sort((a, b) => a.localeCompare(b)).map(l => `<option value="${l}">`).join(''); document.getElementById('lista-locais').innerHTML = locaisHtml;

    let locaisEstoqueSet = new Set(); estoqueGlobal.forEach(e => { if (e.local) locaisEstoqueSet.add(String(e.local).trim()) }); let locEstHtml = [...locaisEstoqueSet].sort((a, b) => a.localeCompare(b)).map(l => `<option value="${l}">`).join('');
    const dLocal = document.getElementById('lista-locais-estoque'); if (dLocal) dLocal.innerHTML = locEstHtml;

    const filtroLocal = document.getElementById('f-e-local');
    if (filtroLocal) {
        let fAtual = filtroLocal.value;
        filtroLocal.innerHTML = '<option value="">📍 Todos os Locais</option>' + [...locaisEstoqueSet].sort((a, b) => a.localeCompare(b)).map(l => `<option value="${l}">Apenas: ${l}</option>`).join('');
        filtroLocal.value = fAtual;
    }
}

function aplicarPermissoes() {
    const isAdmin = (usuarioCargo === 'Admin');

    document.getElementById('nav-rotulos').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('nav-precificar').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('nav-estoque').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('nav-gastos').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('nav-dashboard').style.display = isAdmin ? 'flex' : 'none';

    const btnAdmin = document.querySelector('button[onclick="switchTab(\'logs\')"]');
    const btnChaves = document.querySelector('.btn-ai[onclick="salvarConfiguracoesChaves()"]');

    if (!isAdmin) {
        switchTab('vendas');
        const inputSocio = document.getElementById('v-socio');
        if (inputSocio) { inputSocio.value = usuarioLogado; inputSocio.readOnly = true; inputSocio.style.background = "#E8DDE1"; inputSocio.style.color = "#7a4a5e"; }
        const inputValorVenda = document.getElementById('v-valor');
        if (inputValorVenda) { inputValorVenda.readOnly = true; inputValorVenda.style.background = "#E8DDE1"; inputValorVenda.style.color = "#7a4a5e"; }

        if (btnAdmin) { btnAdmin.style.display = 'none'; if (btnAdmin.previousElementSibling) btnAdmin.previousElementSibling.style.display = 'none'; }
        if (btnChaves) {
            btnChaves.style.display = 'none';
            document.getElementById('cfg-ai-key').parentElement.parentElement.style.display = 'none';
            document.getElementById('cfg-imgbb-key').parentElement.parentElement.style.display = 'none';
            document.getElementById('cfg-onionsys-key').parentElement.parentElement.style.display = 'none';
            if (btnChaves.previousElementSibling) { btnChaves.previousElementSibling.style.display = 'none'; if (btnChaves.previousElementSibling.previousElementSibling) btnChaves.previousElementSibling.previousElementSibling.style.display = 'none'; }
        }
    } else {
        const inputSocio = document.getElementById('v-socio');
        if (inputSocio) { inputSocio.readOnly = false; inputSocio.style.background = "#fafafa"; inputSocio.style.color = "var(--brand-dark)"; }
        const inputValorVenda = document.getElementById('v-valor');
        if (inputValorVenda) { inputValorVenda.readOnly = false; inputValorVenda.style.background = "#fafafa"; inputValorVenda.style.color = "var(--brand-dark)"; }

        if (btnAdmin) { btnAdmin.style.display = 'block'; if (btnAdmin.previousElementSibling) btnAdmin.previousElementSibling.style.display = 'block'; }
        if (btnChaves) {
            btnChaves.style.display = 'block';
            document.getElementById('cfg-ai-key').parentElement.parentElement.style.display = 'block';
            document.getElementById('cfg-imgbb-key').parentElement.parentElement.style.display = 'block';
            document.getElementById('cfg-onionsys-key').parentElement.parentElement.style.display = 'block';
            if (btnChaves.previousElementSibling) { btnChaves.previousElementSibling.style.display = 'block'; if (btnChaves.previousElementSibling.previousElementSibling) btnChaves.previousElementSibling.previousElementSibling.style.display = 'block'; }
        }
    }
}

async function sincronizarDadosUnico() {
    mostrarLoading("Sincronizando...");
    try {
        const token = localStorage.getItem('novera_token');
        const res = await fetch(API_NOVERA + "?acao=listar_tudo&_t=" + new Date().getTime(), {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (res.status === 401 || res.status === 403) {
            return fazerLogout("Sessão Expirada. Faça login novamente.");
        }
        
        if (!res.ok) throw new Error("Status API: " + res.status);
        const dados = await res.json();
        
        if (dados.sucesso) {
            rotulosGlobal = dados.rotulos || []; estoqueGlobal = dados.estoque || []; 
            gastosGlobal = dados.gastos || []; vendasGlobal = dados.vendas || []; 
            encomendasGlobal = dados.encomendas || []; comprasGlobal = dados.compras || [];
            producaoGlobal = dados.producao || []; // ADICIONE AQUI
            logsGlobal = dados.logs || [];

            if (usuarioCargo !== 'Admin') {
                vendasGlobal = vendasGlobal.filter(v => String(v.socio).toLowerCase().trim() === usuarioLogado.toLowerCase().trim());
            }

            estoqueAgrupado = {};
            estoqueGlobal.forEach(e => {
                let n = padronizarTexto(e.nome);
                let rotuloBase = rotulosGlobal.find(r => r.codigo === e.codigo);
                let generoEncontrado = rotuloBase && rotuloBase.genero ? String(rotuloBase.genero).trim() : 'Unissex';
                if (generoEncontrado === '') generoEncontrado = 'Unissex';

                if (!estoqueAgrupado[n]) {
                    estoqueAgrupado[n] = { nome: e.nome, tipo: e.tipo, codigo: e.codigo, preco: e.preco, custo: e.custo, foto: e.foto, totalQtd: 0, locais: {}, genero: generoEncontrado };
                }
                let lExib = e.local ? e.local.trim() : 'Sede';
                let q = parseFloat(e.qtd) || 0;

                if (!estoqueAgrupado[n].locais[lExib]) estoqueAgrupado[n].locais[lExib] = 0;
                estoqueAgrupado[n].locais[lExib] += q;
                estoqueAgrupado[n].totalQtd += q;
            });

            atualizarDatalistsDinamicos(); renderizarRotulos(); renderizarOpcoesPrecificacao(); renderizarEstoque(); renderizarGastos(); renderizarVendas(); renderizarDashboard(); renderizarEncomendas(); renderizarCompras(); renderizarProducao();
            if (document.getElementById('tab-logs').classList.contains('active')) renderizarLogs();
            
            if (!dadosCarregados) {
                dadosCarregados = true;
                verificarNovidades();
                verificarComandosURL(); // <--- ADICIONE ESTA LINHA AQUI!
            }
        } else { mostrarAlerta("Erro de Sincronização", dados.erro, "error"); }
    } catch (e) { mostrarAlerta("Falha de Conexão", "Erro ao carregar dados.", "error"); } finally { ocultarLoading(); }   
}

function toggleSenha(inputId, btnElement) { const input = document.getElementById(inputId); if (input.type === "password") { input.type = "text"; btnElement.innerText = "👁️"; } else { input.type = "password"; btnElement.innerText = "🙈"; } }

function iniciarSessaoLocal(usuario, cargo, token) {
    localStorage.setItem('novera_last_user', usuario);
    localStorage.setItem('novera_user_cargo', cargo || 'Vendedor');
    if (token) localStorage.setItem('novera_token', token); // Salva o crachá
    
    usuarioLogado = usuario;
    usuarioCargo = cargo || 'Vendedor';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('cfg-user').value = usuario;
    aplicarPermissoes();
    verificarNovidades();
    if (!dadosCarregados) sincronizarDadosUnico();
}

function verificarLogin() {
    const token = localStorage.getItem('novera_token');
    const lastUser = localStorage.getItem('novera_last_user') || '';
    const lastCargo = localStorage.getItem('novera_user_cargo') || 'Vendedor';
    
    if (token) {
        iniciarSessaoLocal(lastUser, lastCargo, token);
    } else {
        document.getElementById('login-screen').style.display = 'block'; document.getElementById('main-app').style.display = 'none'; document.getElementById('login-user').value = lastUser; document.getElementById('login-pass').value = '';
    }
}

async function fazerLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if (!user || !pass) return mostrarAlerta("Atenção", "Preencha usuário e senha.", "warning");

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.innerText = "⏳ ENTRANDO...";

    try {
        const res = await fetch(API_NOVERA + "/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: user, senha: pass })
        });

        const json = await res.json();

        if (json.sucesso) {
            iniciarSessaoLocal(json.usuario, json.cargo, json.token);
        } else {
            mostrarAlerta("Acesso Negado", json.erro, "error");
        }
    } catch (e) {
        mostrarAlerta("Erro", "Falha na conexão com o servidor Node.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Entrar";
    }
}

function renderizarLogs() {
    const container = document.getElementById('lista-logs');
    if (!container) return;
    if (logsGlobal.length === 0) { 
        container.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Nenhum registro encontrado.</p>"; 
        return; 
    }

    const selUser = document.getElementById('f-log-usuario');
    const selAcao = document.getElementById('f-log-acao');
    const inputBusca = document.getElementById('busca-logs');
    const inputData = document.getElementById('f-log-data');

    if (selUser && selUser.options.length <= 1) {
        const usuariosUnicos = [...new Set(logsGlobal.map(l => l.usuario))].filter(Boolean).sort();
        usuariosUnicos.forEach(u => selUser.innerHTML += `<option value="${u}">${u}</option>`);
    }

    if (selAcao && selAcao.options.length <= 1) {
        const acoesUnicas = [...new Set(logsGlobal.map(l => l.acao))].filter(Boolean).sort();
        acoesUnicas.forEach(a => selAcao.innerHTML += `<option value="${a}">${a}</option>`);
    }

    const tBusca = inputBusca ? inputBusca.value.toLowerCase().trim() : "";
    const fUser = selUser ? selUser.value : "";
    const fAcao = selAcao ? selAcao.value : "";
    const fData = inputData ? inputData.value : ""; 

    let fDataBR = "";
    if (fData) {
        const p = fData.split('-');
        fDataBR = `${p[2]}/${p[1]}/${p[0]}`; 
    }

    let filtrados = logsGlobal.filter(log => {
        let passBusca = !tBusca || (log.detalhe + " " + log.acao + " " + log.usuario).toLowerCase().includes(tBusca);
        let passUser = !fUser || log.usuario === fUser;
        let passAcao = !fAcao || log.acao === fAcao;
        let passData = !fDataBR || (log.dataHora && log.dataHora.startsWith(fDataBR));

        return passBusca && passUser && passAcao && passData;
    });

    if (filtrados.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Nenhum log corresponde aos filtros aplicados.</p>";
        return;
    }

    let html = "";
    filtrados.forEach(log => {
        let corBadge = "#966178";
        if (log.acao.includes('EXCLUIR') || log.acao.includes('EXCLUIU')) corBadge = "#A05252";
        if (log.acao.includes('CRIAR') || log.acao.includes('NOVA') || log.acao.includes('SALVAR') || log.acao.includes('FABRICOU') || log.acao.includes('COMPRA')) corBadge = "#2e7d32";
        if (log.acao.includes('EDITAR') || log.acao.includes('ATUALIZAR') || log.acao.includes('AJUSTOU')) corBadge = "#0369a1";
        if (log.acao.includes('ENTROU')) corBadge = "#166534"; 

        html += `<div class="rotulo-card" style="align-items:center; margin-bottom:8px;">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-weight:800; font-size:0.75rem; color:var(--brand-dark);">👤 ${log.usuario}</span>
                    <span style="font-size:0.65rem; color:#888;">🕒 ${log.dataHora}</span>
                </div>
                <div style="margin-bottom:4px;"><span style="background:${corBadge}; color:white; padding:2px 6px; border-radius:4px; font-size:0.6rem; font-weight:800; letter-spacing:0.5px;">${log.acao}</span></div>
                <p style="font-size:0.75rem; color:#666; margin:0; line-height:1.4;">${log.detalhe}</p>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderizarRotulos() { const lista = document.getElementById("lista-rotulos-cadastrados"); const resumo = document.getElementById("resumo-essencias"); if (rotulosGlobal.length === 0) { lista.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Vazio.</p>"; if (resumo) resumo.innerHTML = ""; return; } let htmlLista = ""; let countMasc = 0, countFem = 0, countInf = 0, countUni = 0; rotulosGlobal.sort((a, b) => String(b.codigo || "").localeCompare(String(a.codigo || ""))).forEach(r => { let gen = String(r.genero || "").toLowerCase().trim(); let corFundo = "#f3f4f6", corTexto = "#4b5563"; let txtGen = r.genero || "Unissex"; if (gen === "masculino") { corFundo = "#e0f2fe"; corTexto = "#0369a1"; countMasc++; } else if (gen === "feminino") { corFundo = "#fce7f3"; corTexto = "#be185d"; countFem++; } else if (gen === "infantil") { corFundo = "#dcfce7"; corTexto = "#166534"; countInf++; } else { countUni++; txtGen = "Unissex"; } let badgeGenero = `<span style="background:${corFundo}; color:${corTexto}; padding:2px 6px; border-radius:4px; font-size:0.6rem; margin-left:5px; text-transform:uppercase; font-weight:800; vertical-align: middle;">${txtGen}</span>`; htmlLista += `<div class="rotulo-card"><div class="rotulo-info"><h4>${r.essencia} ${badgeGenero} <span style="font-size:0.7rem; color:#999; font-weight:500;">(${r.marca})</span></h4><p>Cód Forn: <b>${r.codigo_forn || '-'}</b></p></div><div style="display:flex; gap:12px; align-items:center;"><div class="rotulo-badge">${r.codigo}</div><div style="display:flex; gap:5px;"><button class="btn-acao" onclick="abrirModalEditarRotulo(${r.linha})" title="Editar">✏️</button><button class="btn-acao" onclick="prepararExclusaoRegistro('Tabela Rotulo Novera', ${r.linha}, 'Rótulo: ${r.codigo}')">🗑️</button></div></div></div>`; }); lista.innerHTML = htmlLista; if (resumo) { resumo.innerHTML = `<div class="dash-card highlight" style="grid-column: span 2; padding: 15px; margin-bottom: 0; text-align:center;"><h3 style="color:#e8dde1; font-size:0.75rem;">Total no Dicionário</h3><p class="valor" style="font-size: 2rem;">${rotulosGlobal.length}</p></div><div class="dash-card" style="padding: 12px; background:#fff0f6; border: 1px solid #fce7f3; transform:none; cursor:default;"><h3 style="color:#be185d; font-size:0.65rem;">Femininas</h3><p class="valor" style="font-size: 1.4rem; color:#be185d;">${countFem}</p></div><div class="dash-card" style="padding: 12px; background:#f0f9ff; border: 1px solid #e0f2fe; transform:none; cursor:default;"><h3 style="color:#0369a1; font-size:0.65rem;">Masculinas</h3><p class="valor" style="font-size: 1.4rem; color:#0369a1;">${countMasc}</p></div><div class="dash-card" style="padding: 12px; background:#f9fafb; border: 1px solid #e5e7eb; transform:none; cursor:default;"><h3 style="color:#4b5563; font-size:0.65rem;">Unissex</h3><p class="valor" style="font-size: 1.4rem; color:#4b5563;">${countUni}</p></div><div class="dash-card" style="padding: 12px; background:#f0fdf4; border: 1px solid #dcfce7; transform:none; cursor:default;"><h3 style="color:#166534; font-size:0.65rem;">Infantis</h3><p class="valor" style="font-size: 1.4rem; color:#166534;">${countInf}</p></div>`; } }

function renderizarOpcoesPrecificacao() { 
    // 1. PREENCHE A CALCULADORA DE NOVOS PRODUTOS (Mantém todos)
    const select = document.getElementById("n-produto"); 
    let htmlSelect = '<option value="">Selecione a Essência Base...</option>'; 
    rotulosGlobal.sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || ""))).forEach(r => { 
        let genTxt = r.genero ? ` (${r.genero})` : ''; 
        htmlSelect += `<option value="${r.codigo}|${r.essencia}">${r.codigo} - ${r.essencia}${genTxt}</option>`; 
    }); 
    select.innerHTML = htmlSelect; 

    // 2. PREENCHE O DROPDOWN DE PRODUÇÃO RÁPIDA (Filtra apenas Perfumes)
    const selectPR = document.getElementById("pr-produto");
    if (selectPR) {
        let htmlPR = '<option value="">Selecione um Perfume do Estoque...</option>';
        
        // Aplica o filtro para ignorar Cremes, Home Sprays, etc.
        let produtosFiltrados = Object.values(estoqueAgrupado).filter(e => {
            let tipoProduto = String(e.tipo).toLowerCase().trim();
            let nomeProduto = String(e.nome).toLowerCase().trim();
            // Retorna verdadeiro apenas se a palavra 'perfume' estiver no tipo ou no nome
            return tipoProduto === 'perfume' || nomeProduto.includes('perfume');
        });

        // Ordena a lista usando o Código (N001, N002...) e depois o Nome
        produtosFiltrados.sort((a, b) => {
            let codA = String(a.codigo || "");
            let codB = String(b.codigo || "");
            if(codA === codB) return String(a.nome).localeCompare(String(b.nome));
            return codA.localeCompare(codB);
        }).forEach(e => {
            let exibeCodigo = e.codigo ? e.codigo + ' - ' : '';
            htmlPR += `<option value="${e.nome}">${exibeCodigo}${e.nome}</option>`;
        });
        
        selectPR.innerHTML = htmlPR;
    }
}

function salvarRotulo() { const essencia = padronizarTexto(document.getElementById('r-essencia').value); const codForn = padronizarTexto(document.getElementById('r-codigo-forn').value); const marca = padronizarTexto(document.getElementById('r-marca').value); const genero = document.getElementById('r-genero') ? document.getElementById('r-genero').value : ""; if (!essencia) return mostrarAlerta("Atenção", "Preencha a Essência.", "warning"); mostrarLoading("Salvando..."); const msgLog = `✨ Criou a essência: ${essencia} (Gênero: ${genero || 'Indefinido'})`; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "salvar_rotulo", essencia: essencia, codigo_forn: codForn, marca: marca, genero: genero, log_detalhe: msgLog }) }).then(r => { if(r.status === 401 || r.status === 403) { fazerLogout("Sessão Expirada"); throw new Error("Auth"); } return r.json(); }).then(resultado => { if (resultado.sucesso) { mostrarAlerta("Criado!", `Identidade gerada.`, "success"); document.getElementById('r-essencia').value = ""; if (document.getElementById('r-codigo-forn')) document.getElementById('r-codigo-forn').value = ""; if (document.getElementById('r-marca')) document.getElementById('r-marca').value = ""; if (document.getElementById('r-genero')) document.getElementById('r-genero').value = ""; sincronizarDadosUnico(); } else { mostrarAlerta("Erro", resultado.erro === "DUPLICADO_ROTULO" ? "Essência já cadastrada." : resultado.erro, "error"); } }).catch(e => { if(e.message !== "Auth") mostrarAlerta("Erro", "Falha.", "error"); }).finally(() => ocultarLoading()); }
function abrirModalEditarRotulo(linha) { const r = rotulosGlobal.find(x => x.linha === linha); if (!r) return; document.getElementById('edit-r-linha').value = r.linha; document.getElementById('edit-r-essencia').value = r.essencia; document.getElementById('edit-r-codigo-forn').value = r.codigo_forn; document.getElementById('edit-r-marca').value = r.marca; if (document.getElementById('edit-r-genero')) document.getElementById('edit-r-genero').value = r.genero || ""; document.getElementById('modal-editar-rotulo').style.display = 'flex'; }
function salvarEdicaoRotulo() { mostrarLoading("Atualizando..."); const ess = padronizarTexto(document.getElementById('edit-r-essencia').value); const gen = document.getElementById('edit-r-genero') ? document.getElementById('edit-r-genero').value : ""; const msgLog = `✏️ Editou a essência: ${ess}. Gênero atual: ${gen || 'Indefinido'}`; const py = { usuario: usuarioLogado, acao: "atualizar_rotulo", linha: document.getElementById('edit-r-linha').value, essencia: ess, codigo_forn: padronizarTexto(document.getElementById('edit-r-codigo-forn').value), marca: padronizarTexto(document.getElementById('edit-r-marca').value), genero: gen, log_detalhe: msgLog }; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify(py) }).then(r => r.json()).then(json => { if (json.sucesso) { document.getElementById('modal-editar-rotulo').style.display = 'none'; mostrarAlerta("Atualizado!", "Edição salva.", "success"); sincronizarDadosUnico(); } }).catch(e => mostrarAlerta("Erro", "Falha de conexão.", "error")).finally(() => ocultarLoading()); }

let custoTotalGlobal = 0;
function calcularNovera() { const cFrag = parseFloat(document.getElementById('n-custo-frag').value) || 0; const qFrag = parseFloat(document.getElementById('n-qtd-frag').value) || 0; const cBase1L = parseFloat(document.getElementById('n-custo-base').value) || 0; const qBase = parseFloat(document.getElementById('n-qtd-base').value) || 0; const mlVenda = parseFloat(document.getElementById('n-ml-venda').value) || 1; const cInsumos = parseFloat(document.getElementById('n-insumos').value) || 0; const valorMlBase = cBase1L / 1000; const qtdMlProducao = qBase + qFrag; const qtdFrascos = qtdMlProducao / mlVenda; const custoLiquidoUni = qtdFrascos > 0 ? (cFrag + (valorMlBase * qBase)) / qtdFrascos : 0; const custoTotalUni = custoLiquidoUni + cInsumos; custoTotalGlobal = custoTotalUni; document.getElementById('r-frascos').innerText = Math.floor(qtdFrascos) + " un"; document.getElementById('r-custo-total').innerText = fmt(custoTotalUni); document.getElementById('p-rendimento').value = Math.floor(qtdFrascos); autoSugerirPrecoFabrica(); }
function autoSugerirPrecoFabrica() { if (!document.getElementById('p-preco-venda').value) { document.getElementById('p-preco-venda').value = fmt(custoTotalGlobal * 3); } }
async function salvarProducaoEstoque() { const essBaseVal = document.getElementById('n-produto').value; const tipoFinal = padronizarTexto(document.getElementById('n-tipo-final').value); const volume = document.getElementById('n-ml-venda').value; const qtdRendimento = document.getElementById('p-rendimento').value; const precoVendaStr = document.getElementById('p-preco-venda').value; const pLocal = document.getElementById('p-local') ? padronizarTexto(document.getElementById('p-local').value) : "Sede"; if (!essBaseVal || !tipoFinal || !qtdRendimento || !precoVendaStr) return mostrarAlerta("Atenção", "Preencha a Essência Base, Tipo, Rendimento e Preço.", "warning"); const partes = essBaseVal.split('|'); const codNovera = partes[0]; const essBase = partes[1]; const nomeProdutoFinal = `${tipoFinal} ${essBase} ${volume}ml`; const precoVenda = parseDinheiro(precoVendaStr); mostrarLoading("Enviando..."); const msgLog = `🏭 Fabricou ${qtdRendimento}x [${nomeProdutoFinal}]. Enviado para: ${pLocal}.`; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "salvar_producao_estoque", nome_produto: nomeProdutoFinal, tipo: tipoFinal, qtd: qtdRendimento, custo: fmtPlanilha(custoTotalGlobal), preco: fmtPlanilha(precoVenda), codigo: codNovera, local: pLocal, log_detalhe: msgLog }) }).then(() => { mostrarAlerta("Produzido!", `Lote enviado para ${pLocal}.`, "success"); document.getElementById('p-rendimento').value = "1"; document.getElementById('p-preco-venda').value = ""; sincronizarDadosUnico(); }); }


function salvarFilaProducao() {
    const essBaseVal = document.getElementById('n-produto').value; 
    const tipoFinal = padronizarTexto(document.getElementById('n-tipo-final').value); 
    const volume = document.getElementById('n-ml-venda').value; 
    const qtdRendimento = document.getElementById('p-rendimento').value; 
    const precoVendaStr = document.getElementById('p-preco-venda').value; 
    
    // CAPTURA A QUANTIDADE DE DIAS AO INVÉS DE UMA DATA FIXA
    const diasMaceracao = parseInt(document.getElementById('p-dias-maceracao').value) || 0;
    
    if (!essBaseVal || !tipoFinal || !qtdRendimento || !precoVendaStr) {
        return mostrarAlerta("Atenção", "Preencha todos os campos do controle de produção.", "warning"); 
    }
    
    // O SISTEMA CALCULA A DATA DE PREVISÃO AUTOMATICAMENTE
    const dataHojeCalculo = new Date();
    dataHojeCalculo.setDate(dataHojeCalculo.getDate() + diasMaceracao);
    const dataPrev = dataHojeCalculo.toISOString().split('T')[0];
    
    const partes = essBaseVal.split('|'); const codNovera = partes[0]; const essBase = partes[1]; 
    const nomeProdutoFinal = `${tipoFinal} ${essBase} ${volume}ml`; 
    const precoVenda = parseDinheiro(precoVendaStr); 
    const dataInicio = new Date().toISOString().split('T')[0];

    mostrarLoading("Colocando na Fila..."); 
    const msgLog = `⏳ Maceração: ${qtdRendimento}x [${nomeProdutoFinal}]. Previsão para: ${dataBR(dataPrev)} (${diasMaceracao} dias).`; 
    
    fetch(API_NOVERA, { 
        method: "POST", headers: cabecalhoAuth(), 
        body: JSON.stringify({ usuario: usuarioLogado, acao: "salvar_producao_fila", data_inicio: dataInicio, data_previsao: dataPrev, nome_produto: nomeProdutoFinal, tipo: tipoFinal, qtd_prevista: qtdRendimento, custo: fmtPlanilha(custoTotalGlobal), preco: fmtPlanilha(precoVenda), codigo: codNovera, log_detalhe: msgLog }) 
    }).then(() => { 
        mostrarAlerta("Na Fila!", `Maceração iniciada para ${diasMaceracao} dia(s).`, "success"); 
        document.getElementById('p-rendimento').value = "1"; 
        document.getElementById('p-preco-venda').value = ""; 
        document.getElementById('p-dias-maceracao').value = "15"; 
        sincronizarDadosUnico(); 
    });
}

function renderizarProducao() {
    const fila = document.getElementById('lista-producao-cards'); 
    const resumo = document.getElementById('resumo-producao');
    
    let pends = producaoGlobal.filter(p => p.status === 'Em Andamento'); 
    pends.sort((a, b) => new Date(a.data_previsao) - new Date(b.data_previsao)); 
    
    if (pends.length === 0) { 
        fila.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Nenhuma maceração / produção na fila.</p>"; 
        if(resumo) resumo.innerHTML = "";
        return; 
    } 
    
    // Pegando a data de hoje sem horas para a matemática ficar exata
    const hojeObj = new Date();
    hojeObj.setHours(0, 0, 0, 0); 
    
    let totalUnidades = 0, countFem = 0, countMasc = 0, countInf = 0, countUni = 0;
    let html = ""; 
    
    pends.forEach(p => {
        const q = parseFloat(p.qtd_prevista) || 0;
        totalUnidades += q;
        
        const rotuloRef = rotulosGlobal.find(r => r.codigo === p.codigo);
        const gen = rotuloRef && rotuloRef.genero ? String(rotuloRef.genero).toLowerCase().trim() : 'unissex';
        
        if (gen === 'feminino') countFem += q;
        else if (gen === 'masculino') countMasc += q;
        else if (gen === 'infantil') countInf += q;
        else countUni += q;

        // MATEMÁTICA 1: Dias Faltantes
        const [a, m, d] = p.data_previsao.split('-'); 
        const prevObj = new Date(a, m - 1, d);
        const diffTimeFalta = prevObj.getTime() - hojeObj.getTime();
        const diffDaysFalta = Math.ceil(diffTimeFalta / (1000 * 60 * 60 * 24));

        // MATEMÁTICA 2: Dias já Macerando (Dias corridos)
        const [iA, iM, iD] = p.data_inicio.split('-');
        const inicioObj = new Date(iA, iM - 1, iD);
        const diffTimeInicio = hojeObj.getTime() - inicioObj.getTime();
        const diasMacerando = Math.floor(diffTimeInicio / (1000 * 60 * 60 * 24));
        
        let textoMacerando = diasMacerando === 0 ? "Iniciado hoje" : `Macerando há ${diasMacerando} dia(s)`;

        let classBadge = "b-futuro"; 
        let textoBadge = "";
        
        if (diffDaysFalta < 0) { 
            classBadge = "b-atrasado"; 
            textoBadge = `Atrasado ${Math.abs(diffDaysFalta)} dia(s)`; 
        } else if (diffDaysFalta === 0) { 
            classBadge = "b-hoje"; 
            textoBadge = "Envasar Hoje!"; 
        } else {
            textoBadge = `⏳ Faltam ${diffDaysFalta} dia(s)`;
        }
        
        const dataDisplay = dataBR(p.data_previsao);
        const dataInicioDisplay = dataBR(p.data_inicio);
        
        let corFundoGen = "#f3f4f6", corTextoGen = "#4b5563";
        if(gen === "masculino") { corFundoGen = "#e0f2fe"; corTextoGen = "#0369a1"; }
        else if(gen === "feminino") { corFundoGen = "#fce7f3"; corTextoGen = "#be185d"; }
        let badgeGenero = rotuloRef && rotuloRef.genero ? `<span style="background:${corFundoGen}; color:${corTextoGen}; padding:2px 6px; border-radius:4px; font-size:0.6rem; font-weight:800; text-transform:uppercase; margin-left:5px; vertical-align: middle;">${rotuloRef.genero}</span>` : '';
        
        // NOVO CARTÃO ESPAÇOSO (Sem cortes no nome e com botões no rodapé)
        html += `
        <div class="rotulo-card" style="flex-direction: column; align-items: stretch; gap: 10px; padding: 18px;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <h4 style="margin: 0; line-height: 1.4; font-size: 0.95rem; color: var(--brand-dark);">
                    <span style="background:var(--primary-dark); color:white; padding:2px 6px; border-radius:4px; font-size:0.65rem; margin-right:5px; vertical-align: middle;">${p.codigo}</span>
                    ${p.nome_produto} ${badgeGenero}
                </h4>
                
                <div style="background: #fdf5f7; border: 1px solid #f3d8e2; border-radius: 8px; padding: 10px; margin-top: 5px;">
                    <p style="color:var(--primary-dark); font-weight:800; font-size:0.75rem; margin: 0 0 6px 0;">
                        <span class="badge-status ${classBadge}" style="margin-left:0; padding:4px 8px; vertical-align: middle;">${textoBadge}</span>
                    </p>
                    <p style="font-size: 0.75rem; color: var(--brand-dark); font-weight: 700; margin: 0;">🧪 ${textoMacerando}</p>
                </div>

                <p style="font-size: 0.65rem; color: #888; margin: 5px 0 0 0;">📅 Início: ${dataInicioDisplay} | Fim: ${dataDisplay}</p>
                <p style="font-size: 0.75rem; margin: 0;">Meta de Envase: <b style="color:var(--brand-dark);">${p.qtd_prevista} un</b></p>
            </div>
            
            <div style="display:flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 12px; margin-top: 5px;">
                <div style="display:flex; gap:6px;">
                    <button class="btn-acao" onclick="abrirModalEditarProducao(${p.linha})" title="Editar Previsão">✏️</button>
                    <button class="btn-acao" onclick="prepararExclusaoRegistro('Produção', ${p.linha}, 'Lote: ${p.nome_produto}')" title="Cancelar Produção">🗑️</button>
                </div>
                <button class="btn-salvar" style="margin-top:0; padding:10px 15px; font-size:0.75rem; background:#2e7d32; width: auto; box-shadow: 0 4px 10px rgba(46, 125, 50, 0.2);" onclick="abrirModalFinalizarProducao(${p.linha})">✔️ FINALIZAR LOTE</button>
            </div>
        </div>`;
    }); 
    
    fila.innerHTML = html;
    
    if (resumo) {
        resumo.innerHTML = `
            <div class="dash-card highlight" style="grid-column: span 2; padding: 15px; margin-bottom: 0; text-align:center;">
                <h3 style="color:#e8dde1; font-size:0.75rem;">Volume Total em Maceração</h3>
                <p class="valor" style="font-size: 2rem;">${totalUnidades} un</p>
            </div>
            <div class="dash-card" style="padding: 12px; background:#fff0f6; border: 1px solid #fce7f3; transform:none; cursor:default;">
                <h3 style="color:#be185d; font-size:0.65rem;">Femininos</h3>
                <p class="valor" style="font-size: 1.4rem; color:#be185d;">${countFem}</p>
            </div>
            <div class="dash-card" style="padding: 12px; background:#f0f9ff; border: 1px solid #e0f2fe; transform:none; cursor:default;">
                <h3 style="color:#0369a1; font-size:0.65rem;">Masculinos</h3>
                <p class="valor" style="font-size: 1.4rem; color:#0369a1;">${countMasc}</p>
            </div>
        `;
    }
}

function abrirModalFinalizarProducao(id) {
    const p = producaoGlobal.find(x => x.linha === id);
    if(!p) return;
    document.getElementById('mfp-linha').value = p.linha;
    document.getElementById('mfp-produto').innerText = p.nome_produto;
    document.getElementById('mfp-qtd-real').value = p.qtd_prevista;
    
    // FORMATANDO OS VALORES PARA APARECEREM NA TELA COM O "R$"
    document.getElementById('mfp-custo').value = safeFmt(p.custo_unitario);
    document.getElementById('mfp-preco').value = safeFmt(p.preco_sugerido);
    
    document.getElementById('mfp-codigo').value = p.codigo;
    document.getElementById('mfp-tipo').value = p.tipo;
    document.getElementById('modal-finalizar-producao').style.display = 'flex';
}

function confirmarFinalizarProducao() {
    const linha = document.getElementById('mfp-linha').value;
    const nome_produto = document.getElementById('mfp-produto').innerText;
    const qtdReal = document.getElementById('mfp-qtd-real').value;
    const local = padronizarTexto(document.getElementById('mfp-local').value) || 'Sede';
    
    // CAPTURANDO OS VALORES DIGITADOS E REMOVENDO A MÁSCARA "R$"
    const custo = parseDinheiro(document.getElementById('mfp-custo').value);
    const preco = parseDinheiro(document.getElementById('mfp-preco').value);
    
    const codigo = document.getElementById('mfp-codigo').value;
    const tipo = document.getElementById('mfp-tipo').value;
    
    document.getElementById('modal-finalizar-producao').style.display = 'none';
    mostrarLoading("Envasando e Enviando..."); 
    
    const msgLog = `✅ Lote Finalizado: ${qtdReal}x [${nome_produto}]. Prateleira: ${local}. Venda: ${fmt(preco)}`; 

    fetch(API_NOVERA, { 
        method: "POST", headers: cabecalhoAuth(), 
        body: JSON.stringify({ 
            usuario: usuarioLogado, 
            acao: "finalizar_producao", 
            linha: linha, 
            nome_produto: nome_produto, 
            tipo: tipo, 
            qtd: qtdReal, 
            custo: fmtPlanilha(custo), 
            preco: fmtPlanilha(preco), 
            codigo: codigo, 
            local: local, 
            log_detalhe: msgLog 
        }) 
    }).then(() => { 
        mostrarAlerta("Pronto!", `Envase concluído. Estoque atualizado!`, "success"); 
        sincronizarDadosUnico(); 
    });
}

function renderizarEstoque() { 
    const tBusca = document.getElementById('busca-estoque').value.toLowerCase().trim(); 
    const dFiltroLocal = document.getElementById('f-e-local'); 
    const localSelecionado = dFiltroLocal ? dFiltroLocal.value.trim() : ""; 
    const dFiltroGenero = document.getElementById('f-e-genero');
    const generoSelecionado = dFiltroGenero ? dFiltroGenero.value : "";

    let arrEstoque = Object.values(estoqueAgrupado); 
    arrEstoque = arrEstoque.filter(e => { 
        let passBusca = !tBusca || (e.nome + " " + e.tipo + " " + (e.codigo || "")).toLowerCase().includes(tBusca);
        let passLocal = !localSelecionado || (e.locais[localSelecionado] !== undefined && e.locais[localSelecionado] > 0);
        let genE = e.genero ? String(e.genero).toLowerCase() : 'unissex';
        let passGenero = !generoSelecionado || genE === String(generoSelecionado).toLowerCase() || (generoSelecionado === 'Unissex' && genE === '');
        
        return passBusca && passLocal && passGenero;
    }); 
    
    arrEstoque.sort((a, b) => { 
        let qA = localSelecionado ? (a.locais[localSelecionado] || 0) : a.totalQtd; 
        let qB = localSelecionado ? (b.locais[localSelecionado] || 0) : b.totalQtd; 
        if (qA > 0 && qB <= 0) return -1; 
        if (qA <= 0 && qB > 0) return 1; 
        return String(b.codigo||"").localeCompare(String(a.codigo||"")); 
    }); 

    const lista = document.getElementById('lista-estoque-cards'); 
    if(arrEstoque.length === 0) { 
        lista.innerHTML = "<p style='text-align:center; color:#999;'>Estoque vazio ou não encontrado.</p>"; 
        document.getElementById('est-total-itens').innerText = "0"; 
        document.getElementById('est-valor-total').innerText = "R$ 0,00"; 
        return; 
    } 
    let html = "", somaItens = 0, somaValor = 0; 
    arrEstoque.forEach(e => { 
        const qtdExibicao = localSelecionado ? (e.locais[localSelecionado] || 0) : e.totalQtd; 
        const precoNum = parseDinheiro(e.preco); 
        somaItens += qtdExibicao; 
        somaValor += (qtdExibicao * precoNum); 
        let corQtd = qtdExibicao <= 0 ? "#991b1b" : (qtdExibicao < 5 ? "#ef4444" : "var(--brand-dark)"); 
        let avisoQtd = qtdExibicao <= 0 ? `<span class="badge-status b-atrasado" style="margin-left:5px;">ESGOTADO</span>` : (qtdExibicao < 5 ? `<span class="badge-status b-hoje" style="margin-left:5px;">Baixo</span>` : ""); 
        let opacidade = qtdExibicao <= 0 ? "opacity: 0.65; filter: grayscale(50%);" : ""; 
        let fotoUrls = e.foto ? e.foto.split(',') : []; 
        let urlPri = fotoUrls[0] || 'logo.png'; 
        let codigoBadge = e.codigo ? `<span style="background:var(--primary-dark); color:white; padding:2px 6px; border-radius:4px; font-size:0.65rem; margin-right:5px;">${e.codigo}</span>` : ''; 
        
        let corFundoGen = "#f3f4f6", corTextoGen = "#4b5563";
        let gLow = String(e.genero).toLowerCase();
        if(gLow === "masculino") { corFundoGen = "#e0f2fe"; corTextoGen = "#0369a1"; }
        else if(gLow === "feminino") { corFundoGen = "#fce7f3"; corTextoGen = "#be185d"; }
        else if(gLow === "infantil") { corFundoGen = "#dcfce7"; corTextoGen = "#166534"; }
        let badgeGenero = e.genero ? `<span style="background:${corFundoGen}; color:${corTextoGen}; padding:2px 6px; border-radius:4px; font-size:0.6rem; font-weight:800; text-transform:uppercase; margin-left:5px;">${e.genero}</span>` : '';

        let locaisHtml = `<div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;">`; 
        for(let loc in e.locais) { 
            if(e.locais[loc] > 0) { 
                locaisHtml += `<span style="background:#f3f4f6; color:#4b5563; padding:3px 8px; border-radius:6px; font-size:0.65rem; font-weight:700; border:1px solid #e5e7eb;">📍 ${loc}: <b style="color:var(--primary-dark);">${e.locais[loc]}</b></span>`; 
            } 
        } 
        locaisHtml += `</div>`; 
        if (qtdExibicao <= 0) locaisHtml = ""; 
        
        const nomeEncode = encodeURIComponent(e.nome); 
        html += `<div class="rotulo-card" style="align-items:flex-start; ${opacidade}"><img src="${urlPri}" onerror="this.src='logo.png';" class="list-img" onclick="abrirModalImagem(this.src)"><div class="rotulo-info" style="flex:1;"><h4>${codigoBadge}${e.nome} ${badgeGenero} ${avisoQtd}</h4><p style="color:var(--primary); font-weight:700; margin-bottom:2px;">Venda: ${safeFmt(e.preco)}</p><p style="font-size:0.7rem; color:#888; margin-bottom:0;">Custo Fábrica: ${safeFmt(e.custo)}</p>${locaisHtml}</div><div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;"><div class="custo-val" style="color:${corQtd};">${qtdExibicao} un</div><div style="display:flex; gap:5px;"><button class="btn-acao" onclick="abrirModalEditarEstoque('${nomeEncode}')" title="Editar Distribução">✏️</button></div></div></div>`; 
    }); 
    lista.innerHTML = html; document.getElementById('est-total-itens').innerText = somaItens; document.getElementById('est-valor-total').innerText = fmt(somaValor); 
}

function abrirModalEditarEstoque(nomeEncoded) { const nomeDecoded = decodeURIComponent(nomeEncoded); const e = estoqueAgrupado[padronizarTexto(nomeDecoded)]; if (!e) return; document.getElementById('edit-e-nome').value = e.nome; document.getElementById('edit-e-tipo').value = e.tipo; document.getElementById('edit-e-custo').value = safeFmt(e.custo); document.getElementById('edit-e-preco').value = safeFmt(e.preco); document.getElementById('edit-e-codigo').value = e.codigo || ''; let fotos = e.foto ? e.foto.split(',') : []; document.getElementById('edit-e-img-preview').src = fotos[0] || 'logo.png'; document.getElementById('img-original-preview').src = fotos[0] || 'logo.png'; document.getElementById('edit-e-foto-antiga').value = e.foto || ''; document.getElementById('edit-e-foto-nova').value = ''; document.getElementById('ai-preview-box').style.display = 'none'; const container = document.getElementById('edit-e-locais-container'); container.innerHTML = ''; for (let loc in e.locais) { adicionarLinhaLocal(loc, e.locais[loc]); } if (Object.keys(e.locais).length === 0) adicionarLinhaLocal('Sede', 0); document.getElementById('modal-editar-estoque').style.display = 'flex'; }
function adicionarLinhaLocal(loc = '', qtd = 0) { const div = document.createElement('div'); div.className = 'row edit-local-row'; div.style.marginBottom = '5px'; div.innerHTML = `<div class="col"><input type="text" class="edit-l-nome" value="${loc}" list="lista-locais-estoque" placeholder="Ex: Sede, Casa..."></div><div class="col" style="flex:0.4"><input type="number" class="edit-l-qtd" value="${qtd}" min="0"></div><button class="btn-acao" style="margin-top:2px; height: 46px; background:#fff0f6; border-color:#fce7f3; color:#be185d;" onclick="this.parentElement.remove()" title="Remover Local">🗑️</button>`; document.getElementById('edit-e-locais-container').appendChild(div); }

async function salvarEdicaoEstoque() { 
    const fileInput = document.getElementById('edit-e-foto-nova'); let fotoFinal = document.getElementById('edit-e-foto-antiga').value; const escolha = document.getElementById('escolha-foto-ia').value; 
    if (escolha === 'ia') { 
        mostrarLoading("Enviando IA..."); 
        try { const imgSrc = document.getElementById('ai-img-result').src; const response = await fetch(imgSrc); const blob = await response.blob(); const file = new File([blob], "produto_ia.jpg", { type: "image/jpeg" }); if (!KEY_IMGBB && !TOKEN_ONIONSYS) throw new Error("Chaves ausentes."); fotoFinal = await uploadDuplo(file); } catch (e) { ocultarLoading(); return mostrarAlerta("Erro", "Falha ao salvar foto da IA.", "error"); } 
    } else if (fileInput.files.length > 0 && escolha === 'original') { 
        mostrarLoading("Enviando Imagem..."); 
        try { const blob = await comprimirImagem(fileInput.files[0], 800, 800, 0.8); if (!KEY_IMGBB && !TOKEN_ONIONSYS) throw new Error("Chaves ausentes."); fotoFinal = await uploadDuplo(blob); } catch (err) { ocultarLoading(); return mostrarAlerta("Erro", err.message, "error"); } 
    } 
    const nome = document.getElementById('edit-e-nome').value; const tipo = document.getElementById('edit-e-tipo').value; const c = parseDinheiro(document.getElementById('edit-e-custo').value); const p = parseDinheiro(document.getElementById('edit-e-preco').value); const cod = document.getElementById('edit-e-codigo').value; const rows = document.querySelectorAll('.edit-local-row'); const distribuicao = []; rows.forEach(r => { let loc = r.querySelector('.edit-l-nome').value.trim(); let q = parseFloat(r.querySelector('.edit-l-qtd').value) || 0; if (loc) distribuicao.push({ local: loc, qtd: q }); }); const oldE = estoqueAgrupado[padronizarTexto(nome)]; const oldTotal = oldE ? oldE.totalQtd : 0; const newTotal = distribuicao.reduce((sum, d) => sum + d.qtd, 0); const descLocais = distribuicao.length > 0 ? distribuicao.map(d => `${d.qtd} no(a) ${d.local}`).join(' e ') : "Estoque Zerado"; const msgLog = `📦 Ajuste [${nome}]: Tinha ${oldTotal} un -> Ficou com ${newTotal} un. (${descLocais})`; 
    document.getElementById('modal-editar-estoque').style.display = 'none'; 
    mostrarLoading("Atualizando Servidor..."); 
    try { 
        const py = { usuario: usuarioLogado, acao: "atualizar_estoque_multilocal", nome: nome, tipo: tipo, custo: fmtPlanilha(c), preco: fmtPlanilha(p), foto: fotoFinal, codigo: cod, distribuicao: distribuicao, log_detalhe: msgLog }; 
        fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify(py) }).then(() => { mostrarAlerta("Atualizado!", "Estoque Multi-Local ajustado.", "success"); sincronizarDadosUnico(); }); 
    } catch (e) { } 
}

function abrirModalCatalogo() { const tipos = new Set(estoqueGlobal.map(e => padronizarTexto(e.tipo)).filter(t => t)); let html = `<label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:10px; cursor:pointer;"><input type="checkbox" id="cat-todas" onchange="toggleTodasCategorias(this)" checked style="width:16px; height:16px; flex-shrink:0;"> <strong>Selecionar Todas</strong></label><div style="border-top:1px dashed #E8DDE1; margin-bottom:10px;"></div>`;[...tipos].forEach(t => { let nomeBonito = t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); html += `<label style="display:flex; align-items:center; gap:8px; font-size:0.8rem; margin-bottom:8px; cursor:pointer;"><input type="checkbox" class="chk-cat-tipo" value="${t}" checked onchange="verificarCategorias()" style="width:16px; height:16px; flex-shrink:0;"> ${nomeBonito}</label>`; }); document.getElementById('cat-checkbox-container').innerHTML = html; document.getElementById('modal-gerar-catalogo').style.display = 'flex'; }
function toggleTodasCategorias(source) { const checkboxes = document.querySelectorAll('.chk-cat-tipo'); checkboxes.forEach(cb => cb.checked = source.checked); }
function verificarCategorias() { const checkboxes = document.querySelectorAll('.chk-cat-tipo'); const todas = document.getElementById('cat-todas'); const marcadas = document.querySelectorAll('.chk-cat-tipo:checked').length; todas.checked = (marcadas === checkboxes.length); }

async function gerarCatalogoPDFFrontend() { 
    const checkboxes = document.querySelectorAll('.chk-cat-tipo:checked'); 
    if (checkboxes.length === 0) return mostrarAlerta("Aviso", "Selecione pelo menos uma categoria.", "warning"); 
    const tiposSelecionados = Array.from(checkboxes).map(cb => String(cb.value).toLowerCase().trim()); 
    
    const checkboxesGen = document.querySelectorAll('.chk-cat-genero:checked');
    if (checkboxesGen.length === 0) return mostrarAlerta("Aviso", "Selecione pelo menos um gênero.", "warning");
    const generosSelecionados = Array.from(checkboxesGen).map(cb => String(cb.value).toLowerCase().trim());

    const apenasEstoque = document.getElementById('cat-filtro-estoque').checked; 
    const exibirQtd = document.getElementById('cat-filtro-exibir-qtd').checked; 
    
    document.getElementById('modal-gerar-catalogo').style.display = 'none'; 
    mostrarLoading("Gerando..."); 
    
    let itensFiltrados = Object.values(estoqueAgrupado).filter(e => { 
        let tipoStr = String(e.tipo).toLowerCase().trim(); 
        if (tiposSelecionados.indexOf(tipoStr) === -1) return false; 
        
        let genE = String(e.genero || "Unissex").toLowerCase().trim();
        if (generosSelecionados.indexOf(genE) === -1) return false;

        if (apenasEstoque && e.totalQtd <= 0) return false; 
        return true; 
    }); 
    
    if (itensFiltrados.length === 0) { 
        ocultarLoading(); 
        return mostrarAlerta("Aviso", "Nenhum produto atende a esses filtros.", "warning"); 
    } 
    
    let html = `<div id="catalogo-export" style="padding: 30px; font-family: 'Montserrat', sans-serif; color: #2C2A2B; background: #fff;"><div style="text-align: center; border-bottom: 2px solid #E8DDE1; padding-bottom: 20px; margin-bottom: 30px;"><h1 style="color: #966178; font-family: 'Playfair Display', serif; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 3px;">Novera Scent</h1><h2 style="font-size: 16px; font-weight: 500; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Catálogo de Produtos</h2></div><div style="display: flex; flex-direction: column; gap: 15px;">`; 
    itensFiltrados.forEach(e => { 
        let nomeSemTipo = e.nome.replace(new RegExp('^' + e.tipo + '\\s*', 'i'), '').trim().replace(/^[- ]+/, ""); 
        let nomeCompleto = e.codigo ? `${e.codigo} - Inspiração: ${nomeSemTipo}` : `Inspiração: ${nomeSemTipo}`; 
        let fotoUrls = e.foto ? e.foto.split(',') : []; 
        let urlImg = fotoUrls[0] ? fotoUrls[0] : ''; 
        let imgTag = urlImg ? `<img src="${urlImg}" crossorigin="anonymous" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #E8DDE1; flex-shrink: 0;">` : `<div style="width: 80px; height: 80px; background: #fdf5f7; border-radius: 8px; border: 1px solid #E8DDE1; display:flex; align-items:center; justify-content:center; color:#966178; font-weight:bold; font-size:20px; flex-shrink: 0;">NS</div>`; 
        let qtdHtml = exibirQtd ? (e.totalQtd > 0 ? `<div style="font-size: 10px; color: #2e7d32; font-weight: 800; margin-top: 5px;">📦 Estoque: ${e.totalQtd} un</div>` : `<div style="font-size: 10px; color: #991b1b; font-weight: 800; margin-top: 5px;">🚫 ESGOTADO</div>`) : ""; 
        html += `<div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #E8DDE1; border-radius: 12px; padding: 15px; page-break-inside: avoid;"><div style="display: flex; gap: 15px; align-items: center; overflow: hidden;">${imgTag}<div style="min-width: 0;"><p style="margin: 0 0 5px 0; font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${nomeCompleto}</p><span style="background: #fdf5f7; color: #966178; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;">${e.tipo}</span>${qtdHtml}</div></div><div style="font-weight: 800; font-size: 18px; color: #966178; flex-shrink: 0; padding-left: 10px;">${safeFmt(e.preco)}</div></div>`; 
    }); 
    html += `</div><div style="text-align: center; margin-top: 30px; font-size: 10px; color: #888; border-top: 1px solid #E8DDE1; padding-top: 15px;">Atualizado em ${new Date().toLocaleDateString('pt-BR')}</div></div>`; 
    let tempDiv = document.createElement('div'); 
    tempDiv.innerHTML = html; 
    tempDiv.style.position = 'absolute'; 
    tempDiv.style.left = '-9999px'; 
    document.body.appendChild(tempDiv); 
    try { 
        let opt = { margin: 10, filename: `Catalogo_Novera_${new Date().getTime()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }; 
        await html2pdf().set(opt).from(tempDiv.firstChild).save(); 
        mostrarAlerta("Sucesso", "Catálogo gerado!", "success"); 
    } catch(err) { 
        mostrarAlerta("Erro", "Falha PDF.", "error"); 
    } finally { 
        document.body.removeChild(tempDiv); 
        ocultarLoading(); 
    } 
}

function renderizarCompras() {
    const fila = document.getElementById('lista-compras-cards'); const tBusca = document.getElementById('busca-compras').value.toLowerCase().trim(); let pends = comprasGlobal.filter(c => c.status !== 'Comprado'); if (tBusca) { pends = pends.filter(c => (c.item + " " + c.categoria).toLowerCase().includes(tBusca)); } pends.sort((a, b) => new Date(a.dataPrevista) - new Date(b.dataPrevista)); if (comprasGlobal.length === 0) { fila.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Nenhuma compra planejada.</p>"; return; } if (pends.length === 0) { fila.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Tudo comprado ou não encontrado!</p>"; return; } const hojeIso = new Date().toISOString().split('T')[0]; let html = ""; pends.forEach(c => {
        let classBadge = "b-futuro"; let textoBadge = "No prazo";
        if (c.dataPrevista < hojeIso) { classBadge = "b-atrasado"; textoBadge = "Atrasado"; } else if (c.dataPrevista === hojeIso) { classBadge = "b-hoje"; textoBadge = "Hoje"; }
        const valorTotalCompra = parseDinheiro(c.valor_previsto) * (parseInt(c.qtd) || 1);
        html += `<div class="rotulo-card" style="gap: 12px; align-items: center;"><input type="checkbox" class="chk-item-compra-lote" value="${c.linha}" style="width:22px; height:22px; accent-color:var(--primary-dark); cursor:pointer; margin:0; flex-shrink:0;"><div class="rotulo-info" style="flex:1; min-width:0;"><h4 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.item} <span class="badge-status ${classBadge}" style="margin-left:5px;">${textoBadge}</span></h4><p style="color:var(--primary); font-weight:800; font-size:0.7rem;">Previsto: ${c.dataDisplay}</p><p><b>${c.qtd}x</b> • Categoria: ${c.categoria}</p><p style="font-size:0.7rem; color:#888; font-weight:700; margin-top:3px;">Unitário: ${safeFmt(c.valor_previsto)} | <span style="color:#A05252;">Total: ${fmt(valorTotalCompra)}</span></p></div><div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end; flex-shrink:0;"><button class="btn-salvar" style="margin-top:0; padding:8px 12px; font-size:0.75rem; background:#2e7d32;" onclick="abrirModalCompra(${c.linha})" title="Efetuar Compra Individual">✔️ Lançar</button><div style="display:flex; gap:4px;"><button class="btn-acao" onclick="abrirModalEditarCompra(${c.linha})" title="Editar Planejamento">✏️</button><button class="btn-acao" onclick="prepararExclusaoRegistro('Compras', ${c.linha}, '${c.item}')" title="Excluir">🗑️</button></div></div></div>`;
    }); fila.innerHTML = html;
}

function salvarCompra() { const data = document.getElementById('c-data').value; const cat = padronizarTexto(document.getElementById('c-categoria').value); const item = padronizarTexto(document.getElementById('c-item').value); const qtd = document.getElementById('c-qtd').value; const val = document.getElementById('c-valor').value; if (!data || !item) return mostrarAlerta("Atenção", "Preencha a Data e o Item.", "warning"); mostrarLoading("Salvando..."); const msgLog = `📝 Planejou comprar ${qtd}x [${item}]`; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "salvar_compra", data: data, categoria: cat, item: item, qtd: qtd, valor: fmtPlanilha(parseDinheiro(val)), log_detalhe: msgLog }) }).then(() => { mostrarAlerta("Adicionado", "Item na lista de compras.", "success"); document.getElementById('c-item').value = ""; document.getElementById('c-valor').value = ""; sincronizarDadosUnico(); }); }
function abrirModalCompra(linha) { const c = comprasGlobal.find(x => x.linha === linha); if (!c) return; document.getElementById('mc-linha').value = c.linha; document.getElementById('mc-qtd').value = c.qtd; document.getElementById('mc-item-nome').innerText = c.item; document.getElementById('mc-valor-unit').value = safeFmt(c.valor_previsto); calcularTotalCompraModal(); document.getElementById('modal-comprar-item').style.display = 'flex'; }
function calcularTotalCompraModal() { const q = parseFloat(document.getElementById('mc-qtd').value) || 1; const vu = parseDinheiro(document.getElementById('mc-valor-unit').value); document.getElementById('mc-total').value = fmt(q * vu); }
function confirmarCompraModal() { const linha = document.getElementById('mc-linha').value; const c = comprasGlobal.find(x => x.linha == linha); const local = padronizarTexto(document.getElementById('mc-local').value); const socio = padronizarTexto(document.getElementById('mc-socio').value); const valorUnit = document.getElementById('mc-valor-unit').value; const total = document.getElementById('mc-total').value; document.getElementById('modal-comprar-item').style.display = 'none'; mostrarLoading("Lançando Despesa..."); const msgLog = `🛒 Efetuou compra de [${c.item}]. Gasto total: ${total} lançado nas despesas.`; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "marcar_comprado", linha: linha, item: c.item, qtd: c.qtd, local: local, socio: socio, valor_unitario: fmtPlanilha(parseDinheiro(valorUnit)), total: fmtPlanilha(parseDinheiro(total)), log_detalhe: msgLog }) }).then(() => { mostrarAlerta("Pronto!", "Baixa dada e Gasto registrado.", "success"); sincronizarDadosUnico(); }); }
function abrirModalEditarCompra(linha) { const c = comprasGlobal.find(x => x.linha === linha); if (!c) return; document.getElementById('edit-c-linha').value = c.linha; document.getElementById('edit-c-item').value = c.item; document.getElementById('edit-c-qtd').value = c.qtd; document.getElementById('edit-c-valor').value = safeFmt(c.valor_previsto); document.getElementById('edit-c-data').value = c.dataPrevista; document.getElementById('edit-c-categoria').value = c.categoria; document.getElementById('modal-editar-compra').style.display = 'flex'; }
function salvarEdicaoCompra() { const linha = document.getElementById('edit-c-linha').value; const item = padronizarTexto(document.getElementById('edit-c-item').value); const qtd = document.getElementById('edit-c-qtd').value; const valor = parseDinheiro(document.getElementById('edit-c-valor').value); const data = document.getElementById('edit-c-data').value; const cat = padronizarTexto(document.getElementById('edit-c-categoria').value); document.getElementById('modal-editar-compra').style.display = 'none'; mostrarLoading("Atualizando..."); const msgLog = `✏️ Atualizou planejamento de compra: ${qtd}x [${item}]`; const py = { usuario: usuarioLogado, acao: "excluir_registro", aba: "Compras", linha: linha }; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify(py) }).then(() => { fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "salvar_compra", data: data, categoria: cat, item: item, qtd: qtd, valor: fmtPlanilha(valor), log_detalhe: msgLog }) }).then(() => { mostrarAlerta("Atualizado!", "Planejamento alterado.", "success"); sincronizarDadosUnico(); }); }); }
function abrirModalCompraLote() { const marcados = document.querySelectorAll('.chk-item-compra-lote:checked'); if (marcados.length === 0) return mostrarAlerta("Aviso", "Selecione ao menos um item da fila para lançar.", "warning"); document.getElementById('modal-comprar-lote').style.display = 'flex'; }
async function confirmarCompraLoteModal() { const checkboxes = document.querySelectorAll('.chk-item-compra-lote:checked'); const local = padronizarTexto(document.getElementById('mcl-local').value); const socio = padronizarTexto(document.getElementById('mcl-socio').value); if (!local || !socio) return mostrarAlerta("Atenção", "Informe o Fornecedor e o Sócio.", "warning"); document.getElementById('modal-comprar-lote').style.display = 'none'; mostrarLoading("Lançando Lote..."); let itensStr = []; for (let chk of checkboxes) { let c = comprasGlobal.find(x => x.linha == chk.value); if (c) { itensStr.push(c.item); let totalGasto = (parseFloat(c.qtd) || 1) * parseFloat(c.valor_previsto); await fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "marcar_comprado", linha: c.linha, item: c.item, qtd: c.qtd, local: local, socio: socio, valor_unitario: fmtPlanilha(c.valor_previsto), total: fmtPlanilha(totalGasto), log_detalhe: `🛒 Compra em lote: ${c.item}` }) }); } } mostrarAlerta("Lote Enviado!", "Os itens foram processados.", "success"); sincronizarDadosUnico(); }
function excluirComprasEmLote() { const checkboxes = document.querySelectorAll('.chk-item-compra-lote:checked'); if (checkboxes.length === 0) return mostrarAlerta("Aviso", "Marque os itens.", "warning"); abrirConfirmacao("Excluir Selecionados?", `Deseja apagar ${checkboxes.length} itens marcados?`, "🗑️", "#A05252", "#803f3f", "🗑️ Confirmar", async () => { mostrarLoading("Apagando..."); for (let chk of checkboxes) { await fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "excluir_registro", aba: "Compras", linha: chk.value, log_detalhe: `🗑️ Excluiu compra em lote.` }) }); } mostrarAlerta("Removidos!", "Itens apagados.", "success"); sincronizarDadosUnico(); }); }

function calcularTotalGasto() { const qtd = parseFloat(document.getElementById('g-qtd').value) || 1; const valUnit = parseDinheiro(document.getElementById('g-valor').value); document.getElementById('g-total').value = valUnit > 0 ? fmt(qtd * valUnit) : "R$ 0,00"; }
function calcularEditGasto() { const qtd = parseFloat(document.getElementById('edit-g-qtd').value) || 1; const valUnit = parseDinheiro(document.getElementById('edit-g-valor').value); document.getElementById('edit-g-total').value = valUnit > 0 ? fmt(qtd * valUnit) : "R$ 0,00"; }

function salvarGasto() {
    const data = document.getElementById('g-data').value,
        local = padronizarTexto(document.getElementById('g-local').value),
        socio = padronizarTexto(document.getElementById('g-socio').value),
        item = padronizarTexto(document.getElementById('g-item').value),
        qtd = document.getElementById('g-qtd').value,
        valor = parseDinheiro(document.getElementById('g-valor').value),
        total = parseDinheiro(document.getElementById('g-total').value);

    if (!data || !item || valor === 0) return mostrarAlerta("Atenção", "Preencha a Data, Item e Valor.", "warning");

    mostrarLoading("Salvando...");
    const msgLog = `💸 Lançou despesa: [${item}] valor de ${fmtPlanilha(total)}`;

    fetch(API_NOVERA, {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({
            usuario: usuarioLogado,
            acao: "salvar_gasto",
            data: data,
            local: local,
            socio: socio,
            item: item,
            qtd: qtd,
            valor: fmtPlanilha(valor),
            total: fmtPlanilha(total),
            log_detalhe: msgLog
        })
    })
        .then(r => r.json())
        .then(resultado => {
            if (resultado.sucesso) {
                mostrarAlerta("Sucesso", "Despesa lançada.", "success");
                document.getElementById('g-item').value = "";
                document.getElementById('g-valor').value = "";
                document.getElementById('g-total').value = "";
                sincronizarDadosUnico();
            } else {
                mostrarAlerta("Erro", resultado.erro || "Falha ao salvar no banco.", "error");
            }
        })
        .catch(e => mostrarAlerta("Erro", "Falha na conexão.", "error"))
        .finally(() => ocultarLoading());
}

function renderizarGastos() { const fSocio = document.getElementById('f-socio').value.toLowerCase(); const fIni = document.getElementById('f-data-ini').value; const fFim = document.getElementById('f-data-fim').value; const tBusca = document.getElementById('busca-gastos').value.toLowerCase().trim(); let filtrados = gastosGlobal.filter(g => { let passSocio = fSocio === "" || String(g.socio).toLowerCase().includes(fSocio); let passData = true; if (fIni && g.dataIso < fIni) passData = false; if (fFim && g.dataIso > fFim) passData = false; let passBusca = true; if (tBusca) { const txtAll = (g.item + " " + g.local + " " + g.socio).toLowerCase(); if (!txtAll.includes(tBusca)) passBusca = false; } return passSocio && passData && passBusca; }); filtrados.sort((a, b) => new Date(b.dataIso) - new Date(a.dataIso)); let somaTotal = 0, html = ""; if (filtrados.length === 0) { html = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Vazio.</p>"; } else { filtrados.forEach(g => { somaTotal += parseDinheiro(g.total); html += `<div class="rotulo-card"><div class="rotulo-info"><h4>${g.item} <span style="font-size:0.7rem; color:var(--primary); font-weight:800;">${g.dataDisplay}</span></h4><p>${g.local} • Sócio: <b>${g.socio || '-'}</b></p><p style="font-size: 0.7rem; color:#888;">Qtd: ${g.qtd}x ${safeFmt(g.valor)}</p></div><div style="display:flex; gap:12px; align-items:center;"><div class="custo-val" style="color:#A05252;">${safeFmt(g.total)}</div><div style="display:flex; gap:5px;"><button class="btn-acao" onclick="abrirModalEditarGasto(${g.linha})">✏️</button><button class="btn-acao" onclick="prepararExclusaoRegistro('Gastos', ${g.linha}, 'Despesa: ${g.item}')">🗑️</button></div></div></div>`; }); } document.getElementById('lista-gastos-cadastrados').innerHTML = html; document.getElementById('g-total-dashboard').innerText = fmt(somaTotal); }
function abrirModalEditarGasto(linha) { const g = gastosGlobal.find(x => x.linha === linha); if (!g) return; document.getElementById('edit-g-linha').value = g.linha; document.getElementById('edit-g-data').value = g.dataIso; document.getElementById('edit-g-socio').value = g.socio; document.getElementById('edit-g-local').value = g.local; document.getElementById('edit-g-item').value = g.item; document.getElementById('edit-g-qtd').value = g.qtd; document.getElementById('edit-g-valor').value = safeFmt(g.valor); document.getElementById('edit-g-total').value = safeFmt(g.total); document.getElementById('modal-editar-gasto').style.display = 'flex'; }
function salvarEdicaoGasto() { const linha = document.getElementById('edit-g-linha').value; const gOrig = gastosGlobal.find(x => x.linha == linha); const vTotal = parseDinheiro(document.getElementById('edit-g-total').value); const py = { usuario: usuarioLogado, acao: "atualizar_gasto", linha: linha, data: document.getElementById('edit-g-data').value, local: padronizarTexto(document.getElementById('edit-g-local').value), socio: padronizarTexto(document.getElementById('edit-g-socio').value), item: padronizarTexto(document.getElementById('edit-g-item').value), qtd: document.getElementById('edit-g-qtd').value, valor: parseDinheiro(document.getElementById('edit-g-valor').value), total: vTotal, log_detalhe: `✏️ Editou despesa [${gOrig ? gOrig.item : 'Item'}]: ${gOrig ? safeFmt(gOrig.total) : ''} -> ${fmtPlanilha(vTotal)}` }; document.getElementById('modal-editar-gasto').style.display = 'none'; mostrarLoading("Salvando..."); py.valor = fmtPlanilha(py.valor); py.total = fmtPlanilha(py.total); fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify(py) }).then(() => { mostrarAlerta("Atualizado!", "Edição salva.", "success"); sincronizarDadosUnico(); }); }

function renderizarEncomendas() { const fila = document.getElementById('lista-encomendas-cards'); const tBusca = document.getElementById('busca-encomendas').value.toLowerCase().trim(); let pendentes = encomendasGlobal.filter(e => e.status !== 'Entregue'); if (tBusca) { pendentes = pendentes.filter(e => (e.cliente + " " + e.item).toLowerCase().includes(tBusca)); } pendentes.sort((a, b) => new Date(b.dataPedido) - new Date(a.dataPedido)); if (encomendasGlobal.length === 0) { fila.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Nenhuma encomenda ativa.</p>"; return; } if (pendentes.length === 0) { fila.innerHTML = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Tudo Entregue ou Não Encontrado!</p>"; return; } let html = ""; pendentes.forEach(e => { let classBadge = e.status === 'Pendente' ? 'b-atrasado' : 'b-ok'; let btnVender = e.status === 'Produzido' ? `<button class="btn-salvar" style="margin-top:5px; padding:10px; background:#2C2A2B; font-size:0.8rem; width:100%;" onclick="puxarVendaDeEncomenda(${e.linha})">🚀 Vender (PDV)</button>` : ''; let toggleStatus = e.status === 'Pendente' ? `<button class="btn-acao" style="background:#e8f5e9; color:#2e7d32; border-color:#c8e6c9;" onclick="mudarStatusEncomenda(${e.linha}, 'Produzido')" title="Marcar Produzido">✔️</button>` : `<button class="btn-acao" style="background:#fee2e2; color:#991b1b; border-color:#fecaca;" onclick="mudarStatusEncomenda(${e.linha}, 'Pendente')" title="Desfazer">↩️</button>`; html += `<div class="rotulo-card" style="flex-direction:column; align-items:stretch;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div class="rotulo-info"><h4>${e.cliente} <span class="badge-status ${classBadge}" style="margin-left:5px;">${e.status}</span></h4><p style="color:var(--primary); font-weight:800; font-size:0.7rem;">Pedido: ${e.dataDisplay}</p><p><b>${e.qtd}x</b> ${e.item}</p><p style="font-size:0.7rem; color:#888; font-style:italic;">Obs: ${e.obs}</p></div><div style="display:flex; gap:5px;">${toggleStatus}<button class="btn-acao" onclick="prepararExclusaoRegistro('Encomendas', ${e.linha}, 'Pedido de ${e.cliente}')">🗑️</button></div></div>${btnVender}</div>`; }); fila.innerHTML = html; }
function salvarEncomenda() { const data = document.getElementById('e-data').value, cli = padronizarTexto(document.getElementById('e-cliente').value), item = padronizarTexto(document.getElementById('e-item').value), qtd = document.getElementById('e-qtd').value, obs = document.getElementById('e-obs').value; if (!data || !cli || !item) return mostrarAlerta("Atenção", "Preencha Data, Cliente e Item.", "warning"); mostrarLoading("Salvando..."); const msgLog = `📦 Nova encomenda de ${cli}: ${qtd}x [${item}]`; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "salvar_encomenda", data: data, cliente: cli, item: item, qtd: qtd, status: 'Pendente', obs: obs, log_detalhe: msgLog }) }).then(() => { mostrarAlerta("Registrado", "Encomenda salva.", "success"); document.getElementById('e-item').value = ""; document.getElementById('e-obs').value = ""; sincronizarDadosUnico(); }); }
function mudarStatusEncomenda(linha, novoStatus) { let e = encomendasGlobal.find(x => x.linha == linha); if (!e) return; mostrarLoading("Atualizando..."); const msgLog = `🔄 Pedido de ${e.cliente} marcado como ${novoStatus}`; fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "atualizar_encomenda_status", linha: linha, status: novoStatus, log_detalhe: msgLog }) }).then(() => sincronizarDadosUnico()); }
function puxarVendaDeEncomenda(linha) { const e = encomendasGlobal.find(x => x.linha == linha); if (!e) return; toggleVendasTab('registro'); document.getElementById('v-cliente').value = e.cliente; document.getElementById('v-qtd').value = e.qtd; document.getElementById('v-observacao').value = "REF ENCOMENDA: " + e.item; const dropdownProd = document.getElementById('v-produto'); let options = Array.from(dropdownProd.options); let achou = options.find(opt => opt.value.toLowerCase() === e.item.toLowerCase()); if (achou) { dropdownProd.value = achou.value; autoPreencherValorVenda(); } mostrarAlerta("Preenchido!", "Preenchemos o PDV para você.", "success"); }

function onStatusVendaChange(isEdit = false) {
    const prefix = isEdit ? 'edit-v-' : 'v-';
    const status = document.getElementById(prefix + 'status').value;
    if (status === 'Presente') {
        document.getElementById(prefix + 'valor').value = "R$ 0,00";
    } else {
        if(isEdit) autoPreencherEdicaoVenda();
        else autoPreencherValorVenda();
    }
}

function autoPreencherValorVenda() { const selecao = document.getElementById('v-produto').value; const nomePadronizado = padronizarTexto(selecao); const prodAgrupado = estoqueAgrupado[nomePadronizado]; const imgPrev = document.getElementById('v-produto-img-preview'); const comboLocal = document.getElementById('v-local-estoque'); if (comboLocal) comboLocal.innerHTML = ''; if (prodAgrupado && prodAgrupado.totalQtd > 0) { const qtd = parseInt(document.getElementById('v-qtd').value) || 1; const valorUnitario = parseDinheiro(prodAgrupado.preco); document.getElementById('v-valor').value = fmt(valorUnitario * qtd); let fotos = prodAgrupado.foto ? prodAgrupado.foto.split(',') : []; imgPrev.src = fotos[0] || 'logo.png'; imgPrev.style.display = 'block'; if (comboLocal) { let count = 0; for (let loc in prodAgrupado.locais) { if (prodAgrupado.locais[loc] > 0) { comboLocal.innerHTML += `<option value="${loc}">${loc} (Disp: ${prodAgrupado.locais[loc]})</option>`; count++; } } if (count === 0) comboLocal.innerHTML = `<option value="">Sem estoque</option>`; } } else { document.getElementById('v-valor').value = ""; imgPrev.style.display = 'none'; if (comboLocal) comboLocal.innerHTML = `<option value="">Selecione o Produto Primeiro...</option>`; } }

function autoPreencherEdicaoVenda() { 
    const selecao = document.getElementById('edit-v-produto').value;
    const nomePadronizado = padronizarTexto(selecao);
    const prodAgrupado = estoqueAgrupado[nomePadronizado];
    const comboLocal = document.getElementById('edit-v-local');

    if(prodAgrupado) { 
        const qtd = parseInt(document.getElementById('edit-v-qtd').value) || 1, valorUnitario = parseDinheiro(prodAgrupado.preco); 
        
        if(document.getElementById('edit-v-status').value !== 'Presente') {
            document.getElementById('edit-v-valor').value = fmt(valorUnitario * qtd); 
        }

        if(comboLocal) {
            comboLocal.innerHTML = '';
            let count = 0;
            for(let loc in prodAgrupado.locais) {
                if(prodAgrupado.locais[loc] > 0) {
                    comboLocal.innerHTML += `<option value="${loc}">${loc} (Disp: ${prodAgrupado.locais[loc]})</option>`;
                    count++;
                }
            }
            if (count === 0) comboLocal.innerHTML = `<option value="">Sem estoque</option>`;
        }
    } 
}

// ==========================================
// MÓDULO: CARRINHO DE COMPRAS E PDV
// ==========================================
let carrinhoPDV = [];

function adicionarItemCarrinho() {
    const produto = document.getElementById('v-produto').value;
    const elLocal = document.getElementById('v-local-estoque');
    const localRetirada = elLocal ? elLocal.value : "";
    const qtd = parseInt(document.getElementById('v-qtd').value) || 1;
    const valorStr = document.getElementById('v-valor').value;
    const valTotalItem = parseDinheiro(valorStr);

    if (!produto || valTotalItem < 0 || !localRetirada) {
        return mostrarAlerta("Atenção", "Preencha o Produto, Local e Valor antes de inserir.", "warning");
    }

    const prodAgrupado = estoqueAgrupado[padronizarTexto(produto)];
    const cUnd = prodAgrupado ? parseDinheiro(prodAgrupado.custo) : 0;
    const cTot = cUnd * qtd;

    // Coloca o item na memória do celular
    carrinhoPDV.push({
        produto: produto,
        local_estoque: localRetirada,
        qtd: qtd,
        valor_total_item: valTotalItem,
        custo_und: cUnd,
        custo_total: cTot
    });

    // Limpa apenas a parte do produto para o vendedor bipar o próximo
    document.getElementById('v-produto').value = '';
    document.getElementById('v-qtd').value = '1';
    document.getElementById('v-valor').value = '';
    if (elLocal) elLocal.innerHTML = '<option value="">Selecione o Produto Primeiro...</option>';
    document.getElementById('v-produto-img-preview').style.display = 'none';

    renderizarCarrinho();
}

function removerItemCarrinho(index) {
    carrinhoPDV.splice(index, 1);
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const container = document.getElementById('carrinho-lista');
    const elTotal = document.getElementById('carrinho-total');
    
    if (carrinhoPDV.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; font-size: 0.8rem; margin: 10px 0;">Carrinho vazio. Adicione produtos acima.</p>';
        elTotal.innerText = "R$ 0,00";
        return;
    }

    let html = '';
    let somaPedido = 0;
    
    carrinhoPDV.forEach((item, index) => {
        somaPedido += item.valor_total_item;
        const nomeFormatado = formatarNomeProdutoHtml(item.produto, 'venda');
        
        html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #E8DDE1;">
            <div style="flex: 1; line-height: 1.3; min-width: 0;">
                <span style="font-weight: 700; color: var(--brand-dark); font-size: 0.85rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.qtd}x ${nomeFormatado}</span>
                <span style="font-size: 0.7rem; color: #888;">📍 Retirada: ${item.local_estoque}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-left: 10px;">
                <span style="font-weight: 800; color: var(--primary-dark); font-size: 0.95rem;">${fmt(item.valor_total_item)}</span>
                <button class="btn-acao" style="width: 28px; height: 28px; font-size: 0.7rem; background: #fee2e2; border-color: #fecaca; color: #991b1b;" onclick="removerItemCarrinho(${index})">❌</button>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
    elTotal.innerText = fmt(somaPedido);
}

function salvarVendaCarrinho() {
    if (carrinhoPDV.length === 0) return mostrarAlerta("Atenção", "O carrinho está vazio! Insira produtos primeiro.", "warning");

    const data = document.getElementById('v-data').value;
    const cliente = padronizarTexto(document.getElementById('v-cliente').value);
    const socio = (usuarioCargo === 'Admin') ? padronizarTexto(document.getElementById('v-socio').value) : padronizarTexto(usuarioLogado);
    const status = document.getElementById('v-status').value;
    const observacao = document.getElementById('v-observacao').value;

    if (!data || !cliente) return mostrarAlerta("Atenção", "Preencha a Data e o Cliente no topo.", "warning");

    mostrarLoading("Registrando Pedido...");
    const msgLog = `🛒 Pedido Fechado: ${cliente} (${carrinhoPDV.length} itens). Status: ${status}`;

    const envio = {
        usuario: usuarioLogado,
        acao: "salvar_venda_carrinho",
        data: data,
        cliente: cliente,
        socio: socio,
        status: status,
        observacao: observacao,
        carrinho: carrinhoPDV,
        log_detalhe: msgLog
    };

    fetch(API_NOVERA, {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify(envio)
    })
    .then(r => r.json())
    .then(resultado => {
        if (resultado.sucesso) {
            mostrarAlerta("Sucesso", "Pedido finalizado!", "success");
            document.getElementById('v-cliente').value = "";
            document.getElementById('v-observacao').value = "";
            carrinhoPDV = []; // Limpa o carrinho
            renderizarCarrinho();
            sincronizarDadosUnico();
        } else {
            mostrarAlerta("Erro", resultado.erro || "Falha ao salvar no banco.", "error");
        }
    })
    .catch(e => mostrarAlerta("Erro", "Falha na conexão.", "error"))
    .finally(() => ocultarLoading());
}

function renderizarVendas() { 
    const dlist = [...new Set(vendasGlobal.map(v => String(v.cliente).trim()))].sort((a, b) => a.localeCompare(b)); 
    document.getElementById('lista-clientes').innerHTML = dlist.map(c => `<option value="${c}">`).join(''); 
    
    const dlistPagos = [...new Set(vendasGlobal.filter(v => v.status === 'Pago').map(v => String(v.cliente).trim()))].sort((a, b) => a.localeCompare(b)); 
    document.getElementById('recibo-cliente').innerHTML = '<option value="">Nenhum cliente...</option>' + dlistPagos.map(c => `<option value="${c}">${c}</option>`).join(''); 
    
    // AGORA PUXA PENDENTE E PARCELADO
    const dlistPendentes = [...new Set(vendasGlobal.filter(v => v.status === 'Pendente' || v.status === 'Parcelado').map(v => String(v.cliente).trim()))].sort((a, b) => a.localeCompare(b)); 
    
    // ADICIONA A OPÇÃO DE LISTAR TODOS NO TOPO
    document.getElementById('cobranca-cliente').innerHTML = '<option value="">Nenhum devedor...</option><option value="todos">🌟 TODOS OS DEVEDORES</option>' + dlistPendentes.map(c => `<option value="${c}">${c}</option>`).join(''); 
    
    let htmlVendas = '<option value="">Selecione do Estoque...</option>'; 
    Object.values(estoqueAgrupado).sort((a, b) => String(b.codigo || "").localeCompare(String(a.codigo || ""))).forEach(e => { if (e.totalQtd > 0) { let exibeCodigo = e.codigo ? e.codigo + ' - ' : ''; htmlVendas += `<option value="${e.nome}">${exibeCodigo}${e.nome} (Total: ${e.totalQtd})</option>`; } }); 
    const fvClienteSelect = document.getElementById('f-v-cliente'); 
    const fvClienteAtual = fvClienteSelect.value; 
    fvClienteSelect.innerHTML = '<option value="">Todos</option>' + dlist.map(c => `<option value="${c}">${c}</option>`).join(''); 
    fvClienteSelect.value = fvClienteAtual; 
    document.getElementById("v-produto").innerHTML = htmlVendas; 
    document.getElementById("edit-v-produto").innerHTML = htmlVendas; 
    filtrarVendas(); 
}

function filtrarVendas() {
    const isAdmin = (usuarioCargo === 'Admin');
    const fTipoData = document.getElementById('f-v-tipo-data') ? document.getElementById('f-v-tipo-data').value : 'venda'; 
    const fDia = document.getElementById('f-v-dia').value, fMes = document.getElementById('f-v-mes').value, fStatus = document.getElementById('f-v-status').value, fSocio = document.getElementById('f-v-socio').value.toLowerCase(), fCliente = document.getElementById('f-v-cliente').value.toLowerCase();
    
    let filtradas = vendasGlobal.filter(v => { 
        let pD = true, pM = true, pS = true, pSo = true, pC = true; 
        let dataAlvoIso = ""; 
        if (fTipoData === 'venda') { dataAlvoIso = v.dataVendaIso; } else { if (v.dataPgtoDisplay) { const parts = v.dataPgtoDisplay.split('/'); if (parts.length === 3) dataAlvoIso = `${parts[2]}-${parts[1]}-${parts[0]}`; } } 
        if (fDia) { if (dataAlvoIso !== fDia) pD = false; } 
        if (fMes) { const mesAlvo = dataAlvoIso ? dataAlvoIso.split('-')[1] : null; if (mesAlvo && mesAlvo !== fMes) pM = false; } 
        if (fStatus && v.status !== fStatus) pS = false; 
        if (fSocio && String(v.socio || '').toLowerCase() !== fSocio) pSo = false; 
        if (fCliente && !String(v.cliente || '').toLowerCase().includes(fCliente)) pC = false; 
        return pD && pM && pS && pSo && pC; 
    });
    
    filtradas.sort((a, b) => new Date(b.dataVendaIso) - new Date(a.dataVendaIso)); 
    let tVend = 0, tRec = 0, tDev = 0, tLuc = 0, tItens = 0, html = "";
    
    if (filtradas.length === 0) { html = "<p style='text-align:center; color:#999; font-size:0.8rem;'>Vazio.</p>"; } else {
        filtradas.forEach(v => {
            const val = parseDinheiro(v.valor_venda); tVend += val; tLuc += parseDinheiro(v.lucro); tItens += parseInt(v.qtd) || 0; 
            
            const isP = v.status === 'Pago'; 
            const isPresente = v.status === 'Presente';
            
            if(isP) tRec += val; else if(!isPresente) tDev += val; 
            
            const btnAcaoExtra = isP ? `<button class="btn-acao" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;" onclick="gerarReciboUnico(${v.linha})" title="Gerar Recibo Rápido">🧾</button>` : `<button class="btn-acao" style="background:#ffedd5; color:#b45309; border-color:#fde047;" onclick="gerarCobrancaUnica(${v.linha})" title="Gerar Cobrança Rápida">🔔</button>`; 
            const textoObservacao = v.observacao ? `<p style="font-size:0.7rem; color:#888; font-style:italic; margin-top:3px; line-height: 1.3;">Obs: ${v.observacao}</p>` : ""; 
            const nomeHtml = formatarNomeProdutoHtml(v.produto, 'venda'); 
            
            const txtStatus = isP ? `<p style="font-size:0.7rem; color:#2e7d32; font-weight:800; margin-top:3px;">✔️ Pago em: ${v.dataPgtoDisplay || 'Data não registrada'}</p>` : (isPresente ? `<p style="font-size:0.7rem; color:#7c3aed; font-weight:800; margin-top:3px;">🎁 Bonificação / Presente</p>` : '');
            
            const txtLucro = isAdmin ? (!isPresente ? `<p style="font-size:0.7rem; color:#b45309; font-weight:700; margin-top:3px;">Lucro: ${safeFmt(v.lucro)} (Markup: ${v.markup})</p>` : `<p style="font-size:0.7rem; color:#888; font-weight:700; margin-top:3px;">Custo Absorvido: ${safeFmt(v.custo_total)}</p>`) : '';
            
            const txtLocal = `<p style="font-size:0.7rem; color:#666; margin-top:2px;">📍 Local: <b>${v.local_estoque}</b></p>`;

            const btnApagar = isAdmin ? `<button class="btn-acao" onclick="prepararExclusaoRegistro('Vendas', ${v.linha}, 'Venda de ${v.cliente}')" title="Excluir">🗑️</button>` : '';
            
            // INCLUI A ETIQUETA ROXA DO PARCELADO (Se for parcelado, não mostra o botão verde de Pago ali no grid pra não confundir)
            let badgeClass = isP ? 'status-pago' : (isPresente ? 'status-presente' : (v.status === 'Parcelado' ? 'status-parcelado' : 'status-pendente'));

            html += `<div class="rotulo-card"><div class="rotulo-info"><h4>${v.cliente} <span class="status-badge ${badgeClass}">${v.status}</span></h4><p style="color:var(--primary); font-weight:800; font-size:0.7rem;">${v.dataVendaDisplay || v.dataVendaIso}</p><p><b>${v.qtd}x</b> ${nomeHtml} • Sócio: ${v.socio}</p>${txtLocal}${txtStatus}${txtLucro}${textoObservacao}</div><div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;"><div class="custo-val">${safeFmt(v.valor_venda)}</div><div style="display:flex; gap:5px;">${btnAcaoExtra}${(!isP && !isPresente) ? `<button class="btn-acao" style="background:#e8f5e9; color:#2e7d32; border-color:#bbf7d0;" onclick="darBaixaVenda(${v.linha})" title="Marcar Pago">💲</button>` : ''}<button class="btn-acao" onclick="abrirModalEditarVenda(${v.linha})" title="Editar">✏️</button>${btnApagar}</div></div></div>`; 
        });
    }
    document.getElementById('lista-vendas-cadastradas').innerHTML = html; document.getElementById('dash-v-total').innerText = fmt(tVend); document.getElementById('dash-v-receita').innerText = fmt(tRec); document.getElementById('dash-v-receber').innerText = fmt(tDev);
    if (document.getElementById('dash-v-lucro')) document.getElementById('dash-v-lucro').innerText = isAdmin ? fmt(tLuc) : "---";
    document.getElementById('dash-v-itens').innerText = tItens;
}

async function montarRecibo() {
    const clienteReal = document.getElementById('recibo-cliente').value, clienteNomeExibicao = document.getElementById('recibo-nome-exibicao').value.trim() || clienteReal, checkboxes = document.querySelectorAll('.chk-item-recibo:checked');
    if (checkboxes.length === 0) return mostrarAlerta("Aviso", "Deixe pelo menos um pedido marcado para o recibo.", "warning");
    mostrarLoading("Gerando Recibo..."); document.getElementById('rec-cli-nome').innerText = clienteNomeExibicao; document.getElementById('rec-data-emissao').innerText = new Date().toLocaleDateString('pt-BR'); let htmlItens = "", somaTotal = 0;
    checkboxes.forEach(chk => { const pedido = vendasGlobal.find(v => v.linha == chk.value); if (pedido) { const valor = parseDinheiro(pedido.valor_venda); somaTotal += valor; const dataCompra = pedido.dataVendaDisplay || pedido.dataVendaIso, txtPago = pedido.status === 'Pago' ? `Pago: ${pedido.dataPgtoDisplay || '?'}` : 'Pendente'; const nomeHtml = formatarNomeProdutoHtml(pedido.produto, 'recibo'); htmlItens += `<div style="display:flex; justify-content: space-between; border-bottom: 1px solid #f3d8e2; padding: 8px 0;"><div style="flex: 1;"><strong style="color: #2C2A2B; line-height:1.4;">${pedido.qtd}x ${nomeHtml}</strong><br><span style="font-size: 0.7rem; color: #888;">Data: ${dataCompra} | ${txtPago}</span></div><div style="font-weight: 700; color: #966178;">${fmt(valor)}</div></div>`; } });
    document.getElementById('rec-itens-lista').innerHTML = htmlItens; document.getElementById('rec-total').innerText = fmt(somaTotal);
    try {
        const template = document.getElementById('recibo-template'); template.style.display = 'block'; template.style.position = 'fixed'; template.style.top = '0'; template.style.left = '0'; template.style.zIndex = '-9999';
        await new Promise(r => setTimeout(r, 200));
        const canvas = await html2canvas(template, { scale: 2, backgroundColor: "#ffffff", useCORS: true }); const base64image = canvas.toDataURL("image/png"); template.style.display = 'none';
        document.getElementById('recibo-img-container').innerHTML = `<img src="${base64image}" style="width: 100%; height: auto; display: block; border-radius:8px; border:1px solid #E8DDE1;">`; document.getElementById('preview-title').innerText = "Recibo Pronto!"; document.getElementById('btn-baixar-img').onclick = () => { const link = document.createElement('a'); link.download = `Recibo_Novera_${clienteNomeExibicao.replace(/\s+/g, '_')}.png`; link.href = base64image; link.click(); }; document.getElementById('modal-recibo-preview').style.display = 'flex';
    } catch (error) { mostrarAlerta("Erro", "Falha ao gerar a imagem.", "error"); } finally { ocultarLoading(); }
}

async function gerarReciboUnico(linha) {
    const pedido = vendasGlobal.find(v => v.linha == linha); if (!pedido) return; let nomeExibicao = await pedirNomeDocumento(pedido.cliente, "Nome no Recibo"); if (nomeExibicao === null) return;
    mostrarLoading("Gerando Recibo..."); document.getElementById('rec-cli-nome').innerText = nomeExibicao; document.getElementById('rec-data-emissao').innerText = new Date().toLocaleDateString('pt-BR');
    const valor = parseDinheiro(pedido.valor_venda); const dataCompra = pedido.dataVendaDisplay || pedido.dataVendaIso; const txtPago = `Pago em: ${pedido.dataPgtoDisplay || '?'}`; const nomeHtml = formatarNomeProdutoHtml(pedido.produto, 'recibo'); const htmlItem = `<div style="display:flex; justify-content: space-between; border-bottom: 1px solid #f3d8e2; padding: 8px 0;"><div style="flex: 1;"><strong style="color: #2C2A2B; line-height:1.4;">${pedido.qtd}x ${nomeHtml}</strong><br><span style="font-size: 0.7rem; color: #888;">Data: ${dataCompra} | ${txtPago}</span></div><div style="font-weight: 700; color: #966178;">${fmt(valor)}</div></div>`; document.getElementById('rec-itens-lista').innerHTML = htmlItem; document.getElementById('rec-total').innerText = fmt(valor);
    try {
        const template = document.getElementById('recibo-template'); template.style.display = 'block'; template.style.position = 'fixed'; template.style.top = '0'; template.style.left = '0'; template.style.zIndex = '-9999';
        await new Promise(r => setTimeout(r, 200));
        const canvas = await html2canvas(template, { scale: 2, backgroundColor: "#ffffff", useCORS: true }); const base64image = canvas.toDataURL("image/png"); template.style.display = 'none';
        document.getElementById('recibo-img-container').innerHTML = `<img src="${base64image}" style="width: 100%; height: auto; display: block; border-radius:8px; border:1px solid #E8DDE1;">`; document.getElementById('preview-title').innerText = "Recibo Pronto!"; document.getElementById('btn-baixar-img').onclick = () => { const link = document.createElement('a'); link.download = `Recibo_Novera_${nomeExibicao.replace(/\s+/g, '_')}.png`; link.href = base64image; link.click(); }; document.getElementById('modal-recibo-preview').style.display = 'flex';
    } catch (error) { mostrarAlerta("Erro", "Falha ao gerar a imagem.", "error"); } finally { ocultarLoading(); }
}

function prepararRecibo() { const cliente = document.getElementById('recibo-cliente').value, divNome = document.getElementById('div-recibo-nome'), inputNome = document.getElementById('recibo-nome-exibicao'), container = document.getElementById('recibo-pedidos-lista'), btn = document.getElementById('btn-gerar-recibo'); if (!cliente) { divNome.style.display = 'none'; container.style.display = 'none'; btn.style.display = 'none'; return; } inputNome.value = cliente; divNome.style.display = 'block'; let pedidos = vendasGlobal.filter(v => v.cliente.trim() === cliente && v.status === 'Pago'); pedidos.sort((a, b) => new Date(b.dataVendaIso) - new Date(a.dataVendaIso)); if (pedidos.length === 0) { container.innerHTML = '<p style="font-size:0.8rem; color:#888;">Nenhum pedido PAGO encontrado.</p>'; } else { let html = ''; pedidos.forEach(p => { const dataCompra = p.dataVendaDisplay || p.dataVendaIso, statusTexto = `<span style="color:#2e7d32;">Pago: ${p.dataPgtoDisplay || '?'}</span>`; const nomeHtml = formatarNomeProdutoHtml(p.produto, 'recibo'); html += `<label class="checkbox-recibo"><input type="checkbox" class="chk-item-recibo" value="${p.linha}" checked><div class="chk-info"><span class="chk-title">${p.qtd}x ${nomeHtml}</span><span class="chk-desc">Data: ${dataCompra} | ${statusTexto}</span></div><div class="chk-val">${safeFmt(p.valor_venda)}</div></label>`; }); container.innerHTML = html; } container.style.display = 'block'; btn.style.display = 'block'; }

function prepararCobranca() { 
    const cliente = document.getElementById('cobranca-cliente').value; 
    const divNome = document.getElementById('div-cobranca-nome'); 
    const inputNome = document.getElementById('cobranca-nome-exibicao'); 
    const container = document.getElementById('cobranca-pedidos-lista'); 
    const divBotoes = document.getElementById('div-cobranca-botoes'); 
    
    if (!cliente) { 
        divNome.style.display = 'none'; container.style.display = 'none'; if (divBotoes) divBotoes.style.display = 'none'; return; 
    } 
    
    let pends = [];
    if (cliente === 'todos') {
        divNome.style.display = 'none';
        pends = vendasGlobal.filter(v => v.status === 'Pendente' || v.status === 'Parcelado');
    } else {
        inputNome.value = cliente; 
        divNome.style.display = 'block'; 
        pends = vendasGlobal.filter(v => v.cliente.trim() === cliente && (v.status === 'Pendente' || v.status === 'Parcelado')); 
    }
    
    pends.sort((a, b) => new Date(b.dataVendaIso) - new Date(a.dataVendaIso)); 
    
    if (pends.length === 0) { 
        container.innerHTML = '<p style="font-size:0.8rem; color:#888;">Nenhuma pendência encontrada.</p>'; 
    } else { 
        let html = ''; 
        
        // A REGRA DE SEGURANÇA: Se for a lista geral, começa desmarcado. Se for cliente único, já vem marcado.
        const statusCheckbox = cliente === 'todos' ? '' : 'checked';

        pends.forEach(p => { 
            const dataCompra = p.dataVendaDisplay || p.dataVendaIso; 
            const nomeHtml = formatarNomeProdutoHtml(p.produto, 'cobranca'); 
            
            // SE FOR LISTA GERAL, MOSTRA O NOME DA PESSOA EM CIMA DO PEDIDO
            const exibirNome = cliente === 'todos' ? `<div style="font-size:0.75rem; color:#A05252; font-weight:800; margin-bottom:3px;">👤 ${p.cliente}</div>` : '';
            const badge = p.status === 'Parcelado' ? `<span style="background:#e0e7ff; color:#4f46e5; padding:2px 6px; border-radius:4px; font-size:0.6rem; margin-left:5px; text-transform:uppercase; font-weight:800;">Parcelado</span>` : '';
            
            html += `<label class="checkbox-recibo" style="border-color:#ffeeba; background:#fff9e6; align-items:flex-start;"><input type="checkbox" class="chk-item-cobranca" value="${p.linha}" ${statusCheckbox} style="margin-top:2px;"><div class="chk-info">${exibirNome}<span class="chk-title" style="color:#b45309;">${p.qtd}x ${nomeHtml} ${badge}</span><span class="chk-desc">Data: ${dataCompra}</span></div><div class="chk-val" style="color:#b45309; display:flex; align-items:center;">${safeFmt(p.valor_venda)}</div></label>`; 
        }); 
        container.innerHTML = html; 
    } 
    container.style.display = 'block'; 
    if (divBotoes) {
        divBotoes.style.display = 'flex'; 
        // ESCONDE O BOTÃO DE GERAR IMAGEM E TEXTO SE FOR A LISTA DE TODOS (Evita enviar pra pessoa errada)
        const botoes = divBotoes.querySelectorAll('.col');
        if (botoes.length >= 3) {
            botoes[0].style.display = cliente === 'todos' ? 'none' : 'block';
            botoes[1].style.display = cliente === 'todos' ? 'none' : 'block';
        }
    }
}
function copiarPendenciasWhats() { const cliReal = document.getElementById('cobranca-cliente').value; if (!cliReal) return mostrarAlerta("Aviso", "Selecione um cliente para cobrar.", "warning"); const cliDisplay = document.getElementById('cobranca-nome-exibicao').value.trim() || cliReal; const checkboxes = document.querySelectorAll('.chk-item-cobranca:checked'); if (checkboxes.length === 0) return mostrarAlerta("Aviso", "Selecione pelo menos um pedido.", "warning"); let txt = `Olá ${cliDisplay}, tudo bem com você? Passando aqui pela Novera Scent ✨\n\nEsse é um resuminho dos seus pedidos em aberto com a gente:\n\n`; let tot = 0; checkboxes.forEach(chk => { const p = vendasGlobal.find(v => v.linha == chk.value); if (p) { const val = parseDinheiro(p.valor_venda); const nomeTxt = formatarNomeProdutoTexto(p.produto); txt += `📅 ${p.dataVendaDisplay} | 📦 ${p.qtd}x ${nomeTxt} | 💰 ${fmt(val)}\n`; tot += val; } }); txt += `\n*Total em aberto: ${fmt(tot)}*\n\nQualquer dúvida, é só chamar!`; navigator.clipboard.writeText(txt).then(() => mostrarAlerta("Copiado!", "Texto copiado.", "success")); }

async function montarCobranca() {
    const cliReal = document.getElementById('cobranca-cliente').value; if (!cliReal) return mostrarAlerta("Aviso", "Selecione um cliente devedor.", "warning"); const cliDisplay = document.getElementById('cobranca-nome-exibicao').value.trim() || cliReal; const checkboxes = document.querySelectorAll('.chk-item-cobranca:checked'); if (checkboxes.length === 0) return mostrarAlerta("Aviso", "Selecione pelo menos um pedido.", "warning");
    mostrarLoading("Gerando Imagem..."); document.getElementById('cob-cli-nome').innerText = cliDisplay; let htmlItens = "", somaTotal = 0; checkboxes.forEach(chk => { const pedido = vendasGlobal.find(v => v.linha == chk.value); if (pedido) { const valor = parseDinheiro(pedido.valor_venda); somaTotal += valor; const nomeHtml = formatarNomeProdutoHtml(pedido.produto, 'cobranca'); htmlItens += `<div style="display:flex; justify-content: space-between; border-bottom: 1px solid #ffeeba; padding: 8px 0;"><div style="flex: 1;"><strong style="color: #2C2A2B; line-height:1.4;">${pedido.qtd}x ${nomeHtml}</strong><br><span style="font-size: 0.7rem; color: #888;">Data: ${pedido.dataVendaDisplay || pedido.dataVendaIso}</span></div><div style="font-weight: 700; color: #b45309;">${fmt(valor)}</div></div>`; } });
    document.getElementById('cob-itens-lista').innerHTML = htmlItens; document.getElementById('cob-total').innerText = fmt(somaTotal);
    try {
        const template = document.getElementById('cobranca-template'); template.style.display = 'block'; template.style.position = 'fixed'; template.style.top = '0'; template.style.left = '0'; template.style.zIndex = '-9999';
        await new Promise(r => setTimeout(r, 200));
        const canvas = await html2canvas(template, { scale: 2, backgroundColor: "#ffffff", useCORS: true }); const base64image = canvas.toDataURL("image/png"); template.style.display = 'none';
        document.getElementById('recibo-img-container').innerHTML = `<img src="${base64image}" style="width: 100%; height: auto; display: block; border-radius:8px; border:1px solid #E8DDE1;">`; document.getElementById('preview-title').innerText = "Imagem de Cobrança Pronta!"; document.getElementById('btn-baixar-img').onclick = () => { const link = document.createElement('a'); link.download = `Cobranca_Novera_${cliDisplay.replace(/\s+/g, '_')}.png`; link.href = base64image; link.click(); }; document.getElementById('modal-recibo-preview').style.display = 'flex';
    } catch (error) { mostrarAlerta("Erro", "Falha ao gerar a imagem.", "error"); } finally { ocultarLoading(); }
}

async function gerarCobrancaUnica(linha) {
    const pedido = vendasGlobal.find(v => v.linha == linha); if (!pedido) return; let nomeExibicao = await pedirNomeDocumento(pedido.cliente, "Nome na Cobrança"); if (nomeExibicao === null) return;
    mostrarLoading("Gerando Imagem..."); document.getElementById('cob-cli-nome').innerText = nomeExibicao; const valor = parseDinheiro(pedido.valor_venda); const nomeHtml = formatarNomeProdutoHtml(pedido.produto, 'cobranca'); const htmlItem = `<div style="display:flex; justify-content: space-between; border-bottom: 1px solid #ffeeba; padding: 8px 0;"><div style="flex: 1;"><strong style="color: #2C2A2B; line-height:1.4;">${pedido.qtd}x ${nomeHtml}</strong><br><span style="font-size: 0.7rem; color: #888;">Data: ${pedido.dataVendaDisplay || pedido.dataVendaIso}</span></div><div style="font-weight: 700; color: #b45309;">${fmt(valor)}</div></div>`;
    document.getElementById('cob-itens-lista').innerHTML = htmlItem; document.getElementById('cob-total').innerText = fmt(valor);
    try {
        const template = document.getElementById('cobranca-template'); template.style.display = 'block'; template.style.position = 'fixed'; template.style.top = '0'; template.style.left = '0'; template.style.zIndex = '-9999';
        await new Promise(r => setTimeout(r, 200));
        const canvas = await html2canvas(template, { scale: 2, backgroundColor: "#ffffff", useCORS: true }); const base64image = canvas.toDataURL("image/png"); template.style.display = 'none';
        document.getElementById('recibo-img-container').innerHTML = `<img src="${base64image}" style="width: 100%; height: auto; display: block; border-radius:8px; border:1px solid #E8DDE1;">`; document.getElementById('preview-title').innerText = "Imagem Pronta!"; document.getElementById('btn-baixar-img').onclick = () => { const link = document.createElement('a'); link.download = `Cobranca_Novera_${nomeExibicao.replace(/\s+/g, '_')}.png`; link.href = base64image; link.click(); }; document.getElementById('modal-recibo-preview').style.display = 'flex';
    } catch (error) { mostrarAlerta("Erro", "Falha ao gerar.", "error"); } finally { ocultarLoading(); }
}

function darBaixaVendaLote() {
    const checkboxes = document.querySelectorAll('.chk-item-cobranca:checked');
    if (checkboxes.length === 0) return mostrarAlerta("Aviso", "Selecione o pedido para dar baixa.", "warning");

    let linhas = [];
    let totalLote = 0;
    let clientesSet = new Set(); // Guarda os nomes dos clientes pra gente saber quantos são

    checkboxes.forEach(chk => {
        linhas.push(chk.value);
        const v = vendasGlobal.find(x => x.linha == chk.value);
        if (v) {
            totalLote += parseDinheiro(v.valor_venda);
            clientesSet.add(v.cliente);
        }
    });

    // Se for mais de 1 cliente, a mensagem avisa "vendas de 3 clientes diferentes"
    const cliNome = clientesSet.size > 1 ? `${clientesSet.size} clientes diferentes` : [...clientesSet][0];

    abrirConfirmacao("Confirmar Pagamento?", `Marcar ${linhas.length} venda(s) de ${cliNome} como RECEBIDA(S) hoje?`, "💰", "#2e7d32", "#1b5e20", "💲 Confirmar", () => {
        mostrarLoading("Salvando...");
        const msgLog = `💰 Recebeu pagamento em lote de ${cliNome} - Total: ${fmt(totalLote)}`;
        fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "atualizar_status_venda_lote", linhas: linhas, status: "Pago", log_detalhe: msgLog }) }).then(() => { mostrarAlerta("Recebido!", "Baixa em lote concluída.", "success"); sincronizarDadosUnico(); });
    });
}

function darBaixaVenda(linha) {
    const v = vendasGlobal.find(x => x.linha == linha);
    if (!v) return;

    abrirConfirmacao("Confirmar Pagamento?", `Marcar a venda de ${v.cliente} como RECEBIDA hoje?`, "💰", "#2e7d32", "#1b5e20", "💲 Receber", () => {
        mostrarLoading("Salvando...");
        const msgLog = `💲 Recebeu pagamento de ${v.cliente} no valor de ${safeFmt(v.valor_venda)}`;
        fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "atualizar_status_venda_lote", linhas: [linha], status: "Pago", log_detalhe: msgLog }) }).then(() => { mostrarAlerta("Recebido!", "Baixa ok.", "success"); sincronizarDadosUnico(); });
    });
}

function prepararExclusaoRegistro(aba, linha, desc) { 
    abrirConfirmacao("Confirmar Exclusão?", `Apagar "${desc}" de ${aba}?`, "🗑️", "#A05252", "#803f3f", "🗑️ Apagar", () => { 
        mostrarLoading("Apagando..."); 
        const msgLog = `🗑️ Apagou o registro: [${desc}] da aba ${aba}`; 
        fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify({ usuario: usuarioLogado, acao: "excluir_registro", aba: aba, linha: linha, log_detalhe: msgLog }) })
        .then(r => r.json())
        .then(res => { 
            if(res.sucesso) {
                mostrarAlerta("Excluído", "Registro apagado.", "success"); 
            } else {
                mostrarAlerta("Erro", res.erro || "Falha ao apagar.", "error");
            }
            sincronizarDadosUnico(); 
        }).catch(e => {
            mostrarAlerta("Erro", "Falha na conexão", "error");
            sincronizarDadosUnico();
        }); 
    }); 
}

function abrirModalEditarVenda(linha) { 
    const v = vendasGlobal.find(x => x.linha === linha); if (!v) return; 
    document.getElementById('edit-v-linha').value = v.linha; 
    document.getElementById('edit-v-data').value = v.dataVendaIso; 
    document.getElementById('edit-v-cliente').value = v.cliente; 
    document.getElementById('edit-v-produto').value = v.produto; 
    
    const prodAgrupado = estoqueAgrupado[padronizarTexto(v.produto)];
    const comboLocal = document.getElementById('edit-v-local');
    if (comboLocal) {
        comboLocal.innerHTML = '';
        if (prodAgrupado) {
            for (let loc in prodAgrupado.locais) {
                comboLocal.innerHTML += `<option value="${loc}">${loc} (Disp: ${prodAgrupado.locais[loc]})</option>`;
            }
        }
        if (!comboLocal.querySelector(`option[value="${v.local_estoque}"]`)) {
            comboLocal.innerHTML += `<option value="${v.local_estoque}">${v.local_estoque} (Antigo)</option>`;
        }
        comboLocal.value = v.local_estoque;
    }

    document.getElementById('edit-v-socio').value = v.socio; 
    document.getElementById('edit-v-qtd').value = v.qtd; 
    document.getElementById('edit-v-valor').value = safeFmt(v.valor_venda); 
    document.getElementById('edit-v-status').value = v.status; 
    document.getElementById('edit-v-observacao').value = v.observacao || ""; 
    document.getElementById('modal-editar-venda').style.display = 'flex'; 
}

function salvarEdicaoVenda() { 
    const l = document.getElementById('edit-v-linha').value; 
    const vOrig = vendasGlobal.find(x => x.linha == l); 
    const elLocal = document.getElementById('edit-v-local');
    
    const py = { 
        data: document.getElementById('edit-v-data').value, 
        cliente: padronizarTexto(document.getElementById('edit-v-cliente').value), 
        produto: padronizarTexto(document.getElementById('edit-v-produto').value), 
        socio: padronizarTexto(document.getElementById('edit-v-socio').value), 
        qtd: parseInt(document.getElementById('edit-v-qtd').value) || 1, 
        valorStr: document.getElementById('edit-v-valor').value, 
        status: document.getElementById('edit-v-status').value, 
        observacao: document.getElementById('edit-v-observacao').value,
        local_estoque: elLocal ? elLocal.value : 'Sede'
    }; 
    
    document.getElementById('modal-editar-venda').style.display = 'none'; 
    mostrarLoading("Salvando..."); 
    
    const msgLog = `✏️ Editou saída de ${py.cliente} [${py.produto}]. Local Retirada: ${py.local_estoque}. Status atual: ${py.status}`; 
    const envio = { 
        usuario: usuarioLogado, 
        acao: "atualizar_venda", 
        linha: l, 
        data: py.data, 
        cliente: py.cliente, 
        produto: py.produto, 
        socio: py.socio, 
        qtd: py.qtd, 
        valor_venda: py.valorStr, 
        status: py.status, 
        custo_und: "0", 
        custo_total: "0", 
        data_pg: py.status === "Pago" ? py.data : "", 
        observacao: py.observacao, 
        local_estoque: py.local_estoque, 
        log_detalhe: msgLog 
    }; 
    
    fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify(envio) })
        .then(r => r.json())
        .then(res => { 
            if(res.sucesso) {
                mostrarAlerta("Atualizado!", "Venda editada e estoque corrigido.", "success"); 
            } else {
                mostrarAlerta("Erro", res.erro || "Falha.", "error"); 
            }
            sincronizarDadosUnico(); 
        }).catch(e => {
            mostrarAlerta("Erro", "Falha de conexão.", "error");
            sincronizarDadosUnico();
        }); 
}

function renderizarDashboard() { const dMes = document.getElementById('d-filtro-mes'); const dAno = document.getElementById('d-filtro-ano'); if (!dMes.value && !dAno.value) { const h = new Date(); dMes.value = String(h.getMonth() + 1).padStart(2, '0'); dAno.value = String(h.getFullYear()); } const fM = dMes.value; const fA = dAno.value; let pfx = fA && fM ? `${fA}-${fM}` : fA; const vDash = vendasGlobal.filter(v => pfx ? (v.dataVendaIso && v.dataVendaIso.startsWith(pfx)) : true); const gDash = gastosGlobal.filter(g => pfx ? (g.dataIso && g.dataIso.startsWith(pfx)) : true); let tRec = 0, tPend = 0, tGas = 0, tLucroTotal = 0, mProd = {}, mCli = {}, mSoc = {}; vDash.forEach(v => { const val = parseDinheiro(v.valor_venda); const luc = parseDinheiro(v.lucro); const q = parseInt(v.qtd) || 1; if (v.status === 'Pago') tRec += val; else tPend += val; tLucroTotal += luc; if (v.produto) mProd[v.produto] = (mProd[v.produto] || 0) + q; if (v.cliente) mCli[v.cliente] = (mCli[v.cliente] || 0) + val; if (v.socio) mSoc[v.socio] = (mSoc[v.socio] || 0) + luc; }); gDash.forEach(g => tGas += parseDinheiro(g.total)); const lReal = tRec - tGas; let estItens = 0, estValor = 0; estoqueGlobal.forEach(e => { let q = parseFloat(e.qtd) || 0; if (q > 0) { estItens += q; estValor += (q * parseDinheiro(e.preco)); } }); const patrimonio = lReal + tPend + estValor; document.getElementById('d-patrimonio').innerText = fmt(patrimonio); document.getElementById('d-lucro-real').innerText = fmt(lReal); document.getElementById('card-lucro-real').classList.toggle('negativo', lReal < 0); document.getElementById('d-receitas').innerText = fmt(tRec); document.getElementById('d-gastos').innerText = fmt(tGas); document.getElementById('d-receber').innerText = fmt(tPend); document.getElementById('d-lucro-projetado').innerText = fmt(tLucroTotal); document.getElementById('d-estoque-itens').innerText = estItens; document.getElementById('d-estoque-valor').innerText = fmt(estValor); let arrProd = Object.keys(mProd).map(k => ({ nome: k, qtd: mProd[k] })).sort((a, b) => b.qtd - a.qtd).slice(0, 3); let arrCli = Object.keys(mCli).map(k => ({ nome: k, val: mCli[k] })).sort((a, b) => b.val - a.val).slice(0, 3); document.getElementById('d-ranking-produtos').innerHTML = arrProd.length ? arrProd.map((p, i) => `<li class="ranking-item"><span class="ranking-pos">#${i + 1}</span><span class="ranking-name">${p.nome}</span><span class="ranking-val">${p.qtd} un</span></li>`).join('') : "<li style='color:#999;'>Sem dados</li>"; document.getElementById('d-ranking-clientes').innerHTML = arrCli.length ? arrCli.map((c, i) => `<li class="ranking-item"><span class="ranking-pos">#${i + 1}</span><span class="ranking-name">${c.nome}</span><span class="ranking-val">${fmt(c.val)}</span></li>`).join('') : "<li style='color:#999;'>Sem dados</li>"; let hSoc = ""; for (let s in mSoc) { hSoc += `<div class="dash-socios-linha"><span>${s}</span> <strong style="color:var(--primary-dark);">${fmt(mSoc[s])}</strong></div>`; } document.getElementById('d-socios-lucro').innerHTML = hSoc || "<p style='font-size:0.8rem; color:#999; text-align:center;'>Sem lucros.</p>"; if (typeof Chart !== 'undefined') { const ctxRG = document.getElementById('chartReceitasGastos').getContext('2d'); const ctxSt = document.getElementById('chartStatusVendas').getContext('2d'); if (chartRGBase) chartRGBase.destroy(); chartRGBase = new Chart(ctxRG, { type: 'bar', data: { labels: ['Caixa', 'Gastos'], datasets: [{ label: 'Valor', data: [tRec, tGas], backgroundColor: ['#2e7d32', '#c62828'], borderRadius: 8 }] }, options: { responsive: true, plugins: { legend: { display: false } } } }); if (chartStatusBase) chartStatusBase.destroy(); chartStatusBase = new Chart(ctxSt, { type: 'doughnut', data: { labels: ['Pago', 'Fiado'], datasets: [{ data: [tRec, tPend], backgroundColor: ['#2e7d32', '#f59e0b'], borderWidth: 0 }] }, options: { responsive: true } }); } }
function abrirModalRelatorios() { document.getElementById('modal-relatorios').style.display = 'flex'; }
function exportarExcel() { const dMes = document.getElementById('d-filtro-mes').value; const dAno = document.getElementById('d-filtro-ano').value; let pfx = dAno && dMes ? `${dAno}-${dMes}` : dAno; const vDash = vendasGlobal.filter(v => pfx ? (v.dataVendaIso && v.dataVendaIso.startsWith(pfx)) : true); if (vDash.length === 0) return mostrarAlerta("Aviso", "Nenhuma venda neste período.", "warning"); let csvContent = "data:text/csv;charset=utf-8,Data,Cliente,Produto,Socio,Quantidade,Valor,Status,Custo Und,Custo Total,Lucro,Markup,Data Pagamento,Observacao\n"; vDash.forEach(v => { let obsLimpa = v.observacao ? v.observacao.replace(/\n/g, ' ').replace(/"/g, '""') : ''; let row = [v.dataVendaDisplay, `"${v.cliente}"`, `"${v.produto}"`, v.socio, v.qtd, `"${v.valor_venda}"`, v.status, `"${v.custo_und}"`, `"${v.custo_total}"`, `"${v.lucro}"`, `"${v.markup}"`, v.dataPgtoDisplay || "", `"${obsLimpa}"`]; csvContent += row.join(",") + "\n"; }); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `Vendas_Novera_${pfx || 'Tudo'}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); }
function copiarFechamento() { const dMesSel = document.getElementById('d-filtro-mes'); const dMesText = dMesSel.options[dMesSel.selectedIndex].text; const dAno = document.getElementById('d-filtro-ano').value || 'Todo o Período'; let lReal = document.getElementById('d-lucro-real').innerText; let entradas = document.getElementById('d-receitas').innerText; let saidas = document.getElementById('d-gastos').innerText; let aReceber = document.getElementById('d-receber').innerText; let patrimonio = document.getElementById('d-patrimonio').innerText; let txt = `📊 *FECHAMENTO NOVERA SCENT* 📊\n🗓️ Período: ${dMesText} ${dAno}\n\n👑 *Patrimônio Total:* ${patrimonio}\n\n📈 *Entradas (Pagas):* ${entradas}\n📉 *Saídas (Gastos):* ${saidas}\n⏳ *A Receber (Fiado):* ${aReceber}\n💰 *Caixa Líquido:* ${lReal}\n\n🤝 *Divisão de Lucros Projetada:*\n`; const fM = document.getElementById('d-filtro-mes').value; const fA = document.getElementById('d-filtro-ano').value; let pfx = fA && fM ? `${fA}-${fM}` : fA; const vDash = vendasGlobal.filter(v => pfx ? (v.dataVendaIso && v.dataVendaIso.startsWith(pfx)) : true); let mSoc = {}; vDash.forEach(v => { const luc = parseDinheiro(v.lucro); if (v.socio) mSoc[v.socio] = (mSoc[v.socio] || 0) + luc; }); let sociosText = ""; for (let s in mSoc) { sociosText += `▪️ ${s}: ${fmt(mSoc[s])}\n`; } txt += sociosText || "Nenhum lucro.\n"; txt += `\n✨ _Bora pra cima!_ 🚀`; navigator.clipboard.writeText(txt).then(() => { mostrarAlerta("Copiado!", "Resumo do fechamento copiado.", "success"); }).catch(err => { mostrarAlerta("Erro", "Falha ao copiar texto.", "error"); }); }

function fazerLogout(motivo) {
    if (motivo) alert(motivo);
    localStorage.removeItem('novera_token'); // Exclui o crachá
    localStorage.removeItem('novera_session_expires');
    localStorage.removeItem('novera_user_cargo');
    dadosCarregados = false;
    window.location.reload();
}

function salvarConfiguracoesChaves() {
    const keyGemini = document.getElementById('cfg-ai-key').value.trim();
    const keyImgBB = document.getElementById('cfg-imgbb-key').value.trim();
    const keyOnionSys = document.getElementById('cfg-onionsys-key').value.trim();
    if (keyGemini) localStorage.setItem('novera_ai_key', keyGemini);
    if (keyImgBB) { localStorage.setItem('novera_imgbb_key', keyImgBB); KEY_IMGBB = keyImgBB; }
    if (keyOnionSys) { localStorage.setItem('novera_onionsys_key', keyOnionSys); TOKEN_ONIONSYS = keyOnionSys; }
    mostrarAlerta("Salvo!", "Suas chaves foram gravadas.", "success");
}

async function alterarSenha() {
    const atual = document.getElementById('cfg-senha-atual').value;
    const nova = document.getElementById('cfg-nova-senha').value;
    if (!atual || !nova) return mostrarAlerta("Atenção", "Preencha as senhas.", "warning");

    mostrarLoading("Atualizando Senha...");
    try {
        const res = await fetch(API_NOVERA, {
            method: "POST",
            headers: cabecalhoAuth(),
            body: JSON.stringify({ acao: "alterar_senha", usuario: usuarioLogado, senha_atual: atual, nova_senha: nova })
        });
        const json = await res.json();
        if (json.sucesso) {
            mostrarAlerta("Sucesso", "Senha alterada!", "success");
            document.getElementById('cfg-senha-atual').value = "";
            document.getElementById('cfg-nova-senha').value = "";
        } else {
            mostrarAlerta("Erro", json.erro, "error");
        }
    } catch (e) {
        mostrarAlerta("Erro", "Falha na conexão.", "error");
    } finally {
        ocultarLoading();
    }
}

window.onload = () => {
    aplicarVersao(); 
    const selectAno = document.getElementById('d-filtro-ano'); selectAno.innerHTML = '<option value="">Todos</option>'; const anoAtual = new Date().getFullYear(); for (let i = 2024; i <= anoAtual + 1; i++) { selectAno.innerHTML += `<option value="${i}">${i}</option>`; }
    calcularNovera(); verificarLogin();
    document.getElementById('cfg-ai-key').value = localStorage.getItem('novera_ai_key') || ''; document.getElementById('cfg-imgbb-key').value = localStorage.getItem('novera_imgbb_key') || ''; document.getElementById('cfg-onionsys-key').value = localStorage.getItem('novera_onionsys_key') || '';
};

function abrirModalEtiquetaAmostras() {
    if (rotulosGlobal.length === 0) return mostrarAlerta("Aviso", "Nenhuma essência cadastrada.", "warning");

    let html = `<label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:10px; cursor:pointer;"><input type="checkbox" onchange="toggleTodasEtiquetas(this)" style="width:16px; height:16px; flex-shrink:0;"> <strong>Selecionar Todas</strong></label><div style="border-top:1px dashed #E8DDE1; margin-bottom:10px;"></div>`;

    let rotulosOrdenados = [...rotulosGlobal].sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || "")));

    rotulosOrdenados.forEach(r => {
        let gen = r.genero ? ` (${r.genero})` : '';
        html += `<label style="display:flex; align-items:center; gap:8px; font-size:0.8rem; margin-bottom:8px; cursor:pointer;"><input type="checkbox" class="chk-etq-rotulo" value="${r.linha}" style="width:16px; height:16px; flex-shrink:0;"> <b>${r.codigo}</b> - ${r.essencia}${gen}</label>`;
    });

    document.getElementById('etiqueta-checkbox-container').innerHTML = html;
    document.getElementById('modal-gerar-etiqueta').style.display = 'flex';
}

function toggleTodasEtiquetas(source) {
    document.querySelectorAll('.chk-etq-rotulo').forEach(cb => cb.checked = source.checked);
}

async function gerarEtiquetaPDF() {
    const checkboxes = document.querySelectorAll('.chk-etq-rotulo:checked');
    if (checkboxes.length === 0) return mostrarAlerta("Aviso", "Selecione pelo menos uma fragrância.", "warning");

    document.getElementById('modal-gerar-etiqueta').style.display = 'none';
    mostrarLoading("Gerando Etiqueta...");

    let listFem = "", listMasc = "";

    checkboxes.forEach(chk => {
        const r = rotulosGlobal.find(x => x.linha == chk.value);
        if (r) {
            let gen = String(r.genero || "").toLowerCase().trim();
            let linhaHtml = `<div style="display: flex; gap: 5px; font-size: 9px; margin-bottom: 2px;">
                <span style="font-weight: 800; color: #2C2A2B;">${r.codigo}</span>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.essencia}</span>
            </div>`;

            if (gen === 'feminino') {
                listFem += linhaHtml;
            } else {
                listMasc += linhaHtml;
            }
        }
    });

    let htmlEtiqueta = `
    <div style="width: 110mm; height: 85mm; max-height: 85mm; background: #fff; padding: 5mm; box-sizing: border-box; font-family: 'Montserrat', sans-serif; color: #2C2A2B; overflow: hidden;">
        <div style="text-align: center; margin-bottom: 8px;">
            <img src="logo.png" style="height: 25px; margin-bottom: 3px; object-fit: contain;">
            <h3 style="font-size: 11px; margin: 0; color: #966178; text-transform: uppercase; font-family: 'Playfair Display', serif; letter-spacing: 1px;">Novera Scent - Amostras</h3>
        </div>
        <div style="display: flex; gap: 4mm; height: calc(100% - 40px);">
            <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: 900; border-bottom: 1px solid #f3d8e2; padding-bottom: 2px; margin-bottom: 4px; color: #be185d; font-size: 10px;">FEMININO</div>
                <div style="display: flex; flex-direction: column;">
                    ${listFem || "<i style='color:#ccc; font-size: 9px;'>Nenhum selecionado</i>"}
                </div>
            </div>
            <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: 900; border-bottom: 1px solid #e0f2fe; padding-bottom: 2px; margin-bottom: 4px; color: #0369a1; font-size: 10px;">MASCULINO / OUTROS</div>
                <div style="display: flex; flex-direction: column;">
                    ${listMasc || "<i style='color:#ccc; font-size: 9px;'>Nenhum selecionado</i>"}
                </div>
            </div>
        </div>
    </div>`;

    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlEtiqueta;
    tempDiv.style.position = 'absolute';
    tempDiv.style.top = '0';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);

    try {
        await new Promise(r => setTimeout(r, 300));
        let opt = {
            margin: 0,
            filename: `Etiqueta_Caixa_Amostras_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 4, useCORS: true, scrollY: 0, windowY: 0 },
            jsPDF: { unit: 'mm', format: [110, 85], orientation: 'landscape' },
            pagebreak: { mode: ['avoid-all'] }
        };
        await html2pdf().set(opt).from(tempDiv.firstElementChild).save();
        mostrarAlerta("Sucesso", "Etiqueta gerada lindamente!", "success");
    } catch (err) {
        console.error(err);
        mostrarAlerta("Erro", "Falha ao gerar o PDF.", "error");
    } finally {
        document.body.removeChild(tempDiv);
        ocultarLoading();
    }
}

function abrirModalNovidades() {
    document.getElementById('modal-novidades').style.display = 'flex';
}

function fecharModalNovidades() {
    localStorage.setItem('novera_versao_vista', VERSAO_ATUAL_SISTEMA);
    document.getElementById('modal-novidades').style.display = 'none';
}

function verificarNovidades() {
    const versaoVista = localStorage.getItem('novera_versao_vista');
    if (versaoVista !== VERSAO_ATUAL_SISTEMA) {
        setTimeout(abrirModalNovidades, 1000); 
    }
}

function abrirModalImagem(src) { if (!src || src.includes('placeholder')) return; document.getElementById('img-zoom-src').src = src; document.getElementById('modal-zoom-imagem').style.display = 'flex'; }
function fecharModalImagem() { document.getElementById('modal-zoom-imagem').style.display = 'none'; document.getElementById('img-zoom-src').src = ""; }
function pedirNomeDocumento(nomeOriginal, titulo) { return new Promise((resolve) => { document.getElementById('modal-doc-titulo').innerText = titulo; const input = document.getElementById('modal-doc-nome-input'); input.value = nomeOriginal; document.getElementById('modal-nome-documento').style.display = 'flex'; setTimeout(() => input.focus(), 100); const btnConfirmar = document.getElementById('btn-modal-doc-confirmar'); const btnCancelar = document.getElementById('btn-modal-doc-cancelar'); const removerListeners = () => { btnConfirmar.removeEventListener('click', onConfirmar); btnCancelar.removeEventListener('click', onCancelar); window.cancelarNomeDoc = null; }; const onConfirmar = () => { document.getElementById('modal-nome-documento').style.display = 'none'; removerListeners(); resolve(input.value.trim() === "" ? nomeOriginal : input.value.trim()); }; const onCancelar = () => { document.getElementById('modal-nome-documento').style.display = 'none'; removerListeners(); resolve(null); }; window.cancelarNomeDoc = onCancelar; btnConfirmar.addEventListener('click', onConfirmar); btnCancelar.addEventListener('click', onCancelar); }); }
const fileToBase64 = f => new Promise((r, j) => { const rd = new FileReader(); rd.readAsDataURL(f); rd.onload = () => r(rd.result.split(',')[1]); rd.onerror = e => j(e); });
function comprimirImagem(f, mW, mH, q) { return new Promise((r, j) => { if (!f.type.match(/image.*/)) return j(new Error(`Formato inválido.`)); const rd = new FileReader(); rd.readAsDataURL(f); rd.onload = e => { const i = new Image(); i.src = e.target.result; i.onload = () => { let w = i.width, h = i.height; if (w > h) { if (w > mW) { h = Math.round(h * mW / w); w = mW; } } else { if (h > mH) { w = Math.round(w * mH / h); h = mH; } } const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.drawImage(i, 0, 0, w, h); cv.toBlob(b => b ? r(new File([b], "img.jpg", { type: 'image/jpeg' })) : j(new Error("Erro na Compressão")), 'image/jpeg', q); }; }; }); }
async function uploadDuplo(fileBlob) { let urlOnion = "", urlImgBB = ""; try { const fd = new FormData(); fd.append("imagem", fileBlob); const res = await fetch("https://api.onionsys.com.br/api/novera/registrar/catalogo", { method: "POST", headers: { "Authorization": `Bearer ${TOKEN_ONIONSYS}` }, body: fd }); const text = await res.text(); if (res.ok) { const data = JSON.parse(text); urlOnion = (data.arquivos && data.arquivos.length > 0) ? data.arquivos[0].url : (data.url || data.link || (data.filename ? `https://api.onionsys.com.br/arquivos/catalogo/${data.filename}` : "")); } } catch (e) { } try { const fd2 = new FormData(); fd2.append("image", fileBlob); const res2 = await fetch(`https://api.imgbb.com/1/upload?key=${KEY_IMGBB}`, { method: "POST", body: fd2 }); const data2 = await res2.json(); if (data2.success) urlImgBB = data2.data.url; } catch (e) { } if (!urlOnion && !urlImgBB) throw new Error("Falha no upload."); return [urlOnion, urlImgBB].filter(u => u).join(','); }



// ==========================================
// MÓDULO: LEITOR DE QR CODE / CÓDIGO DE BARRAS
// ==========================================
let leitorQRScanner = null;

function abrirLeitorCamera() {
    document.getElementById('modal-camera').style.display = 'flex';
    
    // Dá 300ms para o navegador "desenhar" a janela antes de ligar a lente
    setTimeout(() => {
        if (!leitorQRScanner) {
            leitorQRScanner = new Html5Qrcode("reader");
        }
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        leitorQRScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            console.error(err);
            mostrarAlerta("Erro na Câmera", "Dê permissão para acessar a câmera no seu navegador.", "error");
            fecharLeitorCamera();
        });
    }, 300);
}

function fecharLeitorCamera() {
    if (leitorQRScanner && leitorQRScanner.isScanning) {
        leitorQRScanner.stop().then(() => {
            document.getElementById('modal-camera').style.display = 'none';
        }).catch(err => {
            document.getElementById('modal-camera').style.display = 'none';
        });
    } else {
        document.getElementById('modal-camera').style.display = 'none';
    }
}

function onScanSuccess(codigoLido, decodedResult) {
    fecharLeitorCamera();
    
    let codigoLidoLimpo = codigoLido.trim();
    let codigoPesquisa = codigoLidoLimpo;

    // A MÁGICA: Se o código lido for a URL gigante, ele "corta" e pega só o N001 do final
    if (codigoLidoLimpo.includes('venda=')) {
        try {
            const url = new URL(codigoLidoLimpo);
            codigoPesquisa = url.searchParams.get('venda');
        } catch(e) {
            codigoPesquisa = codigoLidoLimpo.split('venda=')[1].split('&')[0];
        }
    }

    const codigoLimpo = (codigoPesquisa || '').toUpperCase(); 
    
    const selectProd = document.getElementById('v-produto');
    let encontrou = false;
    
    for (let i = 0; i < selectProd.options.length; i++) {
        if (selectProd.options[i].text.includes(codigoLimpo + ' -') || selectProd.options[i].text.startsWith(codigoLimpo)) {
            selectProd.selectedIndex = i;
            encontrou = true;
            break;
        }
    }
    
    if (encontrou) {
        autoPreencherValorVenda(); 
        mostrarAlerta("Bip! 🎯", `Produto ${codigoLimpo} identificado!`, "success");
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    } else {
        mostrarAlerta("Não encontrado", `O código ${codigoLimpo} não foi achado no estoque físico.`, "warning");
    }
}

function onScanFailure(error) {
    // Ele fica rodando 10 vezes por segundo, então se falhar o frame, ignora e tenta o próximo.
}

// ==========================================
// MÓDULO: DEEP LINKING (Leitura Direta da Câmera do Celular)
// ==========================================
function verificarComandosURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const produtoScan = urlParams.get('venda');

    if (produtoScan) {
        const codigoLimpo = produtoScan.trim().toUpperCase();
        
        // 1. Força a ir para a tela de Vendas
        switchTab('vendas');
        toggleVendasTab('registro');
        
        // 2. Preenche a data de hoje automaticamente
        document.getElementById('v-data').valueAsDate = new Date();
        
        // 3. Procura o produto na lista
        const selectProd = document.getElementById('v-produto');
        let encontrou = false;
        
        for (let i = 0; i < selectProd.options.length; i++) {
            if (selectProd.options[i].text.includes(codigoLimpo + ' -') || selectProd.options[i].text.startsWith(codigoLimpo)) {
                selectProd.selectedIndex = i;
                encontrou = true;
                break;
            }
        }
        
        if (encontrou) {
            autoPreencherValorVenda();
            mostrarAlerta("Pronto! 🎯", `Produto ${codigoLimpo} carregado e pronto para venda.`, "success");
            
            // 4. Limpa a barra de endereços para não repetir se você recarregar a página
            window.history.replaceState(null, null, window.location.pathname);
        } else {
            mostrarAlerta("Não encontrado", `O código ${codigoLimpo} não foi achado no estoque físico.`, "warning");
        }
    }
}

// ==========================================
// MÓDULO: GERADOR DE QR CODES PARA IMPRESSORA
// ==========================================

const predefinicoesQR = {
    epson_150_90: { w: 150, h: 90, qr: 16, gap: 3, mx: 5, my: 5 },
    pimaco_100_50: { w: 100, h: 50, qr: 15, gap: 2, mx: 4, my: 4 },
    a4_padrao: { w: 210, h: 297, qr: 22, gap: 5, mx: 10, my: 10 }
};

function aplicarPresetQR() {
    const val = document.getElementById('qr-preset').value;
    if(val !== 'custom' && predefinicoesQR[val]) {
        const p = predefinicoesQR[val];
        document.getElementById('qr-papel-w').value = p.w;
        document.getElementById('qr-papel-h').value = p.h;
        document.getElementById('qr-tamanho').value = p.qr;
        document.getElementById('qr-gap').value = p.gap;
        document.getElementById('qr-margem-x').value = p.mx;
        document.getElementById('qr-margem-y').value = p.my;
        salvarConfigQR();
    }
}

function marcarPresetCustom() {
    document.getElementById('qr-preset').value = 'custom';
    salvarConfigQR();
}

function salvarConfigQR() {
    const config = {
        w: document.getElementById('qr-papel-w').value,
        h: document.getElementById('qr-papel-h').value,
        qr: document.getElementById('qr-tamanho').value,
        gap: document.getElementById('qr-gap').value,
        mx: document.getElementById('qr-margem-x').value,
        my: document.getElementById('qr-margem-y').value,
        preset: document.getElementById('qr-preset').value
    };
    localStorage.setItem('novera_qr_config', JSON.stringify(config));
}

function carregarConfigQR() {
    const saved = localStorage.getItem('novera_qr_config');
    if (saved) {
        const config = JSON.parse(saved);
        document.getElementById('qr-papel-w').value = config.w || 150;
        document.getElementById('qr-papel-h').value = config.h || 90;
        document.getElementById('qr-tamanho').value = config.qr || 16;
        document.getElementById('qr-gap').value = config.gap || 3;
        document.getElementById('qr-margem-x').value = config.mx || 5;
        document.getElementById('qr-margem-y').value = config.my || 5;
        document.getElementById('qr-preset').value = config.preset || 'custom';
    }
}

function abrirModalQrCode() {
    carregarConfigQR(); // Puxa a última configuração salva!
    
    const container = document.getElementById('lista-qr-produtos');
    let html = '';
    
    let rotulosOrdenados = [...rotulosGlobal].sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || "")));
    
    rotulosOrdenados.forEach(r => {
        if(!r.codigo) return;
        html += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #E8DDE1; padding: 8px 0;">
            <span style="font-size: 0.8rem; color: #2C2A2B; font-weight: 700;">${r.codigo} - ${r.essencia}</span>
            <input type="number" class="input-qtd-qr" data-codigo="${r.codigo}" min="0" value="0" style="width: 60px; padding: 5px; border-radius: 6px; border: 1px solid var(--primary); text-align: center; font-weight: 900; color: var(--primary-dark);">
        </div>`;
    });
    
    container.innerHTML = html;
    document.getElementById('modal-gerar-qrcode').style.display = 'flex';
}

function preencherQtdQrComEstoque() {
    const inputs = document.querySelectorAll('.input-qtd-qr');
    inputs.forEach(input => {
        const cod = input.getAttribute('data-codigo');
        let total = 0;
        for(let key in estoqueAgrupado) {
            if(estoqueAgrupado[key].codigo === cod) {
                total += estoqueAgrupado[key].totalQtd;
            }
        }
        input.value = total > 0 ? total : 0;
    });
    mostrarAlerta("Preenchido!", "Quantidades atualizadas com o estoque real.", "success");
}

function salvarProducaoRapida() {
    const nomeProduto = document.getElementById('pr-produto').value;
    const qtdRendimento = parseFloat(document.getElementById('pr-qtd').value) || 0;
    const diasMaceracao = parseInt(document.getElementById('pr-dias').value) || 0;

    if (!nomeProduto || qtdRendimento <= 0) {
        return mostrarAlerta("Atenção", "Selecione o produto e informe o rendimento.", "warning");
    }

    // A MÁGICA: Ele puxa do estoque o tipo, código, custo e preço que o produto já tem!
    const prodRef = estoqueAgrupado[padronizarTexto(nomeProduto)];
    if (!prodRef) return mostrarAlerta("Erro", "Produto não encontrado.", "error");

    // Faz o cálculo da data futura
    const dataHojeCalculo = new Date();
    dataHojeCalculo.setDate(dataHojeCalculo.getDate() + diasMaceracao);
    const dataPrev = dataHojeCalculo.toISOString().split('T')[0];
    const dataInicio = new Date().toISOString().split('T')[0];

    mostrarLoading("Colocando na Fila...");
    const msgLog = `⏳ Reposição Fila: ${qtdRendimento}x [${prodRef.nome}]. Previsão: ${dataBR(dataPrev)} (${diasMaceracao} dias).`;

    fetch(API_NOVERA, {
        method: "POST", headers: cabecalhoAuth(),
        body: JSON.stringify({ 
            usuario: usuarioLogado, 
            acao: "salvar_producao_fila", 
            data_inicio: dataInicio, 
            data_previsao: dataPrev, 
            nome_produto: prodRef.nome, 
            tipo: prodRef.tipo, 
            qtd_prevista: qtdRendimento, 
            custo: fmtPlanilha(parseDinheiro(prodRef.custo)), 
            preco: fmtPlanilha(parseDinheiro(prodRef.preco)), 
            codigo: prodRef.codigo || '', 
            log_detalhe: msgLog 
        })
    }).then(() => {
        mostrarAlerta("Lote na Fila!", `Nova leva de ${prodRef.nome} em maceração!`, "success");
        document.getElementById('pr-produto').value = "";
        document.getElementById('pr-qtd').value = "10";
        document.getElementById('pr-dias').value = "15";
        sincronizarDadosUnico();
    });
}

function abrirModalEditarProducao(linha) {
    const p = producaoGlobal.find(x => x.linha === linha);
    if (!p) return;
    document.getElementById('edit-p-linha').value = p.linha;
    document.getElementById('edit-p-nome').value = p.nome_produto;
    document.getElementById('edit-p-qtd').value = p.qtd_prevista;
    document.getElementById('edit-p-data').value = p.data_previsao;
    document.getElementById('modal-editar-producao').style.display = 'flex';
}

function salvarEdicaoProducao() {
    const linha = document.getElementById('edit-p-linha').value;
    const nome = document.getElementById('edit-p-nome').value;
    const qtd = document.getElementById('edit-p-qtd').value;
    const dataPrev = document.getElementById('edit-p-data').value;
    
    if (!qtd || !dataPrev) return mostrarAlerta("Atenção", "Preencha a data e a quantidade.", "warning");
    
    document.getElementById('modal-editar-producao').style.display = 'none';
    mostrarLoading("Atualizando Maceração...");
    
    const msgLog = `✏️ Editou lote [${nome}]: Qtd -> ${qtd} un | Nova Previsão -> ${dataBR(dataPrev)}`;
    
    const py = {
        usuario: usuarioLogado,
        acao: "atualizar_producao_fila",
        linha: linha,
        qtd: qtd,
        data_previsao: dataPrev,
        log_detalhe: msgLog
    };
    
    fetch(API_NOVERA, { method: "POST", headers: cabecalhoAuth(), body: JSON.stringify(py) })
        .then(r => r.json())
        .then(res => {
            if (res.sucesso) {
                mostrarAlerta("Atualizado!", "O lote foi modificado com sucesso.", "success");
            } else {
                mostrarAlerta("Erro", res.erro || "Falha ao editar.", "error");
            }
            sincronizarDadosUnico();
        }).catch(e => {
            mostrarAlerta("Erro", "Falha de conexão.", "error");
            sincronizarDadosUnico();
        });
}


async function gerarPdfQrCodes() {
    const inputs = document.querySelectorAll('.input-qtd-qr');
    let toPrint = [];
    
    inputs.forEach(inp => {
        const q = parseInt(inp.value) || 0;
        if (q > 0) toPrint.push({ codigo: inp.getAttribute('data-codigo'), qtd: q });
    });
    
    if (toPrint.length === 0) return mostrarAlerta("Aviso", "Coloque a quantidade em pelo menos um produto.", "warning");
    
    // Captura as configurações e salva
    salvarConfigQR();
    const pW = parseFloat(document.getElementById('qr-papel-w').value) || 150;
    const pH = parseFloat(document.getElementById('qr-papel-h').value) || 90;
    const qrSize = parseFloat(document.getElementById('qr-tamanho').value) || 16;
    const gap = parseFloat(document.getElementById('qr-gap').value) || 3;
    const mx = parseFloat(document.getElementById('qr-margem-x').value) || 5;
    const my = parseFloat(document.getElementById('qr-margem-y').value) || 5;

    document.getElementById('modal-gerar-qrcode').style.display = 'none';
    mostrarLoading("Calculando Matemática das Etiquetas...");
    
    const tempQR = document.createElement('div');
    tempQR.style.position = 'absolute';
    tempQR.style.left = '-9999px';
    document.body.appendChild(tempQR);
    
    const baseUrl = "https://diario.vivainteligente.net/novera/index.html?venda=";
    let todasAsEtiquetasHtml = [];
    
    const qrBoxW = qrSize;
    const qrBoxH = qrSize + 5; // QR + texto
    
    for (let item of toPrint) {
        tempQR.innerHTML = '';
        new QRCode(tempQR, {
            text: baseUrl + item.codigo,
            width: 128, height: 128,
            colorDark : "#000000", colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        
        await new Promise(r => setTimeout(r, 40));
        const canvas = tempQR.querySelector('canvas');
        const dataUrl = canvas.toDataURL("image/jpeg");
        
        const htmlAdesivo = `
        <div style="width: ${qrBoxW}mm; height: ${qrBoxH}mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; box-sizing: border-box; background: #fff; overflow: hidden;">
            <img src="${dataUrl}" style="width: ${qrSize}mm; height: ${qrSize}mm; display: block; object-fit: contain;">
            <div style="font-size: 8px; font-family: Arial, sans-serif; font-weight: bold; color: #000; text-align: center; margin-top: 1mm; line-height: 1; white-space: nowrap;">${item.codigo}</div>
        </div>`;
        
        for (let i = 0; i < item.qtd; i++) todasAsEtiquetasHtml.push(htmlAdesivo);
    }
    document.body.removeChild(tempQR);
    
    // A MÁGICA MATEMÁTICA
    const areaUtilW = pW - (mx * 2);
    const areaUtilH = pH - (my * 2);
    
    const colunas = Math.max(1, Math.floor((areaUtilW + gap) / (qrBoxW + gap)));
    const linhas = Math.max(1, Math.floor((areaUtilH + gap) / (qrBoxH + gap)));
    const qrsPorPagina = colunas * linhas;
    
    // O Container Invisível Mestre
    const masterContainer = document.createElement('div');
    masterContainer.style.position = 'absolute';
    masterContainer.style.top = '0';
    masterContainer.style.left = '-9999px';
    document.body.appendChild(masterContainer);

    let paginasDOM = [];
    
    for (let i = 0; i < todasAsEtiquetasHtml.length; i += qrsPorPagina) {
        const pedacoDaPagina = todasAsEtiquetasHtml.slice(i, i + qrsPorPagina);
        
        // Em vez de fazer uma "tripa gigante", criamos um Bloco HTML real para cada página
        const paginaDiv = document.createElement('div');
        paginaDiv.style.width = `${pW}mm`;
        paginaDiv.style.height = `${pH}mm`;
        paginaDiv.style.padding = `${my}mm ${mx}mm`;
        paginaDiv.style.boxSizing = 'border-box';
        paginaDiv.style.background = '#ffffff';
        paginaDiv.style.display = 'flex';
        paginaDiv.style.flexWrap = 'wrap';
        paginaDiv.style.alignContent = 'center';
        paginaDiv.style.justifyContent = 'center';
        paginaDiv.style.gap = `${gap}mm`;
        paginaDiv.style.overflow = 'hidden';
        paginaDiv.innerHTML = pedacoDaPagina.join('');
        
        masterContainer.appendChild(paginaDiv);
        paginasDOM.push(paginaDiv); // Guardamos cada página separada numa lista!
    }
    
    const oldScrollY = window.scrollY;
    const oldScrollX = window.scrollX;
    window.scrollTo(0, 0);

    try {
        mostrarLoading("Criando PDF Perfeito...");
        await new Promise(r => setTimeout(r, 400));
        
        let opt = {
            margin: 0, 
            filename: `Novera_Etiquetas_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 3, backgroundColor: '#ffffff', useCORS: true, scrollY: 0, windowY: 0 },
            jsPDF: { unit: 'mm', format: [pW, pH], orientation: pW > pH ? 'landscape' : 'portrait' }
        };
        
        // O CÓDIGO DA VITÓRIA: Processa uma página, adiciona folha, processa a outra. Sem recortes!
        let worker = html2pdf().set(opt);
        
        for (let i = 0; i < paginasDOM.length; i++) {
            if (i === 0) {
                // Primeira página
                worker = worker.from(paginasDOM[i]).toPdf();
            } else {
                // Para as próximas, cria folha nova e cola a imagem limpa
                worker = worker.get('pdf').then(pdf => {
                    pdf.addPage();
                }).from(paginasDOM[i]).toContainer().toCanvas().toPdf();
            }
        }
        
        await worker.save();
        mostrarAlerta("Vencemos!", "PDF sem quebras e 100% alinhado gerado com sucesso.", "success");
    } catch(e) {
        console.error(e);
        mostrarAlerta("Erro", "Falha ao gerar o PDF.", "error");
    } finally {
        window.scrollTo(oldScrollX, oldScrollY);
        document.body.removeChild(masterContainer);
        ocultarLoading();
    }
}
