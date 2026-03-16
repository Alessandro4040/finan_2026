const API_URL = 'https://script.google.com/macros/s/AKfycbyTTFr6afMHydEKeLfAKGTbJ-PR7x0HgE_ZdBlH5-Q0HpvODhuabeNcHlxYKk8naOP8/exec';
const DB_NAME = 'financas_v103_pro';
const STORE = 'dados';

let db, chartInstance = null, lancamentos = [], fotoBase64 = null, editId = null;
let mesAtual = new Date().toISOString().substring(0, 7);
let appToken = localStorage.getItem('financas_token_seguro') || '';

// --- INICIALIZAÇÃO E BANCO DE DADOS ---
const req = indexedDB.open(DB_NAME, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
req.onsuccess = e => {
    db = e.target.result;
    document.getElementById('filtroMes').value = mesAtual;
    
    if (appToken) {
        iniciarAppSeguro();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
    }
};

// --- LOGIN E SEGURANÇA ---
async function fazerLogin() {
    const senha = document.getElementById('inputSenha').value;
    if (!senha) return;

    document.getElementById('loginErro').style.display = 'none';
    const botao = event.target;
    botao.innerText = "Verificando...";

    try {
        const res = await fetch(API_URL + "?token=" + senha);
        const json = await res.json();
        
        if (json.error === "Acesso negado.") {
            throw new Error();
        } else {
            localStorage.setItem('financas_token_seguro', senha);
            appToken = senha;
            iniciarAppSeguro();
            document.getElementById('loginScreen').style.display = 'none';
            botao.innerText = "Entrar";
            
            // Força a inserção dos dados da primeira vez
            if(json.data) {
                const txFinal = db.transaction(STORE, 'readwrite');
                const store = txFinal.objectStore(STORE);
