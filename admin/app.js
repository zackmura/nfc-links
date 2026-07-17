const $ = id => document.getElementById(id); 

const VERSAO_APP = "v1.1.0";

const URL_ANALYTICS_CATALOGO = "https://script.google.com/macros/s/AKfycbxHVKfSbTxoWDr4SxSva4YsxHgtiif_cwfg3hn7riS9GglI3jXEma_UpB_d-kJrfUaofA/exec";
const API_PRECIFICACAO = "https://script.google.com/macros/s/AKfycbygJ0LejuF4XRAZHJI26sOqskjiigv5UBffe5jhDP3zraqYLy-5X6wHV3kXEMfWHgLmXA/exec";
const API_NFC = "https://script.google.com/macros/s/AKfycbxaubKWb7f9DiIlR8WLryYv8UClrCIbaSM4biGwgkwxUnDFGHsCsL7JQrLEGEZNwRvtdg/exec";
const API_ONIONSYS = "https://api.onionsys.com.br/api/minimundo/registrar/catalogo";
const API_ONIONSYS_ADS = "https://api.onionsys.com.br/api/minimundo/registrar/anuncios";
const TOKEN_ONIONSYS = "M1N1_MUND0_@!!2!3#1@2!";

const TIMES_INFO = { "corinthians":{cor:"#000",logo:"https://a.espncdn.com/i/teamlogos/soccer/500/874.png",classText:"txt-corinthians"},"palmeiras":{cor:"#006400",logo:"https://a.espncdn.com/i/teamlogos/soccer/500/2029.png",classText:"txt-palmeiras"},"santos":{cor:"#555",logo:"https://a.espncdn.com/i/teamlogos/soccer/500/2674.png",classText:"txt-santos"},"são paulo":{cor:"#cc0000",logo:"https://a.espncdn.com/i/teamlogos/soccer/500/2026.png",classText:"txt-saopaulo"},"flamengo":{cor:"#c90000",logo:"https://a.espncdn.com/i/teamlogos/soccer/500/819.png",classText:"txt-flamengo"} };

let dadosTotaisAcessos = [], graficoInstancia = null, catalogoAdminArray = [], anunciosAdminArray = [], quantidadeAnunciosPendentes = -1; 
let custoTotalGlobal = 0, despesaTotalCalculada = 0, arrayBancoCustos = [], arrayDespesas = [], arrayVendas = [], vendasFiltradasAtuais = [], dashVendas = [], dashDespesas = [], linhaVendaPagamento = null, linhaVendaExclusao = null, chartProd = null, chartPlat = null, chartCli = null;
let arrayImas = []; 

const fmt = val => "R$ " + val.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtPlanilha = val => "R$ " + val.toFixed(2).replace('.', ',');
const limparValorPlanilha = val => { if(!val) return 0; if(typeof val==='number') return val; let str=String(val).trim().replace(/R\$\s?/gi,'').trim(); if(str.includes(',')&&str.includes('.')){str=str.replace(/\./g,'').replace(',','.');}else if(str.includes(',')){str=str.replace(',','.');} let num=parseFloat(str); return isNaN(num)?0:num; };
const formatarDoBanco = val => fmt(limparValorPlanilha(val));
function formatarPreco(val){ if(!val) return ""; let v=String(val).trim(); if(v.toUpperCase().includes("R$")) return v; if(!isNaN(v.replace(',','.'))) return "R$ " + parseFloat(v.replace(',','.')).toFixed(2).replace('.',','); return "R$ "+v; }

document.addEventListener('input', e => {
    if(e.target && e.target.classList.contains('mask-money')){ let val=e.target.value.replace(/\D/g,''); if(val===""){e.target.value="";return;} val=(parseInt(val)/100).toFixed(2)+''; val=val.replace(".",","); val=val.replace(/(\d)(\d{3})(\d{3}),/g,"$1.$2.$3,"); val=val.replace(/(\d)(\d{3}),/g,"$1.$2,"); e.target.value="R$ "+val; }
    if(e.target.id==="d-valor-uni"||e.target.id==="d-qtd") calcularDespesaTotal();
});

window.onload = () => { 
    if($('versao-login')) $('versao-login').innerText = VERSAO_APP;
    if($('versao-header')) $('versao-header').innerText = VERSAO_APP;
    
    if(localStorage.getItem("admin_auth")==="true") iniciarApp(); 
};

async function tentarLogin() {
    const usr = $('input-usuario').value.trim();
    const pwd = $('input-senha').value.trim();

    if (!usr || !pwd) {
        return alert("Preencha usuário e senha!");
    }

    const btn = $('btn-login');
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "⏳ Validando no sistema...";

    try {
        const payload = { acao: "login", usuario: usr, senha: pwd };
        const req = await fetch(API_PRECIFICACAO, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await req.json();

        if (res.sucesso) {
            localStorage.setItem("admin_auth", "true");
            localStorage.setItem("admin_user", res.usuario); 
            iniciarApp();
        } else {
            alert(res.erro || "Usuário ou senha incorretos.");
            $('input-senha').value = ""; 
        }
    } catch (e) {
        alert("Erro ao conectar com o servidor: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
}

function verificarEnter(e){ if(e.key==="Enter") tentarLogin(); }

function fazerLogout(){ 
    localStorage.removeItem("admin_auth"); 
    localStorage.removeItem("admin_user");
    location.reload(); 
}

function iniciarApp(){
    $('login-screen').style.display="none"; $('app-core').style.display="block";
    if(localStorage.getItem("gemini_api_key")) $('api-key').value=localStorage.getItem("gemini_api_key");
    if(localStorage.getItem("imgbb_api_key")) $('imgbb-key').value=localStorage.getItem("imgbb_api_key");
    
    const userLogado = localStorage.getItem("admin_user");
    if(userLogado && $('nome-usuario-logado')) $('nome-usuario-logado').innerText = userLogado;
    
    const h = new Date(), mStr = String(h.getMonth()+1).padStart(2,'0'), aStr = String(h.getFullYear()), dIso = h.toISOString().split('T')[0];
    $('filtro-mes').value=mStr; $('filtro-ano').value=aStr;
    $('d-data').value=dIso; $('venda-data').value=dIso; 
    $('filtro-d-mes').value=mStr; $('filtro-d-ano').value=aStr;
    $('filtro-v-mes').value=mStr; $('filtro-v-ano').value=aStr;
    $('filtro-dash-mes').value=mStr; $('filtro-dash-ano').value=aStr;

    carregarAnalytics(); carregarCatalogoAdmin(); carregarAnunciosAdmin(true); atualizarBadgeUltimo(); carregarInfoBanco(); calcular();
    if("Notification" in window && Notification.permission!=="granted" && Notification.permission!=="denied") $('btn-notifica').style.display="inline-flex";
    setInterval(()=>carregarAnunciosAdmin(true), 120000); 
}

function switchTab(tabName, tituloAba = null) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if($('btn-'+tabName)) $('btn-'+tabName).classList.add('active');
    $('tab-'+tabName).classList.add('active');
    
    if($('nav-'+tabName)) $('nav-'+tabName).classList.add('active');

    if(tituloAba) $('titulo-modulo-ativo').innerText = tituloAba;

    const abasERP = ['precificar','vendas','modelos','custos','dashboard_erp'];
    $('terminal').style.display = abasERP.includes(tabName) ? 'none' : 'block';

    if(tabName==='modelos') carregarBancoDeCustos(); 
    if(tabName==='custos') carregarDespesas(); 
    if(tabName==='vendas'){ carregarOpcoesVenda(); carregarVendas(); }
    if(tabName==='dashboard_erp') carregarDashboardERP();
    if(tabName==='imas') carregarImas(); 
}

function addLog(msg, tipo='info'){ $('terminal').innerHTML+=`<div class="log-line"><span class="log-time">[${new Date().toLocaleTimeString('pt-BR')}]</span><span class="log-${tipo}">${msg}</span></div>`; $('terminal').scrollTop=$('terminal').scrollHeight; }

function mostrarAlerta(tit, txt, tipo){ $('modal-titulo-alert').innerText=tit; $('modal-texto-alert').innerText=txt; const ic=$('modal-icone-alert'), b=$('btn-modal-ok'); if(tipo==="success"){ic.innerText="✅";b.style.background="#10b981";b.style.boxShadow="0 6px 0 #059669";}else if(tipo==="warning"){ic.innerText="⚠️";b.style.background="#f59e0b";b.style.boxShadow="0 6px 0 #d97706";}else{ic.innerText="❌";b.style.background="#ef4444";b.style.boxShadow="0 6px 0 #b91c1c";} $('custom-modal').style.display="flex"; if("vibrate" in navigator) navigator.vibrate(50); }
function fecharAlerta(){ $('custom-modal').style.display="none"; }
function abrirConfirmacaoPagamento(l){ linhaVendaPagamento=l; $('custom-confirm-modal').style.display="flex"; } function fecharConfirmacao(){ $('custom-confirm-modal').style.display="none"; linhaVendaPagamento=null; }
function abrirConfirmacaoExclusao(l){ linhaVendaExclusao=l; $('custom-delete-modal').style.display="flex"; } function fecharExclusao(){ $('custom-delete-modal').style.display="none"; linhaVendaExclusao=null; }
function fecharEditarVenda(){ $('custom-edit-venda-modal').style.display="none"; }
function abrirModalEditarVenda(l){ const v=arrayVendas.find(x=>x.linha===l); if(!v)return; $('edit-venda-linha').value=v.linha; $('edit-venda-data').value=v.data.includes('/')?`${v.data.split('/')[2].substring(0,4)}-${v.data.split('/')[1].padStart(2,'0')}-${v.data.split('/')[0].padStart(2,'0')}`:""; $('edit-venda-status').value=v.status; $('edit-venda-cliente').value=v.cliente; $('edit-venda-produto').value=v.produto; $('edit-venda-plataforma').value=v.plataforma; $('edit-venda-qtd').value=v.qtd; $('edit-venda-valor').value=formatarDoBanco(v.valor_venda); $('custom-edit-venda-modal').style.display="flex"; }

async function excluirRegistroLocal(aba, l, idBtn, fnFechar, fnRecarregar, apiBase=URL_ANALYTICS_CATALOGO){ const b=$(idBtn); b.disabled=true; b.innerText="⏳ Excluindo..."; try { const r=await fetch(apiBase,{method:"POST",body:JSON.stringify({acao:"excluir_registro",aba:aba,linha:l})}); const res=await r.json(); if(res.sucesso){addLog(`🗑️ Registro excluído.`, "success"); if(fnFechar)fnFechar(); if(fnRecarregar)fnRecarregar();}else throw new Error("Erro exclusão."); }catch(e){ apiBase===API_PRECIFICACAO?mostrarAlerta("Erro","Falha: "+e.message,"error"):alert("Falha: "+e.message); }finally{b.disabled=false;b.innerText="🗑️ Excluir";} }

// ==========================================
// MÓDULO ÍMAS NFC
// ==========================================
async function carregarImas() {
    $('loading-imas').style.display = 'block';
    $('lista-imas-admin').innerHTML = '';
    try {
        const r = await fetch(API_NFC + "?acao=listar");
        const res = await r.json();
        if (res.sucesso) {
            arrayImas = res.imas.reverse();
            renderListaImas(arrayImas);
        } else throw new Error("Erro ao buscar imas.");
    } catch (e) {
        addLog(`Erro Ímãs: ${e.message}`, "error");
    } finally {
        $('loading-imas').style.display = 'none';
    }
}

function renderListaImas(arr) {
    const lE = $('lista-imas-admin');
    if (arr.length === 0) { lE.innerHTML = "<p style='text-align:center;color:#999;padding:20px;'>Nenhum ímã cadastrado.</p>"; return; }
    
    let h = "";
    arr.forEach(i => {
        const statusVisual = i.linkVideoYoutube ? `<span class="tag-ativo">🎬 Vídeo Ativo</span>` : `<span class="tag-pendente">⏳ Teaser</span>`;
        
        let dataFormatada = "Sem data alvo";
        if(i.dataLiberacao) {
            let d = new Date(i.dataLiberacao);
            if(!isNaN(d)) dataFormatada = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }

        const fotoUrl = i.foto ? i.foto.split(',')[0].trim() : 'logo.png';
        const linkNfc = `https://diario.vivainteligente.net/ima-nfc/?id=${i.id}`;

        h += `
        <div class="list-item">
            <img src="${fotoUrl}" class="list-img" onerror="this.src='logo.png'">
            <div class="list-info">
                <h4 class="list-nome">ID: ${i.id} - ${i.nomes}</h4>
                <div class="list-detalhes">
                    🗓️ Liberação: ${dataFormatada}
                </div>
                <div style="margin-top:8px;">${statusVisual}</div>
            </div>
            <button class="btn-editar" style="margin-right:8px; background:#e0f2fe; border-color:#bae6fd; color:#0369a1;" onclick="copiarLinkNfc('${linkNfc}')" title="Copiar Link">🔗 Link</button>
            <button class="btn-editar" onclick="abrirModalEditarIma(${i.linha})">✏️</button>
        </div>`;
    });
    lE.innerHTML = h;
}

function copiarLinkNfc(link) {
    navigator.clipboard.writeText(link).then(() => {
        mostrarAlerta("Copiado!", "O link do ímã foi copiado para sua área de transferência!\n\nAgora é só colar no seu aplicativo e gravar na tag NFC.", "success");
    }).catch(() => {
        alert("Erro ao copiar o link. Você pode copiar manualmente: " + link);
    });
}

function filtrarImas() {
    const t = $('busca-imas').value.toLowerCase();
    renderListaImas(arrayImas.filter(i => String(i.id).toLowerCase().includes(t) || i.nomes.toLowerCase().includes(t)));
}

async function fazerUploadRedundante(fC, ik) {
    let urlOnion = "";
    let urlImgBB = "";

    try {
        const fd = new FormData(); fd.append("imagem", fC);
        const rp = await fetch(API_ONIONSYS, {method:"POST", headers:{"Authorization":`Bearer ${TOKEN_ONIONSYS}`, "x-tenant-id":"MiniMundo"}, body:fd});
        const tx = await rp.text();
        if (rp.ok) {
            const rs = JSON.parse(tx);
            urlOnion = (rs.arquivos && rs.arquivos.length > 0) ? rs.arquivos[0].url : (rs.url || rs.link || rs.URL || (rs.filename ? `https://api.onionsys.com.br/arquivos/catalogo/${rs.filename}` : ""));
            addLog("✅ Imagem salva no servidor Primário.", "success");
        }
    } catch (e) {
        addLog("⚠️ Servidor primário falhou.", "warn");
    }

    if (ik) {
        try {
            const fd2 = new FormData(); fd2.append("image", fC);
            const r2 = await fetch(`https://api.imgbb.com/1/upload?key=${ik}`, {method:"POST", body:fd2});
            const d2 = await r2.json();
            if (d2.success) {
                urlImgBB = d2.data.url;
                addLog("✅ Imagem salva no Backup (ImgBB).", "success");
            }
        } catch (e) {
            addLog("⚠️ Servidor de backup falhou.", "warn");
        }
    }

    if (!urlOnion && !urlImgBB) throw new Error("Ambos os servidores de imagem falharam. Tente novamente.");

    let urlsFinais = [];
    if (urlOnion) urlsFinais.push(urlOnion);
    if (urlImgBB) urlsFinais.push(urlImgBB);
    
    return urlsFinais.join(",");
}

async function cadastrarIma() {
    const id = $('ima-id').value.trim();
    const nomes = $('ima-nomes').value.trim();
    const fFoto = $('ima-foto').files;
    const fProd = document.createElement('input'); fProd.type = 'file'; 
    const video = $('ima-video').value.trim();
    const dataOriginal = $('ima-data').value; 
    const ik = $('imgbb-key').value.trim();

    const inputProd = document.getElementById("ima-foto-produto"); 

    if(!id || !nomes || fFoto.length === 0 || !inputProd.files[0]) return mostrarAlerta("Atenção", "Preencha ID, Nomes e as DUAS fotos (Cliente e Produto).", "warning");

    const b = $('btn-salvar-ima');
    b.disabled = true; b.innerText = "⏳ Gerando...";

    try {
        addLog(`Subindo foto do cliente...`, "info");
        const urlsCliente = await fazerUploadRedundante(await comprimirImagem(fFoto[0], 600, 600, 0.8), ik);
        
        addLog(`Subindo foto do produto físico...`, "info");
        const urlsProduto = await fazerUploadRedundante(await comprimirImagem(inputProd.files[0], 600, 600, 0.8), ik);

        const p = { 
            acao: "salvar_ima", id: id, nomes: nomes, foto: urlsCliente, 
            linkVideoYoutube: video, dataLiberacao: dataOriginal ? dataOriginal + ":00" : "",
            fotoProduto: urlsProduto 
        };
        
        const r = await fetch(API_NFC, { method: "POST", body: JSON.stringify(p) });
        const res = await r.json();

        if(res.sucesso) {
            mostrarAlerta("Sucesso!", "Ímã cadastrado com fotos personalizadas!", "success");
            carregarImas();
        }
    } catch (e) { addLog(`❌ ERRO: ${e.message}`, "error"); }
    finally { b.disabled = false; b.innerText = "✨ Gerar Ímã"; }
}

function abrirModalEditarIma(l) {
    const i = arrayImas.find(x => x.linha === l);
    if(!i) return;
    $('edit-ima-linha').value = i.linha;
    $('edit-ima-nomes').value = i.nomes;
    $('edit-ima-video').value = i.linkVideoYoutube;
    
    $('edit-ima-foto-antiga').value = i.foto;
    $('edit-ima-img-preview').src = i.foto ? i.foto.split(',')[0].trim() : "logo.png";
    $('edit-ima-foto').value = "";
    
    $('edit-ima-foto-prod-antiga').value = i.fotoProduto || "";
    if(i.fotoProduto) {
        $('edit-ima-prod-preview').src = i.fotoProduto.split(',')[0].trim();
        $('edit-ima-prod-preview').style.display = "block";
    } else {
        $('edit-ima-prod-preview').style.display = "none";
    }
    $('edit-ima-foto-prod').value = "";
    
    if(i.dataLiberacao) {
        $('edit-ima-data').value = String(i.dataLiberacao).substring(0, 16); 
    } else {
        $('edit-ima-data').value = "";
    }

    $('modal-editar-ima').style.display = 'flex';
}

async function salvarEdicaoIma() {
    const b = $('btn-salvar-edicao-ima');
    b.disabled = true; b.innerText = "⏳ Atualizando...";
    
    try {
        const ik = $('imgbb-key').value.trim();
        const idAtual = arrayImas.find(x => x.linha == parseInt($('edit-ima-linha').value)).id; 
        
        let fotoFinal = $('edit-ima-foto-antiga').value;
        const novaFoto = $('edit-ima-foto').files;
        
        let fotoProdFinal = $('edit-ima-foto-prod-antiga').value;
        const novaFotoProd = $('edit-ima-foto-prod').files;

        if(novaFoto.length > 0) {
            addLog(`Atualizando foto do cliente...`, "info");
            fotoFinal = await fazerUploadRedundante(await comprimirImagem(novaFoto[0], 600, 600, 0.8), ik);
        }
        
        if(novaFotoProd.length > 0) {
            addLog(`Atualizando foto do produto...`, "info");
            fotoProdFinal = await fazerUploadRedundante(await comprimirImagem(novaFotoProd[0], 600, 600, 0.8), ik);
        }

        let dataLiberacaoStr = "";
        if($('edit-ima-data').value) { dataLiberacaoStr = $('edit-ima-data').value + ":00"; }

        const p = { 
            acao: "atualizar_ima", 
            linha: $('edit-ima-linha').value, 
            id: idAtual, 
            nomes: $('edit-ima-nomes').value, 
            foto: fotoFinal, 
            linkVideoYoutube: $('edit-ima-video').value, 
            dataLiberacao: dataLiberacaoStr,
            fotoProduto: fotoProdFinal
        };

        const r = await fetch(API_NFC, { method: "POST", body: JSON.stringify(p) });
        const res = await r.json();

        if(res.sucesso) {
            addLog(`✅ Mágica Atualizada!`, "success");
            $('modal-editar-ima').style.display = 'none';
            carregarImas();
        } else throw new Error("Erro API.");

    } catch (e) {
        addLog(`❌ Erro Update: ${e.message}`, "error");
    } finally {
        b.disabled = false; b.innerText = "💾 Atualizar Mágica";
    }
}

function confirmarExclusaoIma() {
    const l = parseInt($('edit-ima-linha').value);
    const i = arrayImas.find(x => x.linha === l);
    if(!i) return;

    $('nome-ima-excluir').innerText = i.nomes;
    $('modal-confirmar-exclusao-ima').style.display = 'flex';
    
    $('btn-executar-exclusao-ima').onclick = function() {
        $('modal-confirmar-exclusao-ima').style.display = 'none';
        excluirRegistroLocal("API_Ignora_Isso", l, "btn-excluir-ima-modal", () => $('modal-editar-ima').style.display='none', carregarImas, API_NFC);
    };
}

// ADMIN: ANALYTICS
function limparDatasManuais(){ $('data-inicio').value=""; $('data-fim').value=""; } function limparFiltrosRapidos(){ $('filtro-mes').value="todos"; $('filtro-ano').value="todos"; }
async function carregarAnalytics(forcar=false){ if(dadosTotaisAcessos.length>0&&!forcar)return; $('loading-analytics').style.display='block'; $('painel-dashboard').style.display='none'; try{ const r=await fetch(URL_ANALYTICS_CATALOGO+"?acao=analytics"); const res=await r.json(); if(res.sucesso){dadosTotaisAcessos=res.dados; aplicarFiltros();}else throw new Error(res.erro); }catch(e){$('loading-analytics').style.display='none'; addLog(`❌ Erro Analytics: ${e.message}`,"error");} }
function aplicarFiltros(){ $('loading-analytics').style.display='none'; const mS=$('filtro-mes').value, aS=$('filtro-ano').value, tS=$('filtro-time').value.toLowerCase(), dI=$('data-inicio').value, dF=$('data-fim').value; const filtrados=dadosTotaisAcessos.filter(i=>{ if(!i.data||!i.time)return false; if(tS!=="todos"){let tr=i.time.toLowerCase(); if(tS==="são paulo"&&(tr==="sao paulo"||tr==="são paulo")){}else if(tr!==tS)return false;} const dT=new Date(i.data); if(dI===""&&dF===""){if(aS!=="todos"&&String(dT.getFullYear())!==aS)return false; if(mS!=="todos"&&String(dT.getMonth()+1).padStart(2,'0')!==mS)return false; return true;} if(dI!==""&&dF!==""){const di=new Date(dI),df=new Date(dF); df.setHours(23,59,59); return dT>=di&&dT<=df;} return true; }); processarDashboard(filtrados); $('painel-dashboard').style.display='block'; }
function processarDashboard(arr){ $('dash-total').innerText=arr.length; if(arr.length===0){ $('dash-media').innerText=`Média: 0/dia`; $('lista-ranking').innerHTML="<p style='text-align:center;color:#999;padding:20px;'>Nenhum acesso.</p>"; $('nome-campeao').innerText="-"; $('img-campeao').style.display="none"; $('dash-campeao').className="valor"; $('dash-pico').innerText=`Pico: Nenhum`; if(graficoInstancia)graficoInstancia.destroy(); return; } const cT={}, cD={}; arr.forEach(l=>{let t=String(l.time).trim(), d=l.data; if(t)cT[t]=(cT[t]||0)+1; if(d)cD[d]=(cD[d]||0)+1; }); const td=Object.keys(cD).length; $('dash-media').innerText=`Média: ${td>0?(arr.length/td).toFixed(1):0} acessos/dia`; let mD="", mAd=0; for(const d in cD){if(cD[d]>mAd){mAd=cD[d];mD=d;}} let dL=""; if(mD){const a=mD.split('-'); if(a.length===3)dL=`${a[2]}/${a[1]}`;} $('dash-pico').innerText=`Pico: ${mAd} toques (${dL})`; const aR=Object.keys(cT).map(t=>({nome:t,acessos:cT[t]})).sort((a,b)=>b.acessos-a.acessos); const c=aR[0], iC=TIMES_INFO[c.nome.toLowerCase()]||{cor:"var(--brand-dark)",logo:""}; $('nome-campeao').innerText=c.nome; const img=$('img-campeao'); if(iC.logo){img.src=iC.logo;img.style.display="block";}else img.style.display="none"; $('dash-campeao').className="valor "+(iC.classText||""); let hR="", lg=[], dg=[], cg=[]; const maxA=aR[0].acessos; aR.forEach((i)=>{lg.push(i.nome);dg.push(i.acessos);let iT=TIMES_INFO[i.nome.toLowerCase()]||{cor:"var(--primary)",logo:""}; cg.push(iT.cor); let p=Math.round((i.acessos/maxA)*100); hR+=`<div class="ranking-item"><div class="ranking-nome"><img src="${iT.logo}" onerror="this.style.display='none'"><span class="${iT.classText||''}">${i.nome}</span></div><div class="progresso-bg"><div class="progresso-bar" style="width:${p}%; background-color:${iT.cor};"></div></div><div class="ranking-valor" style="color:${iT.cor};">${i.acessos}</div></div>`;}); $('lista-ranking').innerHTML=hR; renderizarGrafico(lg,dg,cg); }
function renderizarGrafico(l,d,c){ const ctx=$('graficoAcessos').getContext('2d'); if(graficoInstancia)graficoInstancia.destroy(); graficoInstancia=new Chart(ctx,{type:'bar',data:{labels:l,datasets:[{data:d,backgroundColor:c,borderRadius:8,borderWidth:0,barPercentage:0.6}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'#4E342E',titleFont:{size:14,family:'Inter'},bodyFont:{size:16,weight:'bold',family:'Inter'},padding:12,displayColors:false,callbacks:{label:ctx=>ctx.parsed.y+' toques'}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,precision:0}},x:{grid:{display:false}}},animation:{duration:800,easing:'easeOutQuart'}}}); }

