const API_URL = 'https://script.google.com/macros/s/AKfycbyIPr8SANb5N5ag6JI-M7N5oPaX-c8Zef8V_SUTMfIazaXqZziZ7AGj-AHatRiU9a-J/exec';
const DB_NAME = 'financas_v102';
const STORE = 'dados';

let db, chartInstance = null, lancamentos = [], fotoBase64 = null, editId = null;
let mesAtual = new Date().toISOString().substring(0, 7);

// Banco de Dados Local
const req = indexedDB.open(DB_NAME, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
req.onsuccess = e => {
    db = e.target.result;
    document.getElementById('filtroMes').value = mesAtual;
    carregarLocal();
    sincronizar();
};

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

    let rec = 0, desp = 0, contas = {};
    lista.innerHTML = '';

    filtrados.sort((a,b) => b.data.localeCompare(a.data)).forEach(item => {
        const v = parseFloat(item.valor) || 0;
        const ori = item.origem || 'Outros';
        
        if (item.tipo === 'Receita') {
            rec += v;
            contas[ori] = (contas[ori] || 0) + v;
        } else {
            desp += v;
            contas[ori] = (contas[ori] || 0) - v;
        }

        let img = item.foto && item.foto.length > 10 ? item.foto : 'https://via.placeholder.com/50?text=S/F';
        
        lista.innerHTML += `
            <div class="item">
                <img class="mini-foto" src="${img}" onclick="abrirZoom(this.src)">
                <div class="info">
                    <strong>${item.descricao}</strong><br>
                    <span class="tag">${item.categoria}</span> | <small>${ori}</small>
                </div>
                <div style="text-align:right">
                    <b style="color:${item.tipo === 'Receita' ? 'var(--s)' : 'var(--d)'}">R$ ${v.toFixed(2)}</b><br>
                    <small onclick="editar('${item.id}')" style="color:var(--p)">Editar</small>
                </div>
            </div>`;
    });

    document.getElementById('saldoTotal').innerText = `R$ ${(rec - desp).toFixed(2)}`;
    document.getElementById('totalRec').innerText = `R$ ${rec.toFixed(2)}`;
    document.getElementById('totalDes').innerText = `R$ ${desp.toFixed(2)}`;

    // Atualiza resumo de contas
    let htmlContas = "";
    for (let c in contas) {
        htmlContas += `<div>${c}: <b style="color:${contas[c]>=0?'var(--s)':'var(--d)'}">R$ ${contas[c].toFixed(2)}</b></div>`;
    }
    document.getElementById('resumoContas').innerHTML = htmlContas || "Nenhum lançamento este mês.";
}

// Funções de Zoom (Específico para iPhone)
function abrirZoom(src) {
    if(!src.includes('placeholder')) {
        document.getElementById('zoomedImg').src = src;
        document.getElementById('zoomOverlay').classList.add('active');
        document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    }
}

function fecharZoom() {
    document.getElementById('zoomOverlay').classList.remove('active');
    document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

// Sincronização e Salvar
async function sincronizar() {
    if (!navigator.onLine) return;
    const tx = db.transaction(STORE, 'readonly');
    tx.objectStore(STORE).getAll().onsuccess = async e => {
        const pendentes = e.target.result.filter(l => l.sinc === 0);
        for (let p of pendentes) {
            try {
                await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) });
                const tw = db.transaction(STORE, 'readwrite');
                p.sinc = 1; tw.objectStore(STORE).put(p);
            } catch (e) {}
        }
    };
}

function salvar() {
    const item = {
        id: editId || "ID" + Date.now(),
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
}

// Eventos e UI
document.getElementById('btnSalvar').onclick = salvar;
document.getElementById('tabAdd').onclick = () => { 
    editId = null; fotoBase64 = null; 
    document.getElementById('imgPreview').style.display='none';
    document.getElementById('modalForm').classList.add('active'); 
    document.getElementById('overlay').classList.add('active'); 
};
function fecharTudo() { document.querySelectorAll('.modal, .overlay').forEach(el => el.classList.remove('active')); }
function editar(id) { editId = id; /* lógica de preencher campos igual anterior */ }

// Lógica da Foto
document.getElementById('inputFoto').onchange = e => {
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 400; // Um pouco mais de qualidade
            const scale = MAX / Math.max(img.width, img.height);
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
