// INSIRA A URL DA SUA NOVA IMPLANTAÇÃO AQUI
const API_URL = 'https://script.google.com/macros/s/AKfycbyTTFr6afMHydEKeLfAKGTbJ-PR7x0HgE_ZdBlH5-Q0HpvODhuabeNcHlxYKk8naOP8/exec';

const DB_NAME = 'financas_v102_seguro';
const STORE = 'dados';

let db, chartInstance = null, lancamentos = [], fotoBase64 = null, editId = null;
let mesAtual = new Date().toISOString().substring(0, 7);

// Tenta pegar a senha salva no celular
let appToken = localStorage.getItem('financas_token_seguro') || '';

// Inicialização do Banco
const req = indexedDB.open(DB_NAME, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
req.onsuccess = e => {
    db = e.target.result;
    document.getElementById('filtroMes').value = mesAtual;
    
    // Se já tem a senha salva, entra direto. Se não, mostra o login.
    if (appToken) {
        iniciarAppSeguro();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
    }
};

// --- SISTEMA DE LOGIN ---
function fazerLogin() {
    const senha = document.getElementById('inputSenha').value;
    if (!senha) return;

    document.getElementById('loginErro').style.display = 'none';
    document.getElementById('statusLogin').innerText = "Validando...";

    // Verifica na planilha se a senha está correta
    fetch(API_URL + "?token=" + encodeURIComponent(senha))
        .then(res => res.json())
        .then(json => {
            if (json.error === "Acesso negado.") {
                document.getElementById('loginErro').style.display = 'block';
                document.getElementById('statusLogin').innerText = "";
            } else {
                // Senha correta: Salva no celular e entra
                appToken = senha;
                localStorage.setItem('financas_token_seguro', appToken);
                iniciarAppSeguro();
            }
        })
        .catch(() => {
            // Se estiver offline mas digitou a senha que já estava salva antes
            if (!navigator.onLine && senha === localStorage.getItem('financas_token_seguro')) {
                appToken = senha;
                iniciarAppSeguro();
            } else {
                document.getElementById('loginErro').innerText = "Erro de conexão. Fique online no 1º acesso.";
                document.getElementById('loginErro').style.display = 'block';
                document.getElementById('statusLogin').innerText = "";
            }
        });
}

function iniciarAppSeguro() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    atualizarStatusRede();
    carregarLocal();
}

function deslogar() {
    localStorage.removeItem('financas_token_seguro');
    appToken = '';
    window.location.reload();
}

// --- GERENCIAMENTO DO APP ---
function atualizarStatusRede() {
    const statusLabel = document.getElementById('statusLabel');
    if (navigator.onLine) {
        statusLabel.innerText = "🌐 Online";
        statusLabel.className = "status online";
        if(appToken) sincronizar();
    } else {
        statusLabel.innerText = "⚠️ Offline";
        statusLabel.className = "status offline";
    }
}
window.addEventListener('online', atualizarStatusRede);
window.addEventListener('offline', atualizarStatusRede);

function carregarLocal() {
    const tx = db.transaction(STORE, 'readonly');
    tx.objectStore(STORE).getAll().onsuccess = e => {
        lancamentos = e.target.result.filter(item => !item.excluido);
        atualizarTela();
    };
}