// ADMIN: ANÚNCIOS
function ativarNotificacoesBrowser(){ if("Notification" in window){Notification.requestPermission().then(p=>{if(p==="granted"){$('btn-notifica').style.display="none";try{new Notification("Mini Mundo",{body:"Alertas ativados!",icon:"logo.png"});}catch(e){}}});} }
function dispararAlertaSeHouverNovos(nA){ let pA=nA.filter(a=>a.status==="PENDENTE").length; if(quantidadeAnunciosPendentes===-1){quantidadeAnunciosPendentes=pA;return;} if(pA>quantidadeAnunciosPendentes){let eN=nA[nA.length-1].empresa; addLog(`🔔 ALERTA: Solicitação de ${eN}`,"warn"); try{if("Notification" in window&&Notification.permission==="granted"){new Notification("🚀 Novo Anunciante!",{body:`Empresa ${eN} solicitou anúncio.`,icon:"logo.png"});}}catch(e){} try{if("vibrate" in navigator)navigator.vibrate([200,100,200]);}catch(e){}} quantidadeAnunciosPendentes=pA; }
async function carregarAnunciosAdmin(s=false){ if(!s){$('loading-anuncios').style.display='block';$('lista-anuncios-admin').innerHTML='';} try{const r=await fetch(URL_ANALYTICS_CATALOGO+"?acao=anuncios_admin");const res=await r.json(); if(res.sucesso){anunciosAdminArray=res.anuncios.slice().reverse(); dispararAlertaSeHouverNovos(res.anuncios); if(!s||$('lista-anuncios-admin').innerHTML==="")renderListaAnuncios(anunciosAdminArray);}}catch(e){if(!s)addLog(`Erro anúncios: ${e.message}`,"error");}finally{$('loading-anuncios').style.display='none';} }
function renderListaAnuncios(aA){ const lE=$('lista-anuncios-admin'); if(aA.length===0){lE.innerHTML="<p style='text-align:center;color:#999;padding:20px;'>Nenhum anúncio.</p>";return;} let h=""; aA.forEach((a)=>{let sB=""; if(a.status==="ATIVO")sB=`<span class="tag-ativo">Ativo</span>`;else if(a.status==="CANCELADO")sB=`<span class="tag-inativo">Cancelado</span>`;else sB=`<span class="tag-pendente">Pendente</span>`; let vT=a.vencimento?`Vence em: ${a.vencimento.split('-').reverse().join('/')}`:"Sem vencimento"; h+=`<div class="list-item"><div class="list-info"><h4 class="list-nome">${a.empresa}</h4><div class="list-detalhes"><span style="color:var(--primary);font-weight:800;">${formatarPreco(a.valor_negociado)||"R$ 0,00"}</span> • ${vT} </div><div style="margin-top:8px;">${sB}</div></div><a href="${a.zap_link}" target="_blank" class="btn-zap-lista">💬</a><button class="btn-editar" onclick="abrirModalEditarAnuncio(${a.linha})">✏️</button></div>`;}); lE.innerHTML=h; }
function filtrarAnuncios(){ const t=$('busca-anuncios').value.toLowerCase(); renderListaAnuncios(anunciosAdminArray.filter(a=>a.empresa.toLowerCase().includes(t)||a.status.toLowerCase().includes(t)||(a.cupom&&a.cupom.toLowerCase().includes(t)))); }
function abrirModalEditarAnuncio(l){ const a=anunciosAdminArray.find(x=>x.linha===l); if(!a)return; $('edit-ad-linha').value=a.linha; $('edit-ad-empresa').value=a.empresa; $('edit-ad-status').value=a.status; $('edit-ad-vencimento').value=a.vencimento; $('edit-ad-valor').value=formatarPreco(a.valor_negociado); $('edit-ad-desc').value=a.descricao||""; $('edit-ad-cupom').value=a.cupom||""; $('edit-ad-foto-antiga').value=a.foto||""; $('edit-ad-logo-antiga').value=a.logo||""; $('edit-ad-logo-preview').src=a.logo||"logo.png"; $('edit-ad-banner-preview').src=a.foto||"logo.png"; $('edit-ad-logo-nova').value=""; $('edit-ad-banner-novo').value=""; $('modal-editar-anuncio').style.display='flex'; }
function confirmarExclusaoAnuncio(){ const l=parseInt($('edit-ad-linha').value); const a=anunciosAdminArray.find(x=>x.linha===l); if(!a)return; if(a.vencimento){const hj=new Date();hj.setHours(0,0,0,0);const p=a.vencimento.split('-');const vc=new Date(p[0],p[1]-1,p[2]);vc.setHours(23,59,59,999);if(vc>=hj){alert("❌ BLOQUEADO: Anúncio vigente.");return;}} if(confirm(`EXCLUIR anúncio da ${a.empresa}?`)) excluirRegistroLocal("Anuncios",l,"btn-excluir-ad",()=>$('modal-editar-anuncio').style.display='none',carregarAnunciosAdmin,URL_ANALYTICS_CATALOGO); }
async function salvarEdicaoAnuncio(){ const btn=$('btn-salvar-edicao-ad'); btn.disabled=true; btn.innerText="⏳ Salvando..."; try{ const ik=$('imgbb-key').value.trim(); let lL=$('edit-ad-logo-antiga').value, lB=$('edit-ad-foto-antiga').value; const iL=$('edit-ad-logo-nova'); if(iL.files.length>0){addLog("Enviando logo...","info"); lL=await fazerUploadInteligente(await comprimirImagem(iL.files[0],400,400,0.8),ik,true);} const iB=$('edit-ad-banner-novo'); if(iB.files.length>0){addLog("Enviando banner...","info"); lB=await fazerUploadInteligente(await comprimirImagem(iB.files[0],800,800,0.8),ik,true);} const p={acao:"atualizar_anuncio",linha:$('edit-ad-linha').value,status:$('edit-ad-status').value,vencimento:$('edit-ad-vencimento').value,valor_negociado:$('edit-ad-valor').value,descricao:$('edit-ad-desc').value,cupom:$('edit-ad-cupom').value,logo:lL,foto:lB}; const r=await fetch(URL_ANALYTICS_CATALOGO,{method:"POST",body:JSON.stringify(p)}); const res=await r.json(); if(res.sucesso){addLog(`✅ Anúncio OK!`,"success");$('modal-editar-anuncio').style.display='none';carregarAnunciosAdmin();}else throw new Error("Erro planilha."); }catch(e){alert("Erro: "+e.message);addLog(`❌ Erro: ${e.message}`,"error");}finally{btn.disabled=false;btn.innerText="💾 Salvar";} }

