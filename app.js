const API_URL = 'https://script.google.com/macros/s/AKfycbyIPr8SANb5N5ag6JI-M7N5oPaX-c8Zef8V_SUTMfIazaXqZziZ7AGj-AHatRiU9a-J/exec';
const DB_NAME = 'financas_v200';
const STORE = 'dados';

let db, lancamentos = [], tokenUsuario = "";
let escalaZoom = 1;

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    tokenUsuario = localStorage.getItem('app_token');

    if (tokenUsuario) {
        mostrarApp();
        iniciarDB();
    }

    document.getElementById('btnSalvar').addEventListener('click', salvarLancamento);
});

function mostrarApp() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('conteudoApp').style.display = 'block';
    document.getElementById('navBottom').style.display = 'flex';
}

// ================= LOGIN =================
function verificarSenha() {
    const senha = document.getElementById('inputSenha').value;

    if (senha === "Ale..andro@2026") {
        localStorage.setItem('app_token', senha);
        location.reload();
    } else {
        alert("Senha incorreta!");
    }
}

// ================= DATABASE =================
function iniciarDB() {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    };

    req.onsuccess = e => {
        db = e.target.result;
        carregarLocal();
    };
}

function carregarLocal() {
    const tx = db.transaction(STORE, 'readonly');
    tx.objectStore(STORE).getAll().onsuccess = e => {
        lancamentos = e.target.result.filter(item => !item.excluido);
        atualizarTela();
    };
}

// ================= SALVAR =================
function salvarLancamento() {
    const tipo = document.getElementById('tipo').value;
    const origem = document.getElementById('origem').value;
    const descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value);

    if (!descricao || !valor) {
        alert("Preencha todos os campos!");
        return;
    }

    const novo = {
        id: Date.now(),
        tipo,
        origem,
        descricao,
        valor
    };

    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(novo);

    tx.oncomplete = () => {
        fecharTudo();
        carregarLocal();
        enviarParaAPI(novo);
    };
}

// ================= API =================
function enviarParaAPI(dado) {
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(dado)
    }).catch(() => console.log("API offline"));
}

// ================= TELA =================
function atualizarTela() {
    const lista = document.getElementById('listaRecentes');
    let rec = 0, desp = 0;

    let contas = {
        "Dinheiro": 0,
        "Banco": 0,
        "Cartão": 0
    };

    lista.innerHTML = '';

    lancamentos.forEach(item => {
        const v = parseFloat(item.valor) || 0;
        const ori = item.origem || 'Dinheiro';

        if (item.tipo === 'Receita') {
            rec += v;
            contas[ori] += v;
        } else {
            desp += v;
            contas[ori] -= v;
        }

        lista.innerHTML += `
        <div class="item">
            <img src="https://via.placeholder.com/100"
                 class="mini-foto"
                 onclick="abrirZoom(this.src)">
            <div>
                <b>${item.descricao}</b><br>
                R$ ${v.toFixed(2)} (${ori})
            </div>
        </div>`;
    });

    document.getElementById('saldoTotal').innerText =
        `R$ ${(rec - desp).toFixed(2)}`;

    let htmlContas = "";
    for (let c in contas) {
        htmlContas += `<div>${c}: R$ ${contas[c].toFixed(2)}</div>`;
    }

    document.getElementById('resumoContas').innerHTML = htmlContas;

    gerarGrafico(contas);
}

// ================= GRÁFICO =================
function gerarGrafico(contas) {
    const ctx = document.getElementById('grafico');

    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(contas),
            datasets: [{
                data: Object.values(contas)
            }]
        }
    });
}

// ================= MODAL =================
function abrirModal() {
    document.getElementById('overlay').classList.add('active');
}

function fecharTudo() {
    document.getElementById('overlay').classList.remove('active');
}

// ================= ZOOM =================
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
    if (escalaZoom > 3) escalaZoom = 1;

    document.getElementById('zoomedImg').style.transform =
        `scale(${escalaZoom})`;
}

function fecharZoom() {
    document.getElementById('zoomOverlay').classList.remove('active');
}