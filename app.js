const API_URL = 'https://script.google.com/macros/s/AKfycbyIPr8SANb5N5ag6JI-M7N5oPaX-c8Zef8V_SUTMfIazaXqZziZ7AGj-AHatRiU9a-J/exec';
const DB_NAME = 'financas_v105';
const STORE = 'dados';
let db, lancamentos = [], tokenUsuario = "";
let escalaZoom = 1;

window.onload = () => {
    tokenUsuario = localStorage.getItem('app_token');
    if(tokenUsuario) {
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('conteudoApp').style.display = 'block';
        document.getElementById('navBottom').style.display = 'flex';
        iniciarDB();
    }
};

function verificarSenha() {
    const senha = document.getElementById('inputSenha').value;
    if(senha === "Ale..andro@2026") {
        localStorage.setItem('app_token', senha);
        location.reload();
    } else { alert("Senha incorreta!"); }
}

function iniciarDB() {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => { db = e.target.result; carregarLocal(); };
}

function carregarLocal() {
    const tx = db.transaction(STORE, 'readonly');
    tx.objectStore(STORE).getAll().onsuccess = e => {
        lancamentos = e.target.result.filter(item => !item.excluido);
        atualizarTela();
    };
}

function atualizarTela() {
    const lista = document.getElementById('listaRecentes');
    let rec = 0, desp = 0, contas = { "Dinheiro": 0, "Banco": 0, "Cartão": 0 };
    lista.innerHTML = '';

    lancamentos.forEach(item => {
        const v = parseFloat(item.valor) || 0;
        const ori = item.origem || 'Dinheiro';
        if (item.tipo === 'Receita') { rec += v; if(contas[ori] !== undefined) contas[ori] += v; }
        else { desp += v; if(contas[ori] !== undefined) contas[ori] -= v; }
        
        lista.innerHTML += `<div class="item"><b>${item.descricao}</b> - R$ ${v.toFixed(2)} (${ori})</div>`;
    });

    document.getElementById('saldoTotal').innerText = `R$ ${(rec - desp).toFixed(2)}`;
    let htmlContas = "";
    for (let c in contas) htmlContas += `<div>${c}: R$ ${contas[c].toFixed(2)}</div>`;
    document.getElementById('resumoContas').innerHTML = htmlContas;
}

// FUNÇÕES DE ZOOM PARA O APP
function abrirZoom(src) {
    escalaZoom = 1;
    const img = document.getElementById('zoomedImg');
    img.src = src;
    img.style.transform = `scale(${escalaZoom})`;
    document.getElementById('zoomOverlay').classList.add('active');
}
function aumentarZoom(event) {
    event.stopPropagation();
    escalaZoom += 0.5;
    if (escalaZoom > 2.5) escalaZoom = 1;
    document.getElementById('zoomedImg').style.transform = `scale(${escalaZoom})`;
}
function fecharZoom() { document.getElementById('zoomOverlay').classList.remove('active'); }

function abrirModal() { document.getElementById('overlay').classList.add('active'); }
function fecharTudo() { document.getElementById('overlay').classList.remove('active'); }