// ADMIN: CATÁLOGO LOJA E IA
async function carregarCatalogoAdmin(){ $('loading-catalogo').style.display='block'; $('lista-produtos-admin').innerHTML=''; try{ const r=await fetch(URL_ANALYTICS_CATALOGO+"?acao=catalogo_admin"); const res=await r.json(); if(res.sucesso){catalogoAdminArray=res.produtos.slice().reverse();renderListaCatalogo(catalogoAdminArray);} }catch(e){addLog(`Erro catálogo: ${e.message}`,"error");}finally{$('loading-catalogo').style.display='none';} }
function renderListaCatalogo(aP){ const lE=$('lista-produtos-admin'); if(aP.length===0){lE.innerHTML="<p style='text-align:center;color:#999;padding:20px;'>Nenhum produto.</p>";return;} let h=""; aP.forEach(p=>{const fP=p.foto.split(',')[0].trim()||'logo.png',sB=p.ativo?`<span class="tag-ativo">Ativo</span>`:`<span class="tag-inativo">Inativo</span>`; h+=`<div class="list-item"><img src="${fP}" class="list-img" onerror="this.src='logo.png'"><div class="list-info"><h4 class="list-nome">${p.nome}</h4><div class="list-detalhes"><span style="color:var(--primary);font-weight:800;">${formatarPreco(p.preco)}</span> • ${p.categoria} </div><div style="margin-top:8px;">${sB}</div></div><button class="btn-editar" onclick="abrirModalEditarProduto(${p.linha})">✏️</button></div>`;}); lE.innerHTML=h; }
function filtrarCatalogo(){ const t=$('busca-catalogo').value.toLowerCase(); renderListaCatalogo(catalogoAdminArray.filter(p=>p.nome.toLowerCase().includes(t)||p.categoria.toLowerCase().includes(t)||String(p.preco).toLowerCase().includes(t))); }
function abrirModalEditarProduto(l){ const p=catalogoAdminArray.find(x=>x.linha===l); if(!p)return; $('edit-prod-linha').value=p.linha; $('edit-prod-nome').value=p.nome; $('edit-prod-preco').value=formatarPreco(p.preco); $('edit-prod-categoria').value=p.categoria; $('edit-prod-desc').value=p.descricao; $('edit-prod-status').value=p.ativo?"true":"false"; $('edit-prod-foto-antiga').value=p.foto||""; $('edit-prod-img-preview').src=(p.foto&&p.foto.split(',')[0])?p.foto.split(',')[0]:"logo.png"; $('edit-prod-fotos-novas').value=""; $('modal-editar-produto').style.display='flex'; }
function confirmarExclusaoProduto(){ const l=parseInt($('edit-prod-linha').value); const p=catalogoAdminArray.find(x=>x.linha===l); if(!p)return; if(confirm(`EXCLUIR produto "${p.nome}"?`)) excluirRegistroLocal("Catalogo",l,"btn-excluir-prod",()=>$('modal-editar-produto').style.display='none',carregarCatalogoAdmin,URL_ANALYTICS_CATALOGO); }
async function salvarEdicaoProduto(){ const b=$('btn-salvar-edicao-prod'); b.disabled=true; b.innerText="⏳ Salvando..."; try{ const ik=$('imgbb-key').value.trim(); let lF=$('edit-prod-foto-antiga').value; const iF=$('edit-prod-fotos-novas'); if(iF.files.length>0){let nL=[]; for(let i=0;i<iF.files.length;i++){addLog(`Enviando foto ${i+1}...`,"info"); nL.push(await fazerUploadInteligente(await comprimirImagem(iF.files[i],1000,1000,0.8),ik,false));} lF=nL.join(",");} const p={acao:"atualizar_produto",linha:$('edit-prod-linha').value,nome:$('edit-prod-nome').value,preco:$('edit-prod-preco').value,categoria:$('edit-prod-categoria').value,descricao:$('edit-prod-desc').value,ativo:$('edit-prod-status').value==="true",foto:lF}; const r=await fetch(URL_ANALYTICS_CATALOGO,{method:"POST",body:JSON.stringify(p)}); const res=await r.json(); if(res.sucesso){addLog(`✅ Produto OK!`,"success");$('modal-editar-produto').style.display='none';carregarCatalogoAdmin();$('busca-catalogo').value="";}else throw new Error("Erro db."); }catch(e){alert("Erro: "+e.message);addLog(`❌ Erro produto: ${e.message}`,"error");}finally{b.disabled=false;b.innerText="💾 Salvar";} }

const fileToBase64=f=>new Promise((r,j)=>{const rd=new FileReader();rd.readAsDataURL(f);rd.onload=()=>r(rd.result.split(',')[1]);rd.onerror=e=>j(e);});
function comprimirImagem(f,mW,mH,q){ return new Promise((r,j)=>{ if(!f.type.match(/image.*/))return j(new Error(`Formato inválido.`)); const rd=new FileReader();rd.readAsDataURL(f); rd.onload=e=>{ const i=new Image();i.src=e.target.result; i.onload=()=>{ let w=i.width,h=i.height; if(w>h){if(w>mW){h=Math.round(h*mW/w);w=mW;}}else{if(h>mH){w=Math.round(w*mH/h);h=mH;}} const cv=document.createElement('canvas');cv.width=w;cv.height=h; const cx=cv.getContext('2d');cx.drawImage(i,0,0,w,h); const nU=Date.now()+"_"+f.name.replace(/[^a-zA-Z0-9.]/g,'_').toLowerCase(); cv.toBlob(b=>b?r(new File([b],nU,{type:'image/jpeg'})):j(new Error("Compressão.")),'image/jpeg',q); };};}); }
async function fazerUploadInteligente(fC,ik,iA=false){ try{ const fd=new FormData();fd.append("imagem",fC); const ep=iA?API_ONIONSYS_ADS:API_ONIONSYS; const rp=await fetch(ep,{method:"POST",headers:{"Authorization":`Bearer ${TOKEN_ONIONSYS}`,"x-tenant-id":"MiniMundo"},body:fd}); const tx=await rp.text(); if(rp.ok){try{const rs=JSON.parse(tx); let u=(rs.arquivos&&rs.arquivos.length>0)?rs.arquivos[0].url:(rs.url||rs.link||rs.URL||(rs.filename?`https://api.onionsys.com.br/arquivos/${iA?'anuncios':'catalogo'}/${rs.filename}`:null)); if(u)return u; else throw new Error("URL em branco.");}catch(e){throw new Error("Formato inválido.");}}else throw new Error(`Servidor rejeitou (${rp.status})`); }catch(er){ addLog(`⚠️ Servidor primário falhou. Tentando ImgBB...`,"warn"); if(!ik){addLog(`❌ Falta chave ImgBB!`,"error");throw new Error("Chave ImgBB.");} try{const fd2=new FormData();fd2.append("image",fC); const r2=await fetch(`https://api.imgbb.com/1/upload?key=${ik}`,{method:"POST",body:fd2}); const d2=await r2.json(); if(d2.success)return d2.data.url; throw new Error(`ImgBB recusou.`);}catch(e){addLog(`❌ Falha dupla upload.`,"error");throw e;} } }