function atualizarTela() {
    const lista = document.getElementById('listaRecentes');
    const filtrados = lancamentos.filter(i => i.data.substring(0, 7) === mesAtual);
    let rec = 0, desp = 0;
    lista.innerHTML = '';
    
    filtrados.sort((a,b) => b.data.localeCompare(a.data)).forEach(item => {
        const v = parseFloat(item.valor) || 0;
        item.tipo === 'Receita' ? rec += v : desp += v;
        
        let stringDaFoto = item.fotoBase64 || item.foto || ''; 
        let imagemSrc = 'https://via.placeholder.com/50?text=Sem+Foto';

        if (typeof stringDaFoto === 'string' && stringDaFoto.length > 50) {
            if (!stringDaFoto.startsWith('data:image')) {
                imagemSrc = 'data:image/jpeg;base64,' + stringDaFoto;
            } else {
                imagemSrc = stringDaFoto;
            }
        }

        const dataFormatada = item.data.split('T')[0].split('-').reverse().join('/');
        const statusSync = item.sinc === 0 ? '<span style="color: orange; font-size: 10px;">⏳</span>' : '';
        
        lista.innerHTML += `
            <div class="item">
                <img class="mini-foto" src="${imagemSrc}" onclick="abrirZoom(this.src)" onerror="this.src='https://via.placeholder.com/50?text=Erro'">
                <div class="info">
                    <strong>${item.descricao} ${statusSync}</strong>
                    <span>${item.categoria}</span>
                    <small>${dataFormatada}</small>
                </div>
                <div class="acoes">
                    <b style="color:${item.tipo === 'Receita' ? 'var(--s)' : 'var(--d)'}">R$ ${v.toFixed(2)}</b>
                    <div>
                        <button class="btn-acao" onclick="editar('${item.id}')">Editar</button>
                        <button class="btn-acao btn-excluir" onclick="excluir('${item.id}')">Excluir</button>
                    </div>
                </div>
            </div>`;
    });

    document.getElementById('saldoTotal').innerText = `R$ ${(rec - desp).toFixed(2)}`;
    document.getElementById('totalRec').innerText = `R$ ${rec.toFixed(2)}`;
    document.getElementById('totalDes').innerText = `R$ ${desp.toFixed(2)}`;
}

async function sincronizar() {
    if (!navigator.onLine || !appToken) return;
    document.getElementById('statusLabel').innerText = "🔄 Sincronizando...";

    const txRead = db.transaction(STORE, 'readonly');
    txRead.objectStore(STORE).getAll().onsuccess = async e => {
        const todosItens = e.target.result;
        const pendentes = todosItens.filter(l => l.sinc === 0);

        for (let p of pendentes) {
            try {
                // ANEXA A SENHA AO ENVIAR DADOS
                const payload = p.excluido ? { action: 'delete', id: p.id, token: appToken } : { ...p, token: appToken };
                
                await fetch(API_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload) 
                });
                
                const txWrite = db.transaction(STORE, 'readwrite');
                if (p.excluido) {
                    txWrite.objectStore(STORE).delete(p.id);
                } else {
                    p.sinc = 1;
                    txWrite.objectStore(STORE).put(p);
                }
            } catch (err) {
                console.log("Falha ao subir: " + p.id);
            }
        }

        try {
            // ANEXA A SENHA AO BAIXAR DADOS
            const res = await fetch(API_URL + "?token=" + encodeURIComponent(appToken));
            const json = await res.json();
            
            if(json.error === "Acesso negado.") {
                 deslogar(); // Se alguém mudar a senha na planilha, expulsa o celular
                 return;
            }
            
            if (json && json.data) {
                const txFinal = db.transaction(STORE, 'readwrite');
                const store = txFinal.objectStore(STORE);
                
                const localAtual = await new Promise(resolve => store.getAll().onsuccess = ev => resolve(ev.target.result));
                localAtual.forEach(item => { if (item.sinc === 1) store.delete(item.id); });

                json.data.forEach(item => {
                    store.put({ ...item, id: item.id.toString(), valor: parseFloat(item.valor), sinc: 1 });
                });

                txFinal.oncomplete = () => {
                    document.getElementById('statusLabel').innerText = "✅ Atualizado";
                    document.getElementById('statusLabel').className = "status online";
                    carregarLocal(); 
                };
            }
        } catch (e) {
            atualizarStatusRede();
        }
    };
}

document.getElementById('inputFoto').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 250;
            const scale = MAX / Math.max(img.width, img.height);
            canvas.width = img.width * scale; 
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            fotoBase64 = canvas.toDataURL('image/jpeg', 0.4);
            document.getElementById('imgPreview').src = fotoBase64;
            document.getElementById('imgPreview').style.display = 'block';
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
};

