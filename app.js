const API_URL = 'https://script.google.com/macros/s/AKfycbyIPr8SANb5N5ag6JI-M7N5oPaX-c8Zef8V_SUTMfIazaXqZziZ7AGj-AHatRiU9a-J/exec';
const DB_NAME = 'financas_v105';
const STORE = 'dados';
let db, chartInstance = null, lancamentos = [], fotoBase64 = null, tokenUsuario = "";
let mesAtual = new Date().toISOString().substring(0, 7);

// INICIALIZAÇÃO E LOGIN
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
    if(senha.length > 3) {
        localStorage.setItem('app_token', senha);
        location.reload();
    } else {
        alert("Senha inválida!");
    }
}

function iniciarDB() {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => {
        db = e.target.result;
        document.getElementById('filtroMes').value = mesAtual;
        carregarLocal();
        sincronizar();
    };
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
    const busca = document.getElementById('busca').value.toLowerCase();
    const filtrados = lancamentos.filter(i => 
        i.data.substring(0, 7) === mesAtual && 
        (i.descricao.toLowerCase().includes(busca) || i.categoria.toLowerCase().includes(busca))
    );

    let rec = 0, desp = 0, contas = { "Dinheiro": 0, "Banco": 0, "Cartão": 0 };
    lista.innerHTML = '';

    filtrados.sort((a,b) => b.data.localeCompare(a.data)).forEach(item => {
        const v = parseFloat(item.valor) || 0;
        const ori = item.origem || 'Dinheiro';
        if (item.tipo === 'Receita') { rec += v; contas[ori] += v; }
        else { desp += v; contas[ori] -= v; }

        let imgTag = item.foto && item.foto.length > 50 ? 
            `<img class="mini-foto" src="${item.foto}" onclick="abrirZoom('${item.foto}')">` : 
            `<div class="mini-foto"></div>`;
        
        lista.innerHTML += `
            <div class="item">
                ${imgTag}
                <div style="flex:1"><strong>${item.descricao}</strong><br><small>${item.categoria} • ${ori}</small></div>
                <div style="text-align:right"><b style="color:${item.tipo==='Receita'?'var(--s)':'var(--d)'}">R$ ${v.toFixed(2)}</b><br>
                <small onclick="excluir('${item.id}')" style="color:#999">Excluir</small></div>
            </div>`;
    });

    document.getElementById('saldoTotal').innerText = `R$ ${(rec - desp).toFixed(2)}`;
    document.getElementById('totalRec').innerText = `R$ ${rec.toFixed(2)}`;
    document.getElementById('totalDes').innerText = `R$ ${desp.toFixed(2)}`;
    
    let htmlContas = "";
    for (let c in contas) htmlContas += `<div>${c}: <b>R$ ${contas[c].toFixed(2)}</b></div>`;
    document.getElementById('resumoContas').innerHTML = htmlContas;
    if (document.getElementById('view-grafico').style.display === 'block') renderGrafico();
}

// ZOOM E GRÁFICO
function abrirZoom(src) {
    document.getElementById('zoomedImg').src = src;
    document.getElementById('zoomOverlay').classList.add('active');
    document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
}
function fecharZoom() {
    document.getElementById('zoomOverlay').classList.remove('active');
    document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function renderGrafico() {
    const filtrados = lancamentos.filter(i => i.data.startsWith(mesAtual) && i.tipo === 'Despesa');
    const caps = {};
    filtrados.forEach(i => caps[i.categoria] = (caps[i.categoria] || 0) + i.valor);
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(caps), datasets: [{ data: Object.values(caps), backgroundColor: ['#007bff','#28a745','#ffc107','#dc3545','#6610f2'] }] }
    });
}

// SINCRONIZAÇÃO E SALVAR
async function sincronizar() {
    if (!navigator.onLine) return;
    document.getElementById('statusLabel').innerText = "🔄 Sincronizando...";
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (json.data) {
            const tx = db.transaction(STORE, 'readwrite');
            json.data.forEach(item => { item.sinc = 1; tx.objectStore(STORE).put(item); });
        }
    } catch(e) {}

    const tx = db.transaction(STORE, 'readonly');
    tx.objectStore(STORE).getAll().onsuccess = async e => {
        const pendentes = e.target.result.filter(l => l.sinc === 0);
        for (let p of pendentes) {
            await fetch(API_URL, { method: 'POST', body: JSON.stringify({...p, token: tokenUsuario}) });
            const tw = db.transaction(STORE, 'readwrite');
            p.sinc = 1; tw.objectStore(STORE).put(p);
        }
        document.getElementById('statusLabel').innerText = "✅ Sincronizado";
        carregarLocal();
    };
}

document.getElementById('btnSalvar').onclick = () => {
    const item = {
        id: "ID" + Date.now(),
        tipo: document.getElementById('tipo').value,
        origem: document.getElementById('origem').value,
        data: document.getElementById('data').value,
        categoria: document.getElementById('categoria').value || 'Geral',
        descricao: document.getElementById('descricao').value || 'S/D',
        valor: parseFloat(document.getElementById('valor').value) || 0,
        foto: fotoBase64 || '',
        sinc: 0 
    };
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => { fecharTudo(); carregarLocal(); sincronizar(); };
};

// UI AUXILIAR
function mudarTab(view, btn) {
    document.getElementById('view-resumo').style.display = view === 'resumo' ? 'block' : 'none';
    document.getElementById('view-grafico').style.display = view === 'grafico' ? 'block' : 'none';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if(view === 'grafico') renderGrafico();
}
function abrirModal() { 
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
    document.getElementById('overlay').classList.add('active'); 
}
function fecharTudo() { document.getElementById('overlay').classList.remove('active'); }
document.getElementById('busca').oninput = atualizarTela;
document.getElementById('filtroMes').onchange = e => { mesAtual = e.target.value; carregarLocal(); };
document.getElementById('inputFoto').onchange = e => {
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 600 / Math.max(img.width, img.height);
            canvas.width = img.width * scale; canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            fotoBase64 = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById('imgPreview').src = fotoBase64;
            document.getElementById('imgPreview').style.display = 'block';
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
};