async function cadastrarProdutoIA(){ const ak=$('api-key').value.trim(), ik=$('imgbb-key').value.trim(), n=$('prod-nome').value.trim(), p=$('prod-preco').value.trim(), f=$('prod-fotos').files, b=$('btn-salvar-produto'); if(!ak){switchTab('config');return addLog("❌ ERRO: Coloque a chave da IA (Gemini)!","error");} if(!n||!p||f.length===0)return addLog("⚠️ Preencha Nome, Preço e escolha Foto.","warn"); b.disabled=true; b.innerText="⏳ Analisando..."; try{ addLog(`Cadastrando: ${n}...`,"warn"); const b6=await fileToBase64(f[0]); let ls=[]; for(let i=0;i<f.length;i++){addLog(`⏳ Foto ${i+1}...`,"info"); const urlF=await fazerUploadInteligente(await comprimirImagem(f[i],1000,1000,0.8),ik,false); ls.push(urlF); addLog(`✅ Foto ${i+1} online.`,"success");} addLog(`🤖 IA criando copy...`,"info"); const pr=`Atue como Copywriter Sênior da 'Mini Mundo 3D', marca de impressão 3D.\nTítulo: ${n}\nPreço: ${p}\nResponda EXATAMENTE neste formato (sem asteriscos ou negrito):\nDescricao: [Sua copy em até 3 frases vendendo o produto]\nCategoria: [1 ou 2 palavras definindo a categoria]`; const rI=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${ak}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:pr},{inlineData:{mimeType:f[0].type,data:b6}}]}]})}); if(!rI.ok)throw new Error("IA não respondeu."); const dI=await rI.json(); const resIA=dI.candidates[0].content.parts[0].text; let ds="Exclusivo Mini Mundo 3D.", ct="Geral"; let mD=resIA.match(/descri[cç][aã]o:\s*(.*)/i); if(mD)ds=mD[1].replace(/\*/g,'').trim(); let mC=resIA.match(/categoria:\s*(.*)/i); if(mC)ct=mC[1].replace(/\*/g,'').trim(); addLog(`💾 Salvando na Planilha...`,"info"); const rS=await fetch(URL_ANALYTICS_CATALOGO,{method:"POST",body:JSON.stringify({acao:"salvar_produto",nome:n,descricao:ds,preco:p,foto:ls.join(","),categoria:ct})}); const resS=await rS.json(); if(resS.sucesso){addLog(`🎉 PRODUTO CADASTRADO!`,"success");$('prod-nome').value="";$('prod-preco').value="";$('prod-fotos').value="";carregarCatalogoAdmin();}else throw new Error("API falhou."); }catch(e){addLog(`❌ ERRO: ${e.message}`,"error");}finally{b.disabled=false;b.innerText="✨ Enviar e Cadastrar";} }

// ADMIN: QUIZ E CHAVES
function salvarChaves(){ localStorage.setItem("gemini_api_key",$('api-key').value); localStorage.setItem("imgbb_api_key",$('imgbb-key').value); }
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function atualizarBadgeUltimo(){ const uT=localStorage.getItem("ultimo_time_gerado"), uH=localStorage.getItem("ultimo_horario_gerado"); if(uT&&uH)$('badge-ultimo').innerHTML=`🕒 Último: <b>${uT}</b> (${uH})`; }
async function carregarInfoBanco(){ const s=$('time'), bT=$('badge-total'); bT.innerHTML=`⏳ Contando...`; try{const r=await fetch(s.value);const d=await r.json();bT.innerHTML=`📊 Total: <b>${(d.quiz&&Array.isArray(d.quiz))?d.quiz.length:0} perguntas</b>`;}catch(e){bT.innerHTML=`⚠️ Erro.`;} }
async function processarTimeUnico(tN,tU,q,aK,t,d,mR){ addLog(`>> GERANDO: ${tN.toUpperCase()}`,"warn"); const pr=`Gere ${q} perguntas sobre história do ${tN} (Dificuldade: ${d}). ${t?`Tema OBRIGATÓRIO: "${t}".`:`Varie temas.`}\nREGRAS: Fatos históricos, max 15 palavras/perg, max 4 palavras/opc.\nFormato ESTRITO:\nPergunta: [Texto]\nA) [Opc 1]\nB) [Opc 2]\nC) [Opc 3]\nD) [Opc 4]\nCorreta: [1 a 4]\nAPENAS o texto puro.`; let tx=null; for(let i=1;i<=3;i++){const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${aK}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:pr}]}]})}); if(r.ok){const ds=await r.json();tx=ds.candidates[0].content.parts[0].text;addLog(`IA respondeu!`,"success");break;} if(r.status===429&&i<3){addLog(`⚠️ Limite IA. Tentando em 5s...`,"warn");await delay(5000);continue;} throw new Error(`IA recusou (${r.status}).`);} const pg=[]; tx.split(/(?:Pergunta|Q):/i).filter(b=>b.trim().length>0).forEach(b=>{const l=b.trim().split('\n').map(x=>x.trim()).filter(x=>x!==''); if(l.length>=5){let c=1,lC=l.find(x=>/Correta/i.test(x));if(lC){let m=lC.match(/\d+/);if(m)c=parseInt(m[0]);} pg.push({pergunta:l[0],opcoes:[l[1].replace(/^[A-D1-4][\)\.-]?\s*/i,''),l[2].replace(/^[A-D1-4][\)\.-]?\s*/i,''),l[3].replace(/^[A-D1-4][\)\.-]?\s*/i,''),l[4].replace(/^[A-D1-4][\)\.-]?\s*/i,'')],correta:c});} }); if(pg.length===0)throw new Error("IA gerou texto inválido."); addLog(`Geradas ${pg.length} perguntas.`,"info"); if(mR)addLog(`⚠️ Reciclagem!`,"error"); const rP=await fetch(tU,{method:"POST",body:JSON.stringify({acao:"salvar_quiz",perguntas:pg,substituir:mR})}); const rS=await rP.json(); if(rS.sucesso){addLog(`✅ SUCESSO!`,"success");localStorage.setItem("ultimo_time_gerado",tN);localStorage.setItem("ultimo_horario_gerado",new Date().toLocaleString('pt-BR'));}else throw new Error(rS.erro); }
async function iniciarAutomacao(mG){ const aK=$('api-key').value.trim(); if(!aK){switchTab('config');return addLog("ERRO: Chave Gemini!","error");} const q=$('qtd').value,t=$('tema').value.trim(),d=$('dificuldade').value,mR=$('substituir').checked,bU=$('btn-iniciar'),bG=$('btn-global'); bU.disabled=true;bG.disabled=true; try{ if(mG){addLog(`--- LOTE GLOBAL ---`,"warn"); const o=Array.from($('time').options); for(let i=0;i<o.length;i++){try{await processarTimeUnico(o[i].getAttribute("data-nome"),o[i].value,q,aK,t,d,mR);}catch(e){addLog(`❌ ERRO ${o[i].getAttribute("data-nome")}: ${e.message}`,"error");} if(i<o.length-1){addLog("Aguardando 5s...","info");await delay(5000);}} addLog(`--- FINALIZADO ---`,"success");}else{const s=$('time');await processarTimeUnico(s.options[s.selectedIndex].getAttribute("data-nome"),s.value,q,aK,t,d,mR);} atualizarBadgeUltimo();carregarInfoBanco(); }catch(er){addLog(`FALHA: ${er.message}`,"error");}finally{bU.disabled=false;bG.disabled=false;} }