function abrirZoom(src) {
    if(src && !src.includes('placeholder')) {
        document.getElementById('zoomedImg').src = src;
        document.getElementById('zoomOverlay').classList.add('active');
    }
}
function fecharZoom() {
    document.getElementById('zoomOverlay').classList.remove('active');
}

function editar(id) {
    const item = lancamentos.find(i => i.id === id);
    if (!item) return;
    editId = id;
    document.getElementById('formTitle').innerText = "Editar Item";
    document.getElementById('tipo').value = item.tipo;
    document.getElementById('data').value = item.data.split('T')[0];
    document.getElementById('categoria').value = item.categoria;
    document.getElementById('descricao').value = item.descricao;
    document.getElementById('valor').value = item.valor;
    
    fotoBase64 = item.foto;
    if (fotoBase64) {
        document.getElementById('imgPreview').src = fotoBase64;
        document.getElementById('imgPreview').style.display = 'block';
    } else {
        document.getElementById('imgPreview').style.display = 'none';
    }
    document.getElementById('modalForm').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function excluir(id) {
    if (!confirm("Excluir este item?")) return;
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.get(id).onsuccess = e => {
        let item = e.target.result;
        if(item) {
            item.excluido = true; 
            item.sinc = 0; 
            store.put(item).onsuccess = () => {
                carregarLocal();
                sincronizar();
            };
        }
    };
}

function salvar() {
    const item = {
        id: editId || "ID" + Date.now(),
        tipo: document.getElementById('tipo').value,
        data: document.getElementById('data').value,
        categoria: document.getElementById('categoria').value || 'Geral',
        descricao: document.getElementById('descricao').value || 'S/D',
        valor: parseFloat(document.getElementById('valor').value) || 0,
        foto: fotoBase64 || '',
        sinc: 0
    };
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => {
        fecharTudo();
        carregarLocal();
        sincronizar();
    };
}

function fecharTudo() { 
    document.querySelectorAll('.modal, .overlay, .modal-form').forEach(el => el.classList.remove('active'));
}

document.getElementById('tabAdd').onclick = () => { 
    editId = null; 
    fotoBase64 = null;
    document.getElementById('formTitle').innerText = "Novo Item";
    document.getElementById('imgPreview').style.display = 'none';
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalForm').classList.add('active'); 
    document.getElementById('overlay').classList.add('active'); 
};

document.getElementById('tabResumo').onclick = () => { 
    document.getElementById('view-resumo').style.display='block'; 
    document.getElementById('view-grafico').style.display='none'; 
    document.getElementById('tabResumo').classList.add('active');
    document.getElementById('tabGrafico').classList.remove('active');
};

document.getElementById('tabGrafico').onclick = () => { 
    document.getElementById('view-resumo').style.display='none'; 
    document.getElementById('view-grafico').style.display='block'; 
    document.getElementById('tabGrafico').classList.add('active');
    document.getElementById('tabResumo').classList.remove('active');
    renderGrafico(); 
};

document.getElementById('btnSalvar').onclick = salvar;
document.getElementById('filtroMes').onchange = e => { mesAtual = e.target.value; carregarLocal(); };

document.getElementById('btnExportar').onclick = () => {
    let csv = "Data;Tipo;Categoria;Descricao;Valor\n";
    lancamentos.filter(i => i.data.startsWith(mesAtual)).forEach(i => {
        csv += `${i.data};${i.tipo};${i.categoria};${i.descricao};${i.valor}\n`;
    });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_${mesAtual}.csv`;
    link.click();
};

function renderGrafico() {
    const filtrados = lancamentos.filter(i => i.data.startsWith(mesAtual) && i.tipo === 'Despesa');
    const caps = {};
    filtrados.forEach(i => caps[i.categoria] = (caps[i.categoria] || 0) + i.valor);
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(caps),
            datasets: [{ data: Object.values(caps), backgroundColor: ['#007bff','#28a745','#ffc107','#dc3545','#6610f2'] }]
        }
    });
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && appToken) sincronizar();
});