// ERP: CALCULADORA E MODELOS
function toggleConfig(){ const a=$('area-config'); a.style.display=a.style.display==="block"?"none":"block"; }
function calcular(){ const vW=parseFloat($('v-watts').value)||0, vK=parseFloat($('v-kwh').value)||0, vM=parseFloat($('v-maq').value)||0, vH=parseFloat($('v-hora').value)||0, f=parseFloat($('v-filamento').value)||0, p=parseFloat($('v-peso').value)||0, tI=parseFloat($('v-tempo-imp').value)||0, tM=parseFloat($('v-tempo-mao').value)||0, ins=parseFloat($('v-insumos').value)||0; const cMat=(f/1000)*p, cEne=(vW/1000)*tI*vK, cDep=tI*vM, cHum=tM*vH, cFa=(cMat+cEne+cDep+cHum)*0.10, cTot=cMat+cEne+cDep+cHum+cFa+ins; custoTotalGlobal=cTot; $('r-material').innerText=fmt(cMat); $('r-energia').innerText=fmt(cEne); $('r-deprec').innerText=fmt(cDep); $('r-humano').innerText=fmt(cHum); $('r-falha').innerText=fmt(cFa); $('r-insumos').innerText=fmt(ins); $('r-total').innerText=fmt(cTot); const psMi=(cTot*2)+cHum, psMa=(cTot*3)+cHum, pdMi=(cTot*4)+cHum, pdMa=(cTot*6)+cHum; $('m-simples-preco').innerText=`${fmt(psMi)} ou ${fmt(psMa)}`; $('m-simples-lucro').innerText=`Lucro: ${fmt(psMi-cTot)} a ${fmt(psMa-cTot)}`; $('m-decor-preco').innerText=`${fmt(pdMi)} ou ${fmt(pdMa)}`; $('m-decor-lucro').innerText=`Lucro: ${fmt(pdMi-cTot)} a ${fmt(pdMa-cTot)}`; }
async function salvarBancoModelos(){ const m=$('v-modelo').value.trim(); if(!m)return mostrarAlerta("Atenção","Digite o Nome do Modelo.","warning"); const btn=$('btn-salvar-custo'); btn.disabled=true; btn.innerText="⏳ Salvando..."; try{ const p={acao:"salvar_custo",modelo:m,peso:$('v-peso').value,tempo:$('v-tempo-imp').value,insumos:fmtPlanilha(parseFloat($('v-insumos').value)||0),custo_total:fmtPlanilha(custoTotalGlobal)}; const r=await fetch(API_PRECIFICACAO,{method:"POST",body:JSON.stringify(p)}); const res=await r.json(); if(res.sucesso){mostrarAlerta("Sucesso!","Produto salvo!","success");$('v-modelo').value="";}else if(res.erro==="DUPLICADO"){mostrarAlerta("Duplicado","Já existe no banco.","warning");}else throw new Error(res.erro); }catch(e){mostrarAlerta("Erro",e.message,"error");}finally{btn.disabled=false;btn.innerText="💾 Salvar Modelo no Banco";} }
async function carregarBancoDeCustos(){ $('loading-banco').style.display="block"; $('lista-banco').innerHTML=""; try{ const r=await fetch(API_PRECIFICACAO+"?acao=listar_custos"); const res=await r.json(); if(res.sucesso){arrayBancoCustos=res.produtos;renderizarListaBanco(arrayBancoCustos);}else throw new Error(res.erro); }catch(e){$('loading-banco').innerHTML="❌ Erro na Planilha.";}finally{$('loading-banco').style.display="none";} }
function renderizarListaBanco(aP){ const lD=$('lista-banco'); lD.innerHTML=""; if(aP.length===0){lD.innerHTML="<p style='text-align:center;color:#999;padding:20px;font-weight:600;'>Nenhum modelo.</p>";return;} let h=""; aP.forEach(p=>{h+=`<div class="produto-banco-card"><div class="pb-info"><h4 class="pb-nome">${p.modelo}</h4><div class="pb-detalhes"><span class="pb-tag">⚖️ ${p.peso||"0"}g</span><span class="pb-tag">⏱️ ${p.tempo||"0"}h</span><span class="pb-tag">📦 ${formatarDoBanco(p.insumos)}</span></div></div><div class="pb-custo">${formatarDoBanco(p.custo_total)}</div></div>`;}); lD.innerHTML=h; }
function filtrarBanco(){ const t=$('busca-banco').value.toLowerCase(); renderizarListaBanco(arrayBancoCustos.filter(p=>p.modelo.toLowerCase().includes(t))); }

// ERP: DESPESAS
function calcularDespesaTotal(){ const q=parseFloat($('d-qtd').value.replace(',','.'))||1, vU=limparValorPlanilha($('d-valor-uni').value); despesaTotalCalculada=q*vU; $('d-total-calc').innerText=fmt(despesaTotalCalculada); }
async function carregarDespesas(){ $('loading-despesas').style.display="block"; $('lista-despesas').innerHTML=""; try{ const r=await fetch(API_PRECIFICACAO+"?acao=listar_despesas"); const res=await r.json(); if(res.sucesso){arrayDespesas=res.despesas;alimentarDatalistE_Filtro(arrayDespesas);filtrarDespesas();}else throw new Error(res.erro); }catch(e){$('loading-despesas').innerHTML="❌ Erro.";}finally{$('loading-despesas').style.display="none";} }
function alimentarDatalistE_Filtro(aD){ const dI=$('lista-itens-sugestao'), dL=$('lista-locais-sugestao'), fL=$('filtro-d-local'); const iU=[...new Set(aD.map(d=>d.item.trim()))].filter(i=>i), lU=[...new Set(aD.map(d=>d.local.trim()))].filter(i=>i); dI.innerHTML=iU.map(n=>`<option value="${n}">`).join(''); dL.innerHTML=lU.map(n=>`<option value="${n}">`).join(''); fL.innerHTML='<option value="todos">Todos os Locais</option>'+lU.map(n=>`<option value="${n}">${n}</option>`).join(''); }
function limparFiltrosDespesas(){ $('filtro-d-mes').value="todos"; $('filtro-d-ano').value="todos"; $('filtro-d-local').value="todos"; $('busca-despesa').value=""; filtrarDespesas(); }
function filtrarDespesas(){ const mS=$('filtro-d-mes').value, aS=$('filtro-d-ano').value, lS=$('filtro-d-local').value.toLowerCase(), tB=$('busca-despesa').value.toLowerCase(); const flt=arrayDespesas.filter(d=>{ if(tB&&!d.item.toLowerCase().includes(tB))return false; if(lS!=="todos"&&d.local.toLowerCase()!==lS)return false; if(mS!=="todos"||aS!=="todos"){let pt=[]; if(d.data.includes('/'))pt=d.data.split('/'); else if(d.data.includes('-')){let p=d.data.split('-');pt=[p[2],p[1],p[0]];} else if(d.data.includes(' ')){let td=new Date(d.data);if(!isNaN(td))pt=[td.getDate(),String(td.getMonth()+1).padStart(2,'0'),td.getFullYear()];} if(pt.length>=3){let m=String(pt[1]).padStart(2,'0'), a=String(pt[2]).substring(0,4); if(mS!=="todos"&&m!==mS)return false; if(aS!=="todos"&&a!==aS)return false;}else return false;} return true; }); renderizarListaDespesas(flt); }
function renderizarListaDespesas(aD){ const lD=$('lista-despesas'); lD.innerHTML=""; let sT=0; if(aD.length===0){lD.innerHTML="<p style='text-align:center;color:#999;padding:20px;font-weight:600;'>Nenhuma despesa.</p>";$('total-despesas-valor').innerText="R$ 0,00";return;} let h=""; aD.forEach(d=>{let nG=limparValorPlanilha(d.valor); sT+=nG; let dH=`<div class="pb-detalhes" style="flex-direction:column;gap:8px;align-items:flex-start;margin-top:5px;"><div style="display:flex;gap:10px;flex-wrap:wrap;"><span style="color:#64748b;">📅 ${d.data}</span><span style="color:#64748b;">🏢 ${d.local}</span></div>`; if(d.quantidade&&d.preco_uni&&d.preco_uni!=="R$ 0,00"){dH+=`<div style="display:flex;gap:10px;flex-wrap:wrap;"><span style="color:#64748b;">📦 Qtd: ${d.quantidade}</span><span style="color:#64748b;">💲 ${formatarDoBanco(d.preco_uni)} /un</span></div>`;} dH+=`</div>`; h+=`<div class="produto-banco-card"><div class="pb-info"><h4 class="pb-nome" style="color:#334155;">${d.item}</h4>${dH}</div><div class="pb-custo" style="background:transparent;border:none;color:#ef4444;font-size:1.1rem;padding-right:0;">- ${fmt(nG)}</div></div>`;}); lD.innerHTML=h; $('total-despesas-valor').innerText=fmt(sT); }
async function salvarDespesa(){ const dC=$('d-data').value, lC=$('d-local').value.trim(), iC=$('d-item').value.trim(), qC=$('d-qtd').value, vU=$('d-valor-uni').value; if(!dC||!iC||!vU||!lC)return mostrarAlerta("Atenção","Preencha tudo.","warning"); const btn=$('btn-salvar-despesa'); btn.disabled=true; btn.innerText="⏳ Lançando..."; try{ const p={acao:"salvar_despesa",item:iC,local:lC,data:dC.split('-').reverse().join('/'),quantidade:qC,preco_uni:fmtPlanilha(limparValorPlanilha(vU)),preco_total:fmtPlanilha(despesaTotalCalculada)}; const r=await fetch(API_PRECIFICACAO,{method:"POST",body:JSON.stringify(p)}); const res=await r.json(); if(res.sucesso){mostrarAlerta("Lançado!","Registrado.","success");$('d-item').value="";$('d-valor-uni').value="";$('d-qtd').value="1";calcularDespesaTotal();carregarDespesas();}else throw new Error(res.erro); }catch(e){mostrarAlerta("Erro",e.message,"error");}finally{btn.disabled=false;btn.innerText="💳 Lançar Despesa";} }

// ERP: VENDAS E ZAP (LOTE)
// Novas funções para o WhatsApp baseadas no histórico do Novera Scent
function formatarTextoZap(texto) { return encodeURIComponent(texto); }

function enviarZapCobranca(linha) {
    const v = arrayVendas.find(x => x.linha === linha);
    if(!v) return;
    let nome = v.cliente.split(' ')[0];
    let texto = `Olá, *${nome}*! Aqui é do *Mini Mundo 3D* 🌍🖨️.\n\nPassando para lembrar sobre o pagamento do seu pedido:\n\n🏷️ *Item:* ${v.produto} (x${v.qtd})\n💰 *Valor:* ${fmt(limparValorPlanilha(v.valor_venda))}\n📅 *Data:* ${v.data}\n\nAssim que puder, nos envie o comprovante para darmos andamento à produção! Qualquer dúvida, estamos à disposição. 🚀`;
    window.open(`https://api.whatsapp.com/send?text=${formatarTextoZap(texto)}`, '_blank');
}

function enviarZapRecibo(linha) {
    const v = arrayVendas.find(x => x.linha === linha);
    if(!v) return;
    let nome = v.cliente.split(' ')[0];
    let texto = `Olá, *${nome}*! Aqui é do *Mini Mundo 3D* 🌍🖨️.\n\nPassando para confirmar o recebimento do seu pedido!\n\n✅ *Status:* PAGO\n🏷️ *Item:* ${v.produto} (x${v.qtd})\n💰 *Valor Pago:* ${fmt(limparValorPlanilha(v.valor_venda))}\n📅 *Data:* ${v.data}\n\nMuito obrigado pela confiança! Seu pedido está sendo preparado com muito carinho nas nossas impressoras. 🖨️✨`;
    window.open(`https://api.whatsapp.com/send?text=${formatarTextoZap(texto)}`, '_blank');
}

function abrirModalAcoesLote() {
    $('modal-acoes-lote').style.display = 'flex';
    carregarLote('Pendente'); 
}

function carregarLote(tipo) {
    $('btn-lote-pendentes').classList.remove('active');
    $('btn-lote-pagos').classList.remove('active');
    $('btn-lote-' + (tipo === 'Pendente' ? 'pendentes' : 'pagos')).classList.add('active');

    const lista = $('lista-acoes-lote');
    const filtrados = vendasFiltradasAtuais.filter(v => v.status.toLowerCase() === tipo.toLowerCase());

    if(filtrados.length === 0) {
        lista.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px; font-weight:700;">Nenhuma venda ${tipo.toLowerCase()} no filtro atual.</p>`;
        return;
    }

    let h = "";
    filtrados.forEach(v => {
        let btnTexto = tipo === 'Pendente' ? '🔔 Cobrar' : '🧾 Recibo';
        let corBtn = tipo === 'Pendente' ? 'background:#fffbeb; color:#b45309; border-color:#fde68a;' : 'background:#dcfce7; color:#166534; border-color:#a7f3d0;';
        let onClickFn = tipo === 'Pendente' ? `enviarZapCobranca(${v.linha})` : `enviarZapRecibo(${v.linha})`;

        h += `
        <div class="list-item" style="padding:12px; margin-bottom:8px;">
            <div class="list-info">
                <h4 class="list-nome" style="font-size:0.9rem; margin-bottom:4px;">${v.cliente}</h4>
                <div class="list-detalhes" style="font-size:0.75rem;">
                    ${v.produto} (x${v.qtd}) <br> <b style="color:var(--primary);">${fmt(limparValorPlanilha(v.valor_venda))}</b>
                </div>
            </div>
            <button class="btn-editar" style="${corBtn} flex-shrink:0; font-weight:900; font-size:0.75rem; padding: 10px 14px; transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'" onclick="${onClickFn}">${btnTexto}</button>
        </div>`;
    });
    lista.innerHTML = h;
}

// Funções padrão de venda
async function carregarOpcoesVenda(){ $('loading-opcoes-venda').style.display="block"; try{ const r=await fetch(API_PRECIFICACAO+"?acao=listar_opcoes_venda"); const res=await r.json(); if(res.sucesso){ $('lista-clientes-venda').innerHTML=res.clientes.map(n=>`<option value="${n}">`).join(''); $('lista-clientes-busca').innerHTML=res.clientes.map(n=>`<option value="${n}">`).join(''); $('lista-produtos-venda').innerHTML=res.produtos.map(n=>`<option value="${n}">`).join(''); $('lista-plataformas-venda').innerHTML=res.plataformas.map(n=>`<option value="${n}">`).join('');} }catch(e){}finally{$('loading-opcoes-venda').style.display="none";} }
async function salvarVenda(){ const dV=$('venda-data').value, c=$('venda-cliente').value.trim(), p=$('venda-produto').value.trim(), pl=$('venda-plataforma').value.trim(), q=$('venda-qtd').value, vS=$('venda-valor').value, s=$('venda-status').value; if(!dV||!c||!p||!pl||!vS)return mostrarAlerta("Atenção","Preencha tudo.","warning"); const btn=$('btn-salvar-venda'); btn.disabled=true; btn.innerText="⏳ Lançando..."; try{ const py={acao:"salvar_venda",data_venda:dV.split('-').reverse().join('/'),cliente:c,produto:p,plataforma:pl,qtd:q,valor_venda:fmtPlanilha(limparValorPlanilha(vS)),status:s}; const r=await fetch(API_PRECIFICACAO,{method:"POST",body:JSON.stringify(py)}); const res=await r.json(); if(res.sucesso){mostrarAlerta("Venda Feita! 🎉","Registrado!","success");$('venda-cliente').value="";$('venda-produto').value="";$('venda-plataforma').value="";$('venda-qtd').value="1";$('venda-valor').value="";$('venda-status').value="Pago";carregarVendas();}else throw new Error(res.erro); }catch(e){mostrarAlerta("Erro",e.message,"error");}finally{btn.disabled=false;btn.innerText="✅ Lançar Venda";} }
async function salvarEdicaoVenda(){ const l=$('edit-venda-linha').value, dV=$('edit-venda-data').value, s=$('edit-venda-status').value, c=$('edit-venda-cliente').value.trim(), p=$('edit-venda-produto').value.trim(), pl=$('edit-venda-plataforma').value.trim(), q=$('edit-venda-qtd').value, vS=$('edit-venda-valor').value; if(!dV||!c||!p||!pl||!vS)return mostrarAlerta("Atenção","Preencha tudo.","warning"); const btn=$('btn-salvar-edicao-venda'); btn.disabled=true; btn.innerText="⏳ Salvando..."; try{ const py={acao:"atualizar_venda",linha:l,data_venda:dV.split('-').reverse().join('/'),cliente:c,produto:p,plataforma:pl,qtd:q,valor_venda:fmtPlanilha(limparValorPlanilha(vS)),status:s}; const r=await fetch(API_PRECIFICACAO,{method:"POST",body:JSON.stringify(py)}); const res=await r.json(); if(res.sucesso){fecharEditarVenda();mostrarAlerta("Atualizado!","Editada.","success");carregarVendas();}else throw new Error(res.erro); }catch(e){mostrarAlerta("Erro",e.message,"error");}finally{btn.disabled=false;btn.innerText="💾 Salvar Alterações";} }
async function carregarVendas(){ $('loading-vendas').style.display="block"; $('lista-vendas').innerHTML=""; try{ const r=await fetch(API_PRECIFICACAO+"?acao=listar_vendas"); const res=await r.json(); if(res.sucesso){arrayVendas=res.vendas;filtrarVendas();}else throw new Error(res.erro); }catch(e){$('loading-vendas').innerHTML="❌ Erro Vendas.";}finally{$('loading-vendas').style.display="none";} }
function limparFiltrosVendas(){ $('filtro-v-mes').value="todos"; $('filtro-v-ano').value="todos"; $('filtro-v-status').value="todos"; $('busca-venda').value=""; filtrarVendas(); }

function gerarRelatorioCliente() {
    const busca = $('busca-venda').value.trim().toLowerCase();
    if(!busca) return mostrarAlerta("Atenção", "Para gerar o extrato, digite o nome do cliente na barra de busca primeiro!", "warning");
    
    const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const tB = norm(busca);
    const mS = $('filtro-v-mes').value, aS = $('filtro-v-ano').value, stS = $('filtro-v-status').value.toLowerCase();
    
    const filtrados = arrayVendas.filter(v => {
        if (!norm(v.cliente).includes(tB)) return false;
        if (stS !== "todos" && v.status.toLowerCase() !== stS) return false;
        if (mS !== "todos" || aS !== "todos") {
            let pt = v.data.includes('/') ? v.data.split('/') : (v.data.includes('-') ? v.data.split('-').reverse() : []);
            if (pt.length >= 3) {
                let m = String(pt[1]).padStart(2,'0'), a = String(pt[2]).substring(0,4);
                if (mS !== "todos" && m !== mS) return false;
                if (aS !== "todos" && a !== aS) return false;
            } else return false;
        } return true;
    });

    if(filtrados.length === 0) return mostrarAlerta("Ops", "Nenhuma venda encontrada para este cliente nos filtros atuais.", "warning");

    let total = 0;
    let texto = `*🧾 EXTRATO DE PEDIDOS | MINI MUNDO 3D*\n*Cliente:* ${filtrados[0].cliente}\n\n`;
    filtrados.forEach(v => {
        let val = limparValorPlanilha(v.valor_venda); total += val;
        let icone = v.status.toLowerCase() === 'pago' ? '🟢' : '🟡';
        texto += `📅 *${v.data}* - ${v.produto} (x${v.qtd})\n💰 Valor: ${fmt(val)} | Status: ${icone} ${v.status}\n\n`;
    });
    texto += `*TOTAL DA FATURA: ${fmt(total)}*`;

    navigator.clipboard.writeText(texto).then(() => {
        mostrarAlerta("Copiado!", "O relatório do cliente foi copiado. É só colar no WhatsApp!", "success");
    }).catch(() => { alert("Erro ao copiar. Segue o texto:\n\n" + texto); });
}

function filtrarVendas(){ 
    const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const mS=$('filtro-v-mes').value, aS=$('filtro-v-ano').value, stS=$('filtro-v-status').value.toLowerCase(), tB=norm($('busca-venda').value); 
    const flt=arrayVendas.filter(v=>{ 
        if(tB&&!(norm(v.cliente).includes(tB)||norm(v.produto).includes(tB)))return false; 
        if(stS!=="todos"&&v.status.toLowerCase()!==stS)return false; 
        if(mS!=="todos"||aS!=="todos"){
            let pt=[]; if(v.data.includes('/'))pt=v.data.split('/'); else if(v.data.includes('-')){let p=v.data.split('-');pt=[p[2],p[1],p[0]];} else if(v.data.includes(' ')){let td=new Date(v.data);if(!isNaN(td))pt=[td.getDate(),String(td.getMonth()+1).padStart(2,'0'),td.getFullYear()];} 
            if(pt.length>=3){let m=String(pt[1]).padStart(2,'0'), a=String(pt[2]).substring(0,4); if(mS!=="todos"&&m!==mS)return false; if(aS!=="todos"&&a!==aS)return false;}else return false;
        } return true; 
    }); 
    vendasFiltradasAtuais = flt; // Guarda o filtro atual para o modal de lote
    renderizarListaVendas(flt); 
}

function renderizarListaVendas(aV){ 
    const lD=$('lista-vendas'); lD.innerHTML=""; 
    let sP=0, sPa=0, sL=0, sQ=0; 
    if(aV.length===0){
        lD.innerHTML="<p style='text-align:center;color:#999;padding:20px;'>Nenhuma venda.</p>";
        $('vendas-total-valor').innerText="R$ 0,00";$('vendas-pendentes-valor').innerText="R$ 0,00";
        $('vendas-pagas-valor').innerText="R$ 0,00";$('vendas-lucro-valor').innerText="R$ 0,00";
        $('vendas-qtd-valor').innerText="0 un";
        return;
    } 
    let h=""; 
    aV.forEach(v=>{
        let nV=limparValorPlanilha(v.valor_venda), nL=limparValorPlanilha(v.lucro), nQ=parseFloat(v.qtd)||0, isP=v.status.toLowerCase()==="pendente"; 
        sQ+=nQ; if(isP)sP+=nV;else sPa+=nV; sL+=nL; 
        let cs=isP?"card-pendente":"", em=isP?"🟡":"🟢", lS=v.lucro&&nL>0?`💰 Lucro: ${formatarDoBanco(v.lucro)}`:"";
        
        // Aqui estão os novos botões ZAP em cada card
        let bB = isP 
            ? `<div style="display:flex; gap:8px; margin-top:12px;">
                 <button class="btn-baixar-pgt" style="flex:2; margin-top:0;" onclick="abrirConfirmacaoPagamento(${v.linha})">💸 Recebi</button>
                 <button class="btn-baixar-pgt" style="flex:1; margin-top:0; background:#fffbeb; color:#b45309; border-color:#fde68a;" onclick="enviarZapCobranca(${v.linha})">🔔 Cobrar</button>
               </div>` 
            : `<button class="btn-baixar-pgt" style="margin-top:12px; background:#f0fdf4; color:#166534; border-color:#bbf7d0;" onclick="enviarZapRecibo(${v.linha})">🧾 Enviar Recibo</button>`;

        h+=`<div class="produto-banco-card ${cs}"><div class="card-row-top"><div class="pb-info"><div style="display:flex;justify-content:space-between;align-items:center;"><h4 class="pb-nome" style="margin:0;">${v.cliente}</h4><div><button onclick="abrirModalEditarVenda(${v.linha})" class="btn-editar-venda" style="margin-right:10px;">✏️</button><button onclick="abrirConfirmacaoExclusao(${v.linha})" class="btn-excluir-venda">🗑️</button></div></div><div class="pb-detalhes" style="flex-direction:column;gap:4px;align-items:flex-start;margin-top:5px;"><div style="display:flex;gap:10px;flex-wrap:wrap;"><span style="color:#64748b;">📅 ${v.data}</span><span style="color:#64748b;">🏷️ ${v.produto} (x${v.qtd})</span></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;"><span style="color:#64748b;">📱 ${v.plataforma}</span><span style="color:#10b981;font-weight:900;">${lS}</span></div><div style="margin-top:4px;"><span style="font-weight:900;font-size:0.75rem;color:${isP?'#b45309':'#059669'};">${em} ${v.status.toUpperCase()}</span></div></div></div><div class="pb-custo" style="background:transparent;border:none;color:var(--brand-dark);font-size:1.2rem;padding:0;">${fmt(nV)}</div></div>${bB}</div>`;
    }); 
    lD.innerHTML=h; 
    $('vendas-total-valor').innerText=fmt(sP+sPa); 
    $('vendas-pendentes-valor').innerText=fmt(sP); 
    $('vendas-pagas-valor').innerText=fmt(sPa); 
    $('vendas-lucro-valor').innerText=fmt(sL); 
    $('vendas-qtd-valor').innerText=sQ+" un"; 
}
async function executarPagamentoVenda(){ if(!linhaVendaPagamento)return; const l=linhaVendaPagamento; fecharConfirmacao(); try{ const p={acao:"atualizar_status_venda",linha:l,novo_status:"Pago"}; const r=await fetch(API_PRECIFICACAO,{method:"POST",body:JSON.stringify(p)}); const res=await r.json(); if(res.sucesso){mostrarAlerta("Sucesso!","Pagamento registrado!","success");carregarVendas();}else throw new Error(res.erro); }catch(e){mostrarAlerta("Erro",e.message,"error");} }
async function executarExclusaoVenda(){ if(!linhaVendaExclusao)return; const l=linhaVendaExclusao; fecharExclusao(); try{ const p={acao:"excluir_registro",aba:"Vendas",linha:l}; const r=await fetch(API_PRECIFICACAO,{method:"POST",body:JSON.stringify(p)}); const res=await r.json(); if(res.sucesso){mostrarAlerta("Excluído!","Venda apagada.","success");carregarVendas();}else throw new Error(res.erro); }catch(e){mostrarAlerta("Erro",e.message,"error");} }

// ERP: DASHBOARD
async function carregarDashboardERP(){ $('loading-dashboard').style.display='block'; $('conteudo-dashboard').style.display='none'; try{ if(dashVendas.length===0||dashDespesas.length===0){const rV=await fetch(API_PRECIFICACAO+"?acao=listar_vendas");const jV=await rV.json(); const rD=await fetch(API_PRECIFICACAO+"?acao=listar_despesas");const jD=await rD.json(); if(jV.sucesso&&jD.sucesso){dashVendas=jV.vendas;dashDespesas=jD.despesas;}else throw new Error("Erro na API.");} aplicarFiltrosDashboardERP(); }catch(e){mostrarAlerta("Erro Dashboard",e.message,"error");}finally{$('loading-dashboard').style.display='none';$('conteudo-dashboard').style.display='block';} }
function limparFiltrosDashboardERP(){ $('filtro-dash-mes').value="todos"; $('filtro-dash-ano').value="todos"; aplicarFiltrosDashboardERP(); }
function aplicarFiltrosDashboardERP(){ const m=$('filtro-dash-mes').value, a=$('filtro-dash-ano').value; const fD=(i)=>{ if(m==="todos"&&a==="todos")return true; let pt=[]; if(i.data.includes('/'))pt=i.data.split('/'); else if(i.data.includes('-')){let p=i.data.split('-');pt=[p[2],p[1],p[0]];} else if(i.data.includes(' ')){let td=new Date(i.data);if(!isNaN(td))pt=[td.getDate(),String(td.getMonth()+1).padStart(2,'0'),td.getFullYear()];} if(pt.length>=3){let mD=String(pt[1]).padStart(2,'0'),aD=String(pt[2]).substring(0,4); if(m!=="todos"&&mD!==m)return false; if(a!=="todos"&&aD!==a)return false; return true;} return false; }; gerarGraficosERP(dashVendas.filter(fD),dashDespesas.filter(fD)); }
function gerarGraficosERP(v,d){ let tR=0, tG=0; v.forEach(x=>{if(x.status.toLowerCase()==='pago')tR+=limparValorPlanilha(x.valor_venda);}); d.forEach(x=>{tG+=limparValorPlanilha(x.valor);}); let bl=tR-tG; $('dash-receita-valor').innerText=fmt(tR); $('dash-despesa-valor').innerText=fmt(tG); $('dash-balanco-valor').innerText=fmt(bl); $('dash-balanco-valor').style.color=bl<0?"#ef4444":"#10b981"; const cP={}; v.forEach(x=>{let p=x.produto||"Não Especificado", q=parseFloat(x.qtd)||1; cP[p]=(cP[p]||0)+q;}); let aP=Object.keys(cP).map(k=>({nome:k,qtd:cP[k]})).sort((a,b)=>b.qtd-a.qtd); let t5P=aP.slice(0,5); const cPl={}; v.forEach(x=>{let p=x.plataforma||"Outros", vL=limparValorPlanilha(x.valor_venda); cPl[p]=(cPl[p]||0)+vL;}); const cC={}; v.forEach(x=>{let c=x.cliente||"Avulso", vL=limparValorPlanilha(x.valor_venda); cC[c]=(cC[c]||0)+vL;}); let aC=Object.keys(cC).map(k=>({nome:k,val:cC[k]})).sort((a,b)=>b.val-a.val); let t10C=aC.slice(0,10); if(chartProd)chartProd.destroy(); if(chartPlat)chartPlat.destroy(); if(chartCli)chartCli.destroy(); Chart.defaults.color='#78716c'; Chart.defaults.font.family='Inter'; chartCli=new Chart($('chartClientes').getContext('2d'),{type:'bar',data:{labels:t10C.map(c=>c.nome),datasets:[{label:'Receita (R$)',data:t10C.map(c=>c.val),backgroundColor:'#10b981',borderRadius:6}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.parsed.x)}}},scales:{x:{beginAtZero:true}}}}); chartProd=new Chart($('chartProdutos').getContext('2d'),{type:'doughnut',data:{labels:t5P.map(p=>p.nome),datasets:[{data:t5P.map(p=>p.qtd),backgroundColor:['#d97706','#b45309','#f59e0b','#fde68a','#78716c'],borderWidth:2,borderColor:'#ffffff'}]},options:{responsive:true,plugins:{legend:{position:'bottom'}},cutout:'65%'}}); chartPlat=new Chart($('chartPlataformas').getContext('2d'),{type:'pie',data:{labels:Object.keys(cPl),datasets:[{data:Object.values(cPl),backgroundColor:['#1e3a8a','#3b82f6','#8b5cf6','#a7f3d0','#cbd5e1'],borderWidth:2,borderColor:'#ffffff'}]},options:{responsive:true,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>' '+fmt(c.parsed)}}}}}); }
