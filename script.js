// ============================================================
// 1. CONFIGURAÇÃO SUPABASE - URL UNIFICADA
// ============================================================
const SUPABASE_URL ='https://uzsujdqyutzennhcjkyn.supabase.co';
const SUPABASE_ANON_KEY ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6c3VqZHF5dXR6ZW5uaGNqa3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDcwNjAsImV4cCI6MjEwMjY4MzA2MH0.LSsLFovpMNcdhQkBu4qwLo9r_pU9xdITT32M01qI9QY';

let supabaseClient = null;
let dbStatus = 'offline';
let CLAUSULAS = [];
let clausulasAdicionais = [];

// ============================================================
// 2. MÁSCARAS
// ============================================================
function mascaraCPF(v) {
    v = v.replace(/\D/g, '');
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{2})$/, '$1-$2');
    }
    return v;
}

function mascaraRG(v) {
    v = v.replace(/\D/g, '');
    if (v.length <= 9) {
        v = v.replace(/(\d{2})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1})$/, '$1-$2');
    }
    return v;
}

function mascaraTelefone(v) {
    v = v.replace(/\D/g, '');
    if (v.length <= 11) {
        v = v.replace(/^(\d{2})(\d)/, '($1) $2');
        v = v.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return v;
}

function mascaraValor(v) {
    v = v.replace(/\D/g, '');
    if (v.length > 0) {
        v = (parseInt(v) / 100).toFixed(2);
        v = v.replace('.', ',');
        v = v.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return v;
}

function aplicarMascara(e, tipo) {
    const input = e.target;
    let v = input.value;
    if (tipo === 'cpf') input.value = mascaraCPF(v);
    else if (tipo === 'rg') input.value = mascaraRG(v);
    else if (tipo === 'telefone') input.value = mascaraTelefone(v);
    else if (tipo === 'valor') input.value = mascaraValor(v);
}

function removerMascara(v) {
    return v.replace(/\D/g, '');
}

function mostrarMensagem(msg, tipo) {
    const el = document.getElementById('msgBusca') || document.getElementById('msgSalvoFooter');
    if (el) {
        el.textContent = msg;
        el.style.color = tipo === 'success' ? '#28a745' : tipo === 'error' ? '#dc3545' : '#ffc107';
        setTimeout(() => { if (el) el.textContent = ''; }, 5000);
    }
}

// ============================================================
// 3. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const anoFooter = document.getElementById('anoFooter');
    if (anoFooter) anoFooter.textContent = new Date().getFullYear();

    const dataElab = document.getElementById('dataElaboracao');
    if (dataElab && !dataElab.value) {
        const hoje = new Date().toISOString().split('T')[0];
        dataElab.value = hoje;
    }

    //const numContrato = document.getElementById('numContrato');
   // if (numContrato && !numContrato.value) {
   //     const ano = new Date().getFullYear();
   //     const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
   //     numContrato.value = `${ano}/${num}`;
   // }

     bloquearCampoNumeroContrato();
    vincularEventosSequenciaContrato();
    atualizarNumeroContratoAutomatico(false);


    
    // Aplicar máscaras
    document.querySelectorAll('#locadorCpf, #locatarioCpf, #fiadorCpf, #fiadorConjugeCpf, #buscaCpf')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'cpf'); }));

    document.querySelectorAll('#locadorRg, #locatarioRg, #fiadorRg, #fiadorConjugeRg')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'rg'); }));

    document.querySelectorAll('#locadorTel, #locatarioTel, #fiadorTel')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'telefone'); }));

    document.querySelectorAll('#imovelValor, #caucaoValor')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'valor'); }));
    
function toggleFiador(checkbox) {
    const container = document.getElementById('camposFiadorContainer');
    if (!container) return;

    const ativarFiador = checkbox ? checkbox.checked : false;
    container.classList.toggle('bloco-desabilitado', !ativarFiador);

    const campos = container.querySelectorAll('input, select, textarea');
    campos.forEach((campo) => {
        campo.disabled = !ativarFiador;
        if (!ativarFiador) {
            if (campo.type === 'checkbox' || campo.type === 'radio') {
                campo.checked = false;
            } else {
                campo.value = '';
            }
        }
    });
}
    initSupabase();
});

// ============================================================
// 4. CONEXÃO SUPABASE
// ============================================================
async function initSupabase() {
    const statusDB = document.getElementById('statusDB');
    if (statusDB) {
        statusDB.textContent = '⏳ Conectando...';
        statusDB.className = 'status-db status-loading';
    }
    
    try {
        if (typeof supabase === 'undefined') {
            throw new Error('SDK do Supabase não carregado');
        }
        
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Cliente Supabase criado');
        
        // Testar conexão
        const { error: testError } = await supabaseClient
            .from('clausulas')
            .select('count', { count: 'exact', head: true });
        
        if (testError) {
            console.warn('⚠️ Erro ao testar conexão:', testError);
            throw testError;
        }
        
        dbStatus = 'online';
        if (statusDB) {
            statusDB.textContent = '✅ Online';
            statusDB.className = 'status-db status-online';
        }
        console.log('✅ Conexão com Supabase OK!');
        
        await carregarClausulasDoSupabase();
        
    } catch (error) {
        console.error('❌ Erro na conexão:', error.message);
        dbStatus = 'offline';
        if (statusDB) {
            statusDB.textContent = '⚠️ Offline (modo local)';
            statusDB.className = 'status-db status-offline';
        }
        usarClausulasFallback();
        carregarClausulas();
    }
}

// ============================================================
// 5. CARREGAR CLÁUSULAS DO SUPABASE
// ============================================================
async function carregarClausulasDoSupabase() {
    try {
        if (!supabaseClient) {
            throw new Error('Cliente Supabase não inicializado');
        }
        
        const { data, error } = await supabaseClient
            .from('clausulas')
            .select('*')
            .order('id');

        if (error) {
            throw new Error('Erro ao buscar cláusulas: ' + error.message);
        }

        if (data && data.length > 0) {
            const padrao = data.filter(c => c.is_padrao === true);
            const adicionais = data.filter(c => c.is_padrao === false);

            CLAUSULAS = padrao.map(c => ({ id: String(c.id), descricao: c.descricao, texto: c.texto }));
            clausulasAdicionais = adicionais.map(c => ({ id: String(c.id), descricao: c.descricao, texto: c.texto }));

            console.log(`✅ ${CLAUSULAS.length} padrão, ${clausulasAdicionais.length} adicionais`);
            carregarClausulas();
        } else {
            console.log('⚠️ Nenhuma cláusula encontrada. Inserindo padrão...');
            await inserirClausulasPadrao();
            await carregarClausulasDoSupabase();
        }

    } catch (error) {
        console.error('❌ Erro ao carregar cláusulas:', error);
        usarClausulasFallback();
        carregarClausulas();
    }
}

async function inserirClausulasPadrao() {
    const lista = [
        { descricao: 'Reajuste pelo IG-M', texto: 'O valor do aluguel será reajustado anualmente pelo índice IG-M, calculado pro-rata die.' },
        { descricao: 'Reajuste pelo IPCA', texto: 'O valor do aluguel será reajustado anualmente pelo índice IPCA (IBGE), calculado pro-rata die.' },
        { descricao: 'Benfeitorias e Reformas', texto: 'O locatário poderá realizar benfeitorias úteis e voluptuárias, desde que comunicadas previamente ao locador. Benfeitorias necessárias poderão ser executadas independentemente de autorização, mediante comprovação de urgência.' },
        { descricao: 'Sublocação Proibida', texto: 'É vedada a sublocação total ou parcial do imóvel, bem como a cessão ou transferência da locação, sem o consentimento prévio e escrito do locador.' },
        { descricao: 'Visitação para Venda', texto: 'O locador poderá visitar o imóvel para fins de venda, com agendamento prévio de 48 (quarenta e oito) horas, em horário comercial, respeitando a privacidade do locatário.' },
        { descricao: 'Responsabilidade por Danos', texto: 'O locatário é responsável por todos os danos causados ao imóvel, salvo os decorrentes de uso normal e deterioração natural. A pintura interna deverá ser refeita a cada 5 (cinco) anos, por conta do locatário.' },
        { descricao: 'Renovação Antecipada', texto: 'A renovação do contrato poderá ser solicitada com antecedência mínima de 60 (sessenta) dias do término do prazo, mediante termo aditivo.' },
        { descricao: 'Silêncio e Tolerância', texto: 'A tolerância ou o não exercício de qualquer direito por parte do locador não constituirá novação ou renúncia, podendo ser exercido a qualquer tempo.' }
    ];

    for (const c of lista) {
        await supabaseClient
            .from('clausulas')
            .insert({ descricao: c.descricao, texto: c.texto, is_padrao: true });
    }
    console.log('✅ Cláusulas padrão inseridas');
}

function usarClausulasFallback() {
    CLAUSULAS = [
        { id: 'fb1', descricao: 'Reajuste pelo IG-M', texto: 'O valor do aluguel será reajustado anualmente pelo índice IG-M.' },
        { id: 'fb2', descricao: 'Reajuste pelo IPCA', texto: 'O valor do aluguel será reajustado anualmente pelo índice IPCA.' },
        { id: 'fb3', descricao: 'Benfeitorias e Reformas', texto: 'O locatário poderá realizar benfeitorias úteis e voluptuárias.' },
        { id: 'fb4', descricao: 'Sublocação Proibida', texto: 'É vedada a sublocação total ou parcial do imóvel.' },
        { id: 'fb5', descricao: 'Visitação para Venda', texto: 'O locador poderá visitar o imóvel para fins de venda.' },
        { id: 'fb6', descricao: 'Responsabilidade por Danos', texto: 'O locatário é responsável por todos os danos.' },
        { id: 'fb7', descricao: 'Renovação Antecipada', texto: 'A renovação poderá ser solicitada com antecedência.' },
        { id: 'fb8', descricao: 'Silêncio e Tolerância', texto: 'A tolerância não constituirá novação ou renúncia.' }
    ];
    clausulasAdicionais = [];
    console.log('⚠️ Usando cláusulas de fallback');
}

// ============================================================
// 6. RENDERIZAR CLÁUSULAS NO FORMULÁRIO
// ============================================================
function carregarClausulas() {
    const container = document.getElementById('clausulasContainer');
    if (!container) {
        console.error('❌ Elemento clausulasContainer não encontrado');
        return;
    }
    container.innerHTML = '';

    const todas = [...CLAUSULAS, ...clausulasAdicionais];
    const ids = new Set();
    const unique = [];
    for (const c of todas) {
        if (!ids.has(c.id)) {
            ids.add(c.id);
            unique.push(c);
        }
    }

    const ordenadas = unique.sort((a, b) => a.descricao.localeCompare(b.descricao));

    if (ordenadas.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">⚠️ Nenhuma cláusula disponível.</p>';
        return;
    }

    for (const c of ordenadas) {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = c.id;
        cb.id = 'claus_' + c.id;
        
        if (c.id.startsWith('fb') || (c.id.length <= 3 && c.id.startsWith('c'))) {
            cb.checked = true;
        }
        
        label.appendChild(cb);

        const span = document.createElement('span');
        span.textContent = ' ' + c.descricao;
        label.appendChild(span);

        if (clausulasAdicionais.some(ad => ad.id === c.id)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-remove-clausula';
            btn.textContent = '✕';
            btn.onclick = function(e) {
                e.stopPropagation();
                removerClausula(c.id);
            };
            label.appendChild(btn);
        }

        container.appendChild(label);
    }
    console.log(`✅ ${ordenadas.length} cláusulas renderizadas`);
}

// ============================================================
// 7. FUNÇÕES DE CLÁUSULAS
// ============================================================
function getClausulasMarcadas() {
    const checkboxes = document.querySelectorAll('#clausulasContainer input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);
    const todas = [...CLAUSULAS, ...clausulasAdicionais];
    return todas.filter(c => ids.includes(c.id));
}

function adicionarClausula() {
    const desc = document.getElementById('novaClausulaDesc').value.trim();
    const texto = document.getElementById('novaClausulaTexto').value.trim();
    if (!desc || !texto) {
        alert('Preencha a descrição e o texto da cláusula.');
        return;
    }
    const todas = [...CLAUSULAS, ...clausulasAdicionais];
    if (todas.some(c => c.descricao.toLowerCase() === desc.toLowerCase())) {
        alert('Já existe uma cláusula com esta descrição.');
        return;
    }

    const novoId = 'c' + Date.now();
    const nova = { id: novoId, descricao: desc, texto: texto };

    if (dbStatus === 'online' && supabaseClient) {
        supabaseClient
            .from('clausulas')
            .insert({ descricao: desc, texto: texto, is_padrao: false })
            .then(({ data, error }) => {
                if (error) {
                    console.error('❌ Erro ao salvar cláusula:', error);
                    alert('Erro ao salvar cláusula no Supabase.');
                } else {
                    if (data && data[0]) {
                        const idx = clausulasAdicionais.findIndex(c => c.id === novoId);
                        if (idx !== -1) {
                            clausulasAdicionais[idx].id = String(data[0].id);
                        }
                    }
                    console.log('✅ Cláusula salva no Supabase');
                }
            });
    }

    clausulasAdicionais.push(nova);
    document.getElementById('novaClausulaDesc').value = '';
    document.getElementById('novaClausulaTexto').value = '';
    carregarClausulas();
    mostrarMensagem('✓ Cláusula adicionada!', 'success');
}

function removerClausula(id) {
    if (confirm('Tem certeza que deseja remover esta cláusula?')) {
        clausulasAdicionais = clausulasAdicionais.filter(c => c.id !== id);
        if (dbStatus === 'online' && supabaseClient) {
            supabaseClient
                .from('clausulas')
                .delete()
                .eq('id', id)
                .then(({ error }) => {
                    if (error) console.error('❌ Erro ao remover cláusula:', error);
                });
        }
        carregarClausulas();
        mostrarMensagem('✓ Cláusula removida!', 'success');
    }
}

// ============================================================
// 8. BUSCAR POR CPF
// ============================================================
async function buscarPorCpf() {
    const cpfInput = document.getElementById('buscaCpf');
    if (!cpfInput) return;
    
    const cpf = cpfInput.value.trim();
    if (!cpf) {
        alert('Digite um CPF para buscar.');
        return;
    }
    const cpfLimpo = removerMascara(cpf);

    if (dbStatus === 'online' && supabaseClient) {
        try {
            mostrarMensagem('⏳ Buscando...', 'info');
            let encontrado = false;

            const { data: locador } = await supabaseClient
                .from('locadores')
                .select('*')
                .eq('cpf', cpfLimpo)
                .maybeSingle();
            if (locador) {
                preencherLocador(locador);
                encontrado = true;
                mostrarMensagem('✓ Locador encontrado!', 'success');
            }

            const { data: locatario } = await supabaseClient
                .from('locatarios')
                .select('*')
                .eq('cpf', cpfLimpo)
                .maybeSingle();
            if (locatario) {
                preencherLocatario(locatario);
                encontrado = true;
                mostrarMensagem('✓ Locatário encontrado!', 'success');
            }

            const { data: fiador } = await supabaseClient
                .from('fiadores')
                .select('*')
                .eq('cpf', cpfLimpo)
                .maybeSingle();
            if (fiador) {
                preencherFiador(fiador);
                encontrado = true;
                mostrarMensagem('✓ Fiador encontrado!', 'success');
            }

            if (!encontrado) {
                mostrarMensagem('❌ Nenhum cadastro encontrado', 'error');
                alert('Nenhum cadastro encontrado para este CPF.');
            }
        } catch (error) {
            console.error('❌ Erro na busca:', error);
            mostrarMensagem('❌ Erro na busca', 'error');
        }
    } else {
        const dados = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
        let encontrado = false;
        const locador = dados.locadores?.find(l => removerMascara(l.cpf) === cpfLimpo);
        if (locador) { preencherLocador(locador); encontrado = true; }
        const locatario = dados.locatarios?.find(l => removerMascara(l.cpf) === cpfLimpo);
        if (locatario) { preencherLocatario(locatario); encontrado = true; }
        const fiador = dados.fiadores?.find(f => removerMascara(f.cpf) === cpfLimpo);
        if (fiador) { preencherFiador(fiador); encontrado = true; }
        if (!encontrado) alert('Nenhum cadastro encontrado para este CPF.');
    }
}

// ============================================================
// 9. PREENCHER CAMPOS
// ============================================================
function preencherLocador(dados) {
    const map = {
        'locadorNome': 'nome',
        'locadorCpf': 'cpf',
        'locadorRg': 'rg',
        'locadorNacionalidade': 'nacionalidade',
        'locadorProfissao': 'profissao',
        'locadorEnd': 'endereco',
        'locadorTel': 'telefone',
        'locadorEmail': 'email'
    };
    for (const [id, key] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = dados[key] || '';
    }
    const ec = document.getElementById('locadorEstadoCivil');
    if (ec && dados.estado_civil) ec.value = dados.estado_civil;
    atualizarNumeroContratoAutomatico(true);
}

function preencherLocatario(dados) {
    const map = {
        'locatarioNome': 'nome',
        'locatarioCpf': 'cpf',
        'locatarioRg': 'rg',
        'locatarioNacionalidade': 'nacionalidade',
        'locatarioProfissao': 'profissao',
        'locatarioEnd': 'endereco',
        'locatarioTel': 'telefone',
        'locatarioEmail': 'email'
    };
    for (const [id, key] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = dados[key] || '';
    }
    const ec = document.getElementById('locatarioEstadoCivil');
    if (ec && dados.estado_civil) ec.value = dados.estado_civil;
    atualizarNumeroContratoAutomatico(true);
}

function preencherFiador(dados) {
    const map = {
        'fiadorNome': 'nome',
        'fiadorCpf': 'cpf',
        'fiadorRg': 'rg',
        'fiadorNacionalidade': 'nacionalidade',
        'fiadorProfissao': 'profissao',
        'fiadorEnd': 'endereco',
        'fiadorTel': 'telefone',
        'fiadorEmail': 'email',
        'fiadorConjugeNome': 'conjuge_nome',
        'fiadorConjugeCpf': 'conjuge_cpf',
        'fiadorConjugeRg': 'conjuge_rg'
    };
    for (const [id, key] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = dados[key] || '';
    }
    const ec = document.getElementById('fiadorEstadoCivil');
    if (ec && dados.estado_civil) ec.value = dados.estado_civil;
}

function selecionarImovelPorDropdown(valor) {
    const campos = [
        'imovelEnd',
        'imovelRegistro',
        'imovelCartorio',
        'imovelInscricaoMunicipal',
        'imovelTipo',
        'imovelDestinacao'
    ];

    if (!valor) {
        campos.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = id === 'imovelDestinacao' ? 'Residencial' : '';
        });
        return;
    }

    const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    const imovel = (db.imoveis || []).find((item) => item.endereco === valor);
    if (!imovel) return;

    const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v || '';
    };

    setVal('imovelEnd', imovel.endereco);
    setVal('imovelRegistro', imovel.registro);
    setVal('imovelCartorio', imovel.cartorio);
    setVal('imovelInscricaoMunicipal', imovel.inscricaoMunicipal || imovel.inscricao_municipal);
    setVal('imovelTipo', imovel.tipo);
    setVal('imovelDestinacao', imovel.destinacao || 'Residencial');
}

// ============================================================
// 10. OBTER DADOS DO FORMULÁRIO
// ============================================================
function getDadosFormulario() {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };                 
    const getSelect = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    
    return {
        numContrato: getVal('numContrato'),
        dataInicio: getVal('dataInicio'),
        dataValidade: getVal('dataValidade'),
        dataElaboracao: getVal('dataElaboracao') || 'não informado',
        prazoContrato: getVal('prazoContrato') || '12 Meses',
        foroCidade: getVal('foroCidade') || 'São Paulo',
        locador: {
            nome: getVal('locadorNome') || 'não informado',
            nacionalidade: getVal('locadorNacionalidade') || 'brasileiro',
            estadoCivil: getSelect('locadorEstadoCivil') || 'solteiro',
            profissao: getVal('locadorProfissao') || 'não informada',
            rg: getVal('locadorRg') || 'não informado',
            cpf: getVal('locadorCpf') || 'não informado',
            endereco: getVal('locadorEnd') || 'não informado',
            telefone: getVal('locadorTel') || 'não informado',
            email: getVal('locadorEmail') || 'não informado'
        },
        locatario: {
            nome: getVal('locatarioNome') || 'não informado',
            nacionalidade: getVal('locatarioNacionalidade') || 'não informado',
            estadoCivil: getSelect('locatarioEstadoCivil') || 'não informado',
            profissao: getVal('locatarioProfissao') || 'não informada',
            rg: getVal('locatarioRg') || 'não informado',
            cpf: getVal('locatarioCpf') || 'não informado',
            endereco: getVal('locatarioEnd') || 'não informado',
            telefone: getVal('locatarioTel') || 'não informado',
            email: getVal('locatarioEmail') || 'não informado'
        },
        fiador: {
            nome: getVal('fiadorNome') || 'não informado',
            nacionalidade: getVal('fiadorNacionalidade') || 'não informado',
            estadoCivil: getSelect('fiadorEstadoCivil') || 'solteiro',
            profissao: getVal('fiadorProfissao') || 'não informada',
            rg: getVal('fiadorRg') || 'não informado',
            cpf: getVal('fiadorCpf') || 'não informado',
            endereco: getVal('fiadorEnd') || 'não informado',
            telefone: getVal('fiadorTel') || 'não informado',
            email: getVal('fiadorEmail') || 'não informado',
            conjugeNome: getVal('fiadorConjugeNome'),
            conjugeCpf: getVal('fiadorConjugeCpf'),
            conjugeRg: getVal('fiadorConjugeRg')
        },
        imovel: {
            endereco: getVal('imovelEnd'),
            registro: getVal('imovelRegistro'),
            cartorio: getVal('imovelCartorio'),
            inscricaoMunicipal: getVal('imovelInscricaoMunicipal'),
            tipo: getSelect('imovelTipo'),
            destinacao: getSelect('imovelDestinacao') || 'Residencial',
            quartos: getVal('imovelQuartos'),
            banheiros: getVal('imovelBanheiros'),
            vagas: getVal('imovelVagas'),
            metragem: getVal('imovelMetragem'),
            areaPrivativa: getVal('imovelAreaPrivativa'),
            areaComum: getVal('imovelAreaComum'),
            caracteristicas: getVal('imovelCaracteristicas'),
            inicio: getVal('imovelInicio'),
            fim: getVal('imovelFim'),
            renovacao: getSelect('imovelRenovacao'),
            valor: getVal('imovelValor'),
            vencimento: getSelect('imovelVencimento'),
            pagamento: getSelect('imovelPagamento'),
            indice: getSelect('imovelIndice'),
            periodicidade: getSelect('imovelPeriodicidade')
        },
        encargos: {
            iptu: getSelect('iptuResponsavel'),
            condominio: getSelect('condominioResponsavel'),
            agua: getSelect('aguaResponsavel'),
            luz: getSelect('luzResponsavel'),
            gas: getSelect('gasResponsavel'),
            seguro: getSelect('seguroResponsavel')
        },
        garantia: {
            modalidade: getSelect('garantiaModalidade'),
            caucaoValor: getVal('caucaoValor'),
            seguradora: getVal('seguroSeguradora'),
            apolice: getVal('seguroApolice')
        },
        multas: {
            atraso: getVal('multaAtraso') || '2',
            juros: getVal('jurosMora') || '1',
            rescisoria: getSelect('multaRescisoria') || '3'
        },
        vistoria: {
            observacoes: getVal('vistoriaObservacoes'),
            data: getVal('vistoriaData'),
            laudo: getSelect('vistoriaLaudo')
        }
    };
}

// ============================================================
// 11. SALVAR DADOS
// ============================================================
async function salvarTodosDados() {
    const dados = getDadosFormulario();
    
    if (!dados.imovel.valor || dados.imovel.valor === '') {
        alert("O campo Valor do Imóvel é obrigatório. Por favor, preencha com um valor.");
        return;
    }
    
    if (!dados.imovel.endereco) {
        alert("O campo Endereço do Imóvel é obrigatório.");
        return;
    }
             await registrarContratoNoHistorico(dados);
    
    if (dbStatus === 'online' && supabaseClient) {
        try {
            mostrarMensagem('📦 Salvando...', 'info');
            let salvos = 0;

            if (dados.locador.nome && dados.locador.cpf) {
                const { error } = await supabaseClient.from('locadores').upsert({
                    nome: dados.locador.nome,
                    cpf: removerMascara(dados.locador.cpf),
                    rg: dados.locador.rg,
                    nacionalidade: dados.locador.nacionalidade,
                    estado_civil: dados.locador.estadoCivil,
                    profissao: dados.locador.profissao,
                    endereco: dados.locador.endereco,
                    telefone: dados.locador.telefone,
                    email: dados.locador.email
                }, { onConflict: 'cpf' });
                if (!error) salvos++;
            }

            if (dados.locatario.nome && dados.locatario.cpf) {
                const { error } = await supabaseClient.from('locatarios').upsert({
                    nome: dados.locatario.nome,
                    cpf: removerMascara(dados.locatario.cpf),
                    rg: dados.locatario.rg,
                    nacionalidade: dados.locatario.nacionalidade,
                    estado_civil: dados.locatario.estadoCivil,
                    profissao: dados.locatario.profissao,
                    endereco: dados.locatario.endereco,
                    telefone: dados.locatario.telefone,
                    email: dados.locatario.email
                }, { onConflict: 'cpf' });
                if (!error) salvos++;
            }

            if (dados.fiador.nome && dados.fiador.cpf) {
                const { error } = await supabaseClient.from('fiadores').upsert({
                    nome: dados.fiador.nome,
                    cpf: removerMascara(dados.fiador.cpf),
                    rg: dados.fiador.rg,
                    nacionalidade: dados.fiador.nacionalidade,
                    estado_civil: dados.fiador.estadoCivil,
                    profissao: dados.fiador.profissao,
                    endereco: dados.fiador.endereco,
                    telefone: dados.fiador.telefone,
                    email: dados.fiador.email,
                    conjuge_nome: dados.fiador.conjugeNome,
                    conjuge_cpf: dados.fiador.conjugeCpf,
                    conjuge_rg: dados.fiador.conjugeRg
                }, { onConflict: 'cpf' });
                if (!error) salvos++;
            }

            if (dados.imovel.endereco) {
                const { error } = await supabaseClient.from('imoveis').upsert({
                    endereco: dados.imovel.endereco,
                    registro: dados.imovel.registro,
                    cartorio: dados.imovel.cartorio,
                    inscricao_municipal: dados.imovel.inscricaoMunicipal,
                    tipo: dados.imovel.tipo,
                    destinacao: dados.imovel.destinacao,
                    quartos: dados.imovel.quartos,
                    banheiros: dados.imovel.banheiros,
                    vagas: dados.imovel.vagas,
                    metragem: dados.imovel.metragem,
                    area_privativa: dados.imovel.areaPrivativa,
                    area_comum: dados.imovel.areaComum,
                    caracteristicas: dados.imovel.caracteristicas
                }, { onConflict: 'endereco' });
                if (!error) salvos++;
            }

            mostrarMensagem(`✓ ${salvos} registros salvos!`, 'success');
        } catch (error) {
            console.error('❌ Erro ao salvar:', error);
            mostrarMensagem('❌ Erro ao salvar', 'error');
            alert('Erro ao salvar: ' + error.message);
        }
    } else {
        salvarDadosOffline(dados);
    }
}

function salvarDadosOffline(dados) {
    let db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    if (!db.locadores) db.locadores = [];
    if (!db.locatarios) db.locatarios = [];
    if (!db.fiadores) db.fiadores = [];
    if (!db.imoveis) db.imoveis = [];

    if (dados.locador.nome && dados.locador.cpf) {
        const idx = db.locadores.findIndex(l => removerMascara(l.cpf) === removerMascara(dados.locador.cpf));
        const obj = { 
            nome: dados.locador.nome, 
            cpf: dados.locador.cpf, 
            rg: dados.locador.rg, 
            nacionalidade: dados.locador.nacionalidade, 
            estadoCivil: dados.locador.estadoCivil, 
            profissao: dados.locador.profissao, 
            endereco: dados.locador.endereco, 
            telefone: dados.locador.telefone, 
            email: dados.locador.email 
        };
        if (idx >= 0) db.locadores[idx] = obj;
        else db.locadores.push(obj);
    }

    if (dados.locatario.nome && dados.locatario.cpf) {
        const idx = db.locatarios.findIndex(l => removerMascara(l.cpf) === removerMascara(dados.locatario.cpf));
        const obj = { 
            nome: dados.locatario.nome, 
            cpf: dados.locatario.cpf, 
            rg: dados.locatario.rg, 
            nacionalidade: dados.locatario.nacionalidade, 
            estadoCivil: dados.locatario.estadoCivil, 
            profissao: dados.locatario.profissao, 
            endereco: dados.locatario.endereco, 
            telefone: dados.locatario.telefone, 
            email: dados.locatario.email 
        };
        if (idx >= 0) db.locatarios[idx] = obj;
        else db.locatarios.push(obj);
    }

    if (dados.fiador.nome && dados.fiador.cpf) {
        const idx = db.fiadores.findIndex(f => removerMascara(f.cpf) === removerMascara(dados.fiador.cpf));
        const obj = { 
            nome: dados.fiador.nome, 
            cpf: dados.fiador.cpf, 
            rg: dados.fiador.rg, 
            nacionalidade: dados.fiador.nacionalidade, 
            estadoCivil: dados.fiador.estadoCivil, 
            profissao: dados.fiador.profissao, 
            endereco: dados.fiador.endereco, 
            telefone: dados.fiador.telefone, 
            email: dados.fiador.email,
            conjuge_nome: dados.fiador.conjugeNome,
            conjuge_cpf: dados.fiador.conjugeCpf,
            conjuge_rg: dados.fiador.conjugeRg
        };
        if (idx >= 0) db.fiadores[idx] = obj;
        else db.fiadores.push(obj);
    }

    if (dados.imovel.endereco) {
        const idx = db.imoveis.findIndex(i => i.endereco === dados.imovel.endereco);
        const obj = { 
            endereco: dados.imovel.endereco,
            registro: dados.imovel.registro,
            cartorio: dados.imovel.cartorio,
            inscricaoMunicipal: dados.imovel.inscricaoMunicipal,
            tipo: dados.imovel.tipo,
            destinacao: dados.imovel.destinacao,
            quartos: dados.imovel.quartos,
            banheiros: dados.imovel.banheiros,
            vagas: dados.imovel.vagas,
            metragem: dados.imovel.metragem,
            areaPrivativa: dados.imovel.areaPrivativa,
            areaComum: dados.imovel.areaComum,
            caracteristicas: dados.imovel.caracteristicas
        };
        if (idx >= 0) db.imoveis[idx] = obj;
        else db.imoveis.push(obj);
    }

    localStorage.setItem('contratos_db_offline', JSON.stringify(db));
    mostrarMensagem('✓ Dados salvos localmente!', 'success');
}

// ============================================================
// 12. FORMATAR DATA E OUTROS
// ============================================================
//function formatarData(dataStr) {
//    if (!dataStr) return 'a definir';
//    const partes = dataStr.split('-');
//    return `${partes[2]}/${partes[1]}/${partes[0]}`;
//}

function formatarData(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return 'a definir';
    const partes = dataStr.trim().split('-');
    if (partes.length !== 3 || !partes[0] || !partes[1] || !partes[2]) {
        return dataStr;
    }
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}



function numeroPorExtenso(num) {
    const numeros = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez',
        'onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove','vinte',
        'vinte e um','vinte e dois','vinte e três','vinte e quatro','vinte e cinco','vinte e seis',
        'vinte e sete','vinte e oito','vinte e nove','trinta','trinta e um','trinta e dois',
        'trinta e três','trinta e quatro','trinta e cinco','trinta e seis','trinta e sete',
        'trinta e oito','trinta e nove','quarenta','quarenta e um','quarenta e dois','quarenta e três',
        'quarenta e quatro','quarenta e cinco','quarenta e seis','quarenta e sete','quarenta e oito',
        'quarenta e nove','cinquenta','cinquenta e um','cinquenta e dois','cinquenta e três',
        'cinquenta e quatro','cinquenta e cinco','cinquenta e seis','cinquenta e sete',
        'cinquenta e oito','cinquenta e nove','sessenta'];
    return numeros[num] || num;
}

function valorPorExtenso(valor) {
    if (!valor) return 'não informado';
    const partes = valor.split(',');
    const reais = parseInt(partes[0]) || 0;
    const centavos = parseInt(partes[1]) || 0;
    let extenso = '';
    if (reais === 1) extenso = 'um real';
    else if (reais > 1) extenso = numeroPorExtenso(reais) + ' reais';
    if (centavos > 0) {
        if (extenso) extenso += ' e ';
        if (centavos === 1) extenso += 'um centavo';
        else extenso += numeroPorExtenso(centavos) + ' centavos';
    }
    return extenso || 'zero reais';
}

// ============================================================
// 13. GERAR PRÉVIA E PDF
// ============================================================
function escaparHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');
}

function calcularDuracaoExtenso(inicioISO, fimISO) {
    if (!inicioISO || !fimISO) return '';

    const [anoIni, mesIni, diaIni] = inicioISO.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = fimISO.split('-').map(Number);

    if (!anoIni || !mesIni || !diaIni || !anoFim || !mesFim || !diaFim) return '';

    const dataIni = new Date(anoIni, mesIni - 1, diaIni);
    const dataFim = new Date(anoFim, mesFim - 1, diaFim);

    if (dataFim < dataIni) return '';

    let anos = anoFim - anoIni;
    let meses = mesFim - mesIni;
    let dias = diaFim - diaIni;

    if (dias < 0) {
        meses -= 1;
        const ultimoDiaMesAnterior = new Date(anoFim, mesFim - 1, 0).getDate();
        dias += ultimoDiaMesAnterior;
    }

    if (meses < 0) {
        anos -= 1;
        meses += 12;
    }

    const partes = [];
    if (anos > 0) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`);
    if (dias > 0) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);

    if (partes.length === 0) return '0 dias';
    if (partes.length === 1) return partes[0];
    if (partes.length === 2) return `${partes[0]} e ${partes[1]}`;
    return `${partes[0]}, ${partes[1]} e ${partes[2]}`;
}
function montarContrato(dados, clausulas) {
    const d = dados || {};
    const l = d.locador || {};
    const lt = d.locatario || {};
    const f = d.fiador || {};
    const i = d.imovel || {};
    const e = d.encargos || {};
    const g = d.garantia || {};
    const m = d.multas || {};
    const v = d.vistoria || {};
    const listaClausulas = Array.isArray(clausulas) ? clausulas : [];

    const numContrato = d.numContrato || 'NÃO INFORMADO';
    const dataElab = d.dataElaboracao ? formatarData(d.dataElaboracao) : 'Data não informada';
    const prazo = d.prazoContrato || '12';
    const prazoExtenso = numeroPorExtenso(parseInt(prazo, 10) || 12);
    const valorExtenso = valorPorExtenso(i.valor);
    const foro = d.foroCidade || 'São Paulo';
    const inicioFormatado = i.inicio ? formatarData(i.inicio) : 'a definir';
    const fimFormatado = i.fim ? formatarData(i.fim) : 'a definir';
    const obsAcordo = (document.getElementById('observacoesAcordoPartes')?.value || '').trim();
    const formatarDataSeguro = (valor) => {
        if (!valor) return '';
        if (typeof formatarData === 'function') return formatarData(valor);
        if (valor.includes('-')) {
            const [ano, mes, dia] = valor.split('-');
            return `${dia}/${mes}/${ano}`;
        }
        return valor;
    };
    
    const marcadorDataPendente = '??/??/????';
    const inicioValidadeBR = formatarDataSeguro(d.dataInicio) || marcadorDataPendente;
    const fimValidadeBR = formatarDataSeguro(d.dataValidade) || marcadorDataPendente;

    const duracaoTexto = (d.dataInicio && d.dataValidade && typeof calcularDuracaoExtenso === 'function')
    ? calcularDuracaoExtenso(d.dataInicio, d.dataValidade)
    : '';

    const textoValidadeContrato = duracaoTexto
    ? `De ${inicioValidadeBR} a ${fimValidadeBR} (${duracaoTexto})`
    : `De ${inicioValidadeBR} a ${fimValidadeBR}`;

    let html = `
        <div class="doc-titulo">*** CONTRATO DE LOCAÇÃO DE IMÓVEL ***</div>

        <div class="doc-meta">
            <div><strong>CONTRATO Nº:</strong> ${escaparHtml(numContrato)}</div>
            <div><strong>VALIDADE DO CONTRATO:</strong> ${textoValidadeContrato}</div>
        </div>

        <hr class="doc-divisor" />

        <div class="doc-lei">
    Este contrato segue as normas da Lei do Inquilinato (Lei nº 8.245/91) e demais disposições do Código Civil Brasileiro.<br />
    Para consulta das partes, acesse: www.contratos-aluguel.com.br/consulta<br />
    <div class="doc-aviso-importante">
        <div class="doc-aviso-titulo">IMPORTANTE:</div>
        <ul class="doc-aviso-lista">
            <li><strong>Autenticação em Cartório:</strong><br>
            Ainda que a assinatura já gere obrigação e seriedade entre as partes, 
            este documento deverá ser autenticado em cartório para reforçar a autenticidade das assinaturas e 
            garantir maior segurança jurídica e força probatória; não deixe de realizar.
            </li>
            <li>
            <strong>Assessoria Jurídica:</strong><br>
            As partes envolvidas, se quiserem, podem — e é até recomendado — 
            levar este documento para análise prévia por um advogado do setor imobiliário antes de firmá-lo.
            </li>
        </ul>
    </div>
</div>

        <hr class="doc-divisor" />

        <div class="doc-secao">1. QUALIFICAÇÃO DAS PARTES</div>
        <p class="doc-paragrafo">
            <strong>LOCADOR (PROPRIETÁRIO):</strong> ${escaparHtml(l.nome || 'NÃO INFORMADO')},
            nacionalidade ${escaparHtml(l.nacionalidade || 'brasileiro')}, estado civil ${escaparHtml(l.estadoCivil || 'não informado')},
            profissão ${escaparHtml(l.profissao || 'não informada')}, portador(a) do RG nº ${escaparHtml(l.rg || 'não informado')} e
            inscrito(a) no CPF sob o nº ${escaparHtml(l.cpf || 'NÃO INFORMADO')}, residente e domiciliado(a) em
            ${escaparHtml(l.endereco || 'não informado')}, telefone ${escaparHtml(l.telefone || 'não informado')} e e-mail ${escaparHtml(l.email || 'não informado')}.
        </p>
        <p class="doc-paragrafo">
            <strong>LOCATÁRIO (INQUILINO):</strong> ${escaparHtml(lt.nome || 'NÃO INFORMADO')},
            nacionalidade ${escaparHtml(lt.nacionalidade || 'brasileiro')}, estado civil ${escaparHtml(lt.estadoCivil || 'não informado')},
            profissão ${escaparHtml(lt.profissao || 'não informada')}, portador(a) do RG nº ${escaparHtml(lt.rg || 'não informado')} e
            inscrito(a) no CPF sob o nº ${escaparHtml(lt.cpf || 'NÃO INFORMADO')}, residente e domiciliado(a) em
            ${escaparHtml(lt.endereco || 'não informado')}, telefone ${escaparHtml(lt.telefone || 'não informado')} e e-mail ${escaparHtml(lt.email || 'não informado')}.
        </p>
    `;

    if (f && f.nome) {
        html += `
        <p class="doc-paragrafo">
            <strong>FIADOR:</strong> ${escaparHtml(f.nome)},
            nacionalidade ${escaparHtml(f.nacionalidade || 'brasileiro')}, estado civil ${escaparHtml(f.estadoCivil || 'não informado')},
            profissão ${escaparHtml(f.profissao || 'não informada')}, portador(a) do RG nº ${escaparHtml(f.rg || 'não informado')} e
            inscrito(a) no CPF sob o nº ${escaparHtml(f.cpf || 'não informado')}, residente e domiciliado(a) em
            ${escaparHtml(f.endereco || 'não informado')}, telefone ${escaparHtml(f.telefone || 'não informado')} e e-mail ${escaparHtml(f.email || 'não informado')}${
                f.conjugeNome
                    ? `, com anuência de seu cônjuge ${escaparHtml(f.conjugeNome)}, CPF nº ${escaparHtml(f.conjugeCpf || 'N/A')}, RG nº ${escaparHtml(f.conjugeRg || 'N/A')}`
                    : ''
            }.
        </p>`;
    }

    const detalhesImovel = [
        i.registro ? `Registro no Cartório de Imóveis: ${escaparHtml(i.registro)}` : '',
        i.cartorio ? `Cartório: ${escaparHtml(i.cartorio)}` : '',
        i.inscricaoMunicipal ? `Inscrição Municipal / IPTU: ${escaparHtml(i.inscricaoMunicipal)}` : '',
        i.tipo ? `Tipo: ${escaparHtml(i.tipo)}` : '',
        i.destinacao ? `Destinação: ${escaparHtml(i.destinacao)}` : '',
        i.quartos ? `Quartos: ${escaparHtml(i.quartos)}` : '',
        i.banheiros ? `Banheiros: ${escaparHtml(i.banheiros)}` : '',
        i.vagas ? `Vagas de Garagem: ${escaparHtml(i.vagas)}` : '',
        i.metragem ? `Metragem Total: ${escaparHtml(i.metragem)} m²` : '',
        i.areaPrivativa ? `Área Privativa: ${escaparHtml(i.areaPrivativa)} m²` : '',
        i.areaComum ? `Área Comum: ${escaparHtml(i.areaComum)} m²` : '',
        i.caracteristicas ? `Características do Imóvel: ${escaparHtml(i.caracteristicas)}` : ''
    ].filter(Boolean).join('; ');

    html += `
        <hr class="doc-divisor" />
        <div class="doc-secao">2. OBJETO DO CONTRATO</div>
        <p class="doc-paragrafo">
            O presente contrato tem como objeto a locação do imóvel situado em <strong>${escaparHtml(i.endereco || 'NÃO INFORMADO')}</strong>${
                detalhesImovel ? ` (${detalhesImovel})` : ''
            }. O imóvel destina-se exclusivamente ao uso <strong>${escaparHtml(i.destinacao ? i.destinacao.toLowerCase() : 'residencial')}</strong>.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">3. PRAZO DA LOCAÇÃO</div>
        <p class="doc-paragrafo">
            O prazo da presente locação é de <strong>${escaparHtml(prazo)} (${escaparHtml(prazoExtenso)}) meses</strong>,
            iniciando-se em <strong>${escaparHtml(inicioFormatado)}</strong> e terminando em <strong>${escaparHtml(fimFormatado)}</strong>.
            Renovação: ${i.renovacao === 'sim' ? 'Automática, salvo manifestação contrária das partes' : 'Dependerá de termo aditivo firmado entre as partes'}.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">4. VALOR, FORMA DE PAGAMENTO E REAJUSTE</div>
        <p class="doc-paragrafo">
            O valor mensal do aluguel convencionado é de <strong>R$ ${escaparHtml(i.valor || '0,00')} (${escaparHtml(valorExtenso)})</strong>,
            com vencimento todo <strong>dia ${escaparHtml(i.vencimento || '5')}</strong> de cada mês, a ser pago mediante
            <strong>${escaparHtml(i.pagamento || 'PIX')}</strong>. O valor será reajustado a cada
            <strong>${escaparHtml(i.periodicidade || '12')} meses</strong> pelo índice <strong>${escaparHtml(i.indice || 'IPCA')}</strong>.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">5. ENCARGOS E TRIBUTOS</div>
        <p class="doc-paragrafo">
            Ficam definidas as seguintes responsabilidades sobre os encargos incidentes no imóvel:
            <strong>IPTU:</strong> ${escaparHtml(e.iptu || 'Locador')};
            <strong>Condomínio:</strong> ${escaparHtml(e.condominio || 'Locatário')};
            <strong>Água:</strong> ${escaparHtml(e.agua || 'Locatário')};
            <strong>Luz / Energia Elétrica:</strong> ${escaparHtml(e.luz || 'Locatário')};
            <strong>Gás:</strong> ${escaparHtml(e.gas || 'Locatário')};
            <strong>Seguro Incêndio:</strong> ${escaparHtml(e.seguro || 'Locador')}.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">6. GARANTIAS LOCATÍCIAS</div>
        <p class="doc-paragrafo">
            Modalidade de garantia escolhida: <strong>${escaparHtml(g.modalidade || 'Fiança')}</strong>${
                g.modalidade === 'Caucao' && g.caucaoValor ? `, no valor de R$ ${escaparHtml(g.caucaoValor)}` : ''
            }${
                g.modalidade === 'Seguro Fiança'
                    ? `${g.seguradora ? `, Seguradora: ${escaparHtml(g.seguradora)}` : ''}${g.apolice ? `, Apólice nº ${escaparHtml(g.apolice)}` : ''}`
                    : ''
            }.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">7. MULTAS E RESCISÃO</div>
        <p class="doc-paragrafo">
            Em caso de atraso no pagamento, incidirá multa moratória de <strong>${escaparHtml(m.atraso || '2')}%</strong>,
            acrescida de juros de mora de <strong>${escaparHtml(m.juros || '1')}% ao mês</strong>. Em caso de rescisão antecipada,
            aplicar-se-á multa rescisória proporcional equivalente a <strong>${escaparHtml(m.rescisoria || '3')} meses</strong> de aluguel.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">8. VISTORIA</div>
        <p class="doc-paragrafo">
            O Laudo de Vistoria Inicial é parte integrante deste contrato${
                v.data ? `, realizado em ${escaparHtml(formatarData(v.data))}` : ''
            } (${v.laudo === 'sim' ? 'anexado ao instrumento' : 'a ser realizado e anexado posteriormente'}).${
                v.observacoes ? ` Observações da vistoria: ${escaparHtml(v.observacoes)}.` : ''
            }
        </p>
    `;

    html += `<hr class="doc-divisor" /><div class="doc-secao">9. CLÁUSULAS ADICIONAIS E ACORDOS</div>`;

    if (listaClausulas.length > 0) {
        listaClausulas.forEach((c, idx) => {
            html += `<p class="doc-paragrafo"><strong>Cláusula ${idx + 1} (${escaparHtml(c.descricao)}):</strong> ${escaparHtml(c.texto)}</p>`;
        });
    } else {
        html += `<p class="doc-paragrafo">Nenhuma cláusula adicional selecionada.</p>`;
    }

    if (obsAcordo) {
        html += `<p class="doc-paragrafo"><strong>Acordo / Observações entre as Partes:</strong> ${escaparHtml(obsAcordo)}</p>`;
    }

    html += `
        <hr class="doc-divisor" />
        <p class="doc-fechamento">
            Estando assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas, elegendo o foro da comarca de <strong>${escaparHtml(foro)}</strong> para dirimir quaisquer dúvidas oriundas deste contrato.
        </p>

        <div class="doc-local-data">${escaparHtml(foro)}, ${escaparHtml(dataElab)}.</div>

        <div class="doc-assinaturas">
            <div class="doc-assinatura-item">Assinatura do LOCADOR</div>
            <div class="doc-assinatura-item">Assinatura do LOCATÁRIO</div>
            ${f && f.nome ? '<div class="doc-assinatura-item">Assinatura do FIADOR</div>' : ''}
            <div class="doc-assinatura-item">1ª Testemunha</div>
            <div class="doc-assinatura-item">2ª Testemunha</div>
        </div>

        <hr class="doc-divisor" />
        <div class="doc-rodape-lei">Documento elaborado em conformidade com a Lei nº 8.245/91.</div>
    `;

    return html;
}

function gerarPrevia() {
    const previaDiv = document.getElementById('previa') || document.querySelector('.previa');
    const areaImprimir = document.getElementById('acaoImprimirPrevia');
    if (!previaDiv) return;

    try {
        const dados = typeof getDadosFormulario === 'function' ? getDadosFormulario() : {};
        const clausulas = typeof getClausulasMarcadas === 'function' ? getClausulasMarcadas() : [];
        previaDiv.innerHTML = montarContrato(dados, clausulas);
    } catch (err) {
        console.error('Erro ao montar prévia:', err);
        previaDiv.innerHTML = montarContrato({}, []);
    }

    previaDiv.classList.add('visivel');
    if (areaImprimir) {
        areaImprimir.style.display = 'flex';
    }

    previaDiv.scrollIntoView({ behavior: 'smooth' });
    if (typeof mostrarMensagem === 'function') {
        mostrarMensagem('✓ Prévia gerada!', 'success');
    }
}

function imprimirPreviaLimpa() {
    const previaDiv = document.getElementById('previa') || document.querySelector('.previa');
    if (!previaDiv || !previaDiv.classList.contains('visivel') || !previaDiv.innerHTML.trim()) {
        alert('⚠️ Clique primeiro em "Visualizar Contrato" para gerar a prévia.');
        return;
    }

    // Coleta os estilos da página (incluindo .doc-titulo, .doc-meta, .doc-secao, etc.)
    const estilosAtuais = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(function (el) { return el.outerHTML; })
        .join('\n');

    const janelaImpressao = window.open('', '_blank', 'width=900,height=700');
    if (!janelaImpressao) {
        alert('⚠️ Permita pop-ups no navegador para abrir a tela de impressão.');
        return;
    }

    janelaImpressao.document.open();
    janelaImpressao.document.write(
        '<!DOCTYPE html>' +
        '<html lang="pt-BR">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<title>Contrato de Locação</title>' +
        estilosAtuais +
        '<style>' +
        '@page { size: A4; margin: 14mm; }' +
        'body { background: #ffffff !important; color: #111827 !important; margin: 0 !important; padding: 0 !important; }' +
        '.container { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; background: #ffffff !important; }' +
        '.previa, #previa { display: block !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; background: #ffffff !important; color: #111827 !important; }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<div id="previa" class="previa visivel">' + previaDiv.innerHTML + '</div>' +
        '<script>' +
        'window.onload = function() {' +
        '  setTimeout(function() { window.print(); }, 200);' +
        '};' +
        '</script>' +
        '</body>' +
        '</html>'
    );
    janelaImpressao.document.close();
}

   function gerarPDF() {
      const loading = document.getElementById('loading');
      const elementoPrevia = document.getElementById('previa') || document.querySelector('.previa');

    if (!elementoPrevia) {
        alert('⚠️ Área de prévia (#previa) não encontrada na página.');
     //   return;
    }

    try {
        if (loading) loading.classList.add('ativo');

        let conteudoAtual = elementoPrevia.innerHTML ? elementoPrevia.innerHTML.trim() : '';

        // Se ainda não houver conteúdo na prévia, monta agora
        if (!conteudoAtual) {
            const dados = typeof getDadosFormulario === 'function' ? getDadosFormulario() : {};
            const clausulas = typeof getClausulasMarcadas === 'function' ? getClausulasMarcadas() : [];

            if (typeof montarContrato === 'function') {
                conteudoAtual = montarContrato(dados, clausulas) || '';
            }
        }

        // Garantia final para nunca sair página em branco
        if (!conteudoAtual.trim()) {
            conteudoAtual = '<div class="doc-titulo">*** CONTRATO DE LOCAÇÃO DE IMÓVEL ***</div><p class="doc-paragrafo">Preencha os dados do formulário e clique em Visualizar Contrato.</p>';
        }

        elementoPrevia.innerHTML = conteudoAtual;
        elementoPrevia.classList.add('visivel');

        setTimeout(function () {
            window.print();
            if (loading) loading.classList.remove('ativo');
            if (typeof mostrarMensagem === 'function') {
                mostrarMensagem('✅ Janela de impressão / PDF aberta!', 'success');
            }
        }, 150);
    }
    catch (error) {
        console.error('❌ Erro ao imprimir:', error);
        if (loading) loading.classList.remove('ativo');
        alert('❌ Erro ao preparar impressão: ' + error.message);
    }
}

// ============================================================
// 14. GERENCIADOR
// ============================================================
async function abrirGerenciador() {
    const modal = document.getElementById('modalGerenciador');
    if (modal) modal.classList.add('ativo');
    
    const conteudo = document.getElementById('conteudoGerenciador');
    if (!conteudo) return;
    
    if (dbStatus === 'online' && supabaseClient) {
        try {
            const html = [];
            const tables = ['locadores', 'locatarios', 'fiadores', 'imoveis'];
            for (const table of tables) {
                const { data } = await supabaseClient.from(table).select('*').order('id');
                html.push(`<h3>👤 ${table.charAt(0).toUpperCase()+table.slice(1)} (${data?.length||0})</h3>`);
                if (data && data.length) {
                    html.push('<table class="tabela-dados"><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Ações</th></tr>');
                    data.forEach(item => {
                        html.push(`<tr><td>${item.nome}</td><td>${item.cpf}</td><td>${item.telefone||'-'}</td>
                            <td><button class="btn-excluir" onclick="excluirRegistroOnline('${table}', ${item.id})">✕</button></td></tr>`);
                    });
                    html.push('</table>');
                } else {
                    html.push('<p>Nenhum registro.</p>');
                }
            }
            conteudo.innerHTML = html.join('');
        } catch (e) {
            conteudo.innerHTML = '<p>❌ Erro ao carregar dados</p>';
        }
    } else {
        const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
        let html = `<h3>👤 Locadores (${db.locadores?.length||0})</h3>`;
        if (db.locadores?.length) {
            html += '<table class="tabela-dados"><tr><th>Nome</th><th>CPF</th><th>Telefone</th></tr>';
            db.locadores.forEach(l => html += `<tr><td>${l.nome}</td><td>${l.cpf}</td><td>${l.telefone||'-'}</td></tr>`);
            html += '</table>';
        } else {
            html += '<p>Nenhum locador.</p>';
        }
        conteudo.innerHTML = html;
    }
}

function fecharGerenciador() {
    const modal = document.getElementById('modalGerenciador');
    if (modal) modal.classList.remove('ativo');
}

async function excluirRegistroOnline(tabela, id) {
    if (confirm('Excluir este registro?')) {
        const { error } = await supabaseClient.from(tabela).delete().eq('id', id);
        if (!error) {
            mostrarMensagem('✓ Registro excluído!', 'success');
            abrirGerenciador();
        }
    }
}

// ============================================================
// 15. EXPORTAÇÃO, IMPORTAÇÃO E LIMPEZA
// ============================================================
function exportarDados() {
    alert('Função exportar dados em desenvolvimento');
}

function importarDados() {
    alert('Função importar dados em desenvolvimento');
}

async function limparTodosDados() {
    if (!confirm('⚠️ Apagar TODOS os dados?')) return;
    if (dbStatus === 'online' && supabaseClient) {
        await supabaseClient.from('locadores').delete().neq('id', 0);
        await supabaseClient.from('locatarios').delete().neq('id', 0);
        await supabaseClient.from('fiadores').delete().neq('id', 0);
        await supabaseClient.from('imoveis').delete().neq('id', 0);
        await supabaseClient.from('clausulas').delete().neq('id', 0);
        mostrarMensagem('🗑️ Todos os dados removidos!', 'success');
        abrirGerenciador();
    } else {
        localStorage.removeItem('contratos_db_offline');
        mostrarMensagem('🗑️ Dados locais removidos!', 'success');
    }
}

async function sincronizarDados() {
    if (dbStatus !== 'online' || !supabaseClient) {
        alert('⚠️ Modo offline. Conecte-se ao Supabase para sincronizar.');
        return;
    }
    try {
        mostrarMensagem('🔄 Sincronizando...', 'info');
        await carregarClausulasDoSupabase();
        mostrarMensagem('✅ Dados sincronizados!', 'success');
    } catch (error) {
        mostrarMensagem('❌ Erro na sincronização', 'error');
    }
}

// ============================================================
// SEQUÊNCIA AUTOMÁTICA DO NÚMERO DO CONTRATO (LOCADOR + LOCATÁRIO)
// ============================================================
function bloquearCampoNumeroContrato() {
    const inputNum = document.getElementById('numContrato');
    if (!inputNum) return;

    inputNum.readOnly = true;
    inputNum.setAttribute('readonly', 'readonly');
    inputNum.setAttribute('aria-readonly', 'true');
    inputNum.classList.add('campo-bloqueado', 'num-contrato-automatico');
    inputNum.title = 'Número gerado automaticamente pela combinação dos CPFs';
}

function gerarChavePartes(cpfLocador, cpfLocatario) {
    const cpfL = removerMascara(cpfLocador || '');
    const cpfLt = removerMascara(cpfLocatario || '');
    if (cpfL.length !== 11 || cpfLt.length !== 11) return '';
    return `${cpfL}_${cpfLt}`;
}

function obterUltimaSequenciaLocal(chave) {
    if (!chave) return 0;
    const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    const lista = Array.isArray(db.contratos) ? db.contratos : [];
    return lista
        .filter((item) => item.chave_partes === chave)
        .reduce((maior, item) => Math.max(maior, Number(item.sequencia) || 0), 0);
}

async function obterUltimaSequenciaSupabase(chave) {
    if (!chave || dbStatus !== 'online' || !supabaseClient) return 0;
    try {
        const { data, error } = await supabaseClient
            .from('contratos')
            .select('sequencia')
            .eq('chave_partes', chave)
            .order('sequencia', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) return 0;
        return Number(data[0].sequencia) || 0;
    } catch (_) {
        return 0;
    }
}

async function atualizarNumeroContratoAutomatico(forcarAtualizacao = false) {
    const inputNum = document.getElementById('numContrato');
    const inputCpfL = document.getElementById('locadorCpf');
    const inputCpfLt = document.getElementById('locatarioCpf');
    if (!inputNum) return;

    bloquearCampoNumeroContrato();

    const ano = new Date().getFullYear();
    const chave = gerarChavePartes(inputCpfL?.value, inputCpfLt?.value);

    if (!chave) {
        inputNum.dataset.chaveAtual = '';
        inputNum.dataset.sequencia = '';
        inputNum.value = `${ano}/??`;
        return;
    }

    const chaveMudou = inputNum.dataset.chaveAtual !== chave;
    if (!forcarAtualizacao && !chaveMudou && inputNum.dataset.sequencia) {
        return;
    }

    const seqLocal = obterUltimaSequenciaLocal(chave);
    const seqOnline = await obterUltimaSequenciaSupabase(chave);
    const ultimaSeq = Math.max(seqLocal, seqOnline);
    const proximaSeq = ultimaSeq + 1;

    inputNum.dataset.chaveAtual = chave;
    inputNum.dataset.sequencia = String(proximaSeq);
    inputNum.value = `${ano}/${String(proximaSeq).padStart(3, '0')}`;
}

async function registrarContratoNoHistorico(dados) {
    const d = dados || getDadosFormulario();
    const chave = gerarChavePartes(d.locador?.cpf, d.locatario?.cpf);
    if (!chave) return;

    const inputNum = document.getElementById('numContrato');
    const seqLocal = obterUltimaSequenciaLocal(chave);
    const seqOnline = await obterUltimaSequenciaSupabase(chave);
    const seqInformada = Number(inputNum?.dataset?.sequencia) || 0;
    const sequencia = Math.max(seqLocal, seqOnline, seqInformada) + (seqInformada > Math.max(seqLocal, seqOnline) ? 0 : 1);

    const numeroFormatado = d.numContrato || `${new Date().getFullYear()}/${String(sequencia).padStart(3, '0')}`;

    const registro = {
        chave_partes: chave,
        cpf_locador: removerMascara(d.locador?.cpf || ''),
        cpf_locatario: removerMascara(d.locatario?.cpf || ''),
        sequencia,
        numero_contrato: numeroFormatado,
        data_inicio: d.dataInicio || '',
        data_validade: d.dataValidade || '',
        valor_imovel: d.imovel?.valor || '',
        endereco_imovel: d.imovel?.endereco || '',
        criado_em: new Date().toISOString()
    };

    const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    if (!Array.isArray(db.contratos)) db.contratos = [];
    const idxExistente = db.contratos.findIndex(
        (c) => c.chave_partes === chave && Number(c.sequencia) === Number(sequencia)
    );
    if (idxExistente >= 0) db.contratos[idxExistente] = registro;
    else db.contratos.push(registro);
    localStorage.setItem('contratos_db_offline', JSON.stringify(db));

    if (dbStatus === 'online' && supabaseClient) {
        try {
            await supabaseClient
                .from('contratos')
                .upsert(registro, { onConflict: 'chave_partes,sequencia' });
        } catch (err) {
            console.warn('⚠️ Não foi possível registrar contrato no Supabase agora:', err);
        }
    }
}

function vincularEventosSequenciaContrato() {
    const inputCpfL = document.getElementById('locadorCpf');
    const inputCpfLt = document.getElementById('locatarioCpf');

    const aoAlterarCpf = () => {
        atualizarNumeroContratoAutomatico(false);
    };

    inputCpfL?.addEventListener('input', aoAlterarCpf);
    inputCpfL?.addEventListener('change', aoAlterarCpf);
    inputCpfLt?.addEventListener('input', aoAlterarCpf);
    inputCpfLt?.addEventListener('change', aoAlterarCpf);
}


// ============================================================
// EXPOR FUNÇÕES GLOBAIS
// ============================================================
window.atualizarNumeroContratoAutomatico = atualizarNumeroContratoAutomatico;
window.registrarContratoNoHistorico = registrarContratoNoHistorico;
window.bloquearCampoNumeroContrato = bloquearCampoNumeroContrato;
window.gerarPrevia = gerarPrevia;
window.gerarPDF = gerarPDF;
window.buscarPorCpf = buscarPorCpf;
window.salvarTodosDados = salvarTodosDados;
window.adicionarClausula = adicionarClausula;
window.removerClausula = removerClausula;
window.abrirGerenciador = abrirGerenciador;
window.fecharGerenciador = fecharGerenciador;
window.excluirRegistroOnline = excluirRegistroOnline;
window.limparTodosDados = limparTodosDados;
window.exportarDados = exportarDados;
window.importarDados = importarDados;
window.sincronizarDados = sincronizarDados;
window.selecionarImovelPorDropdown = selecionarImovelPorDropdown;
window.toggleFiador = function(checkbox) {
    const div = document.getElementById('camposFiadorContainer');
    if (!div) return;

    if (checkbox && checkbox.checked) {
        div.style.display = 'block';
    } else {
        div.style.display = 'none';
        div.querySelectorAll('input, select, textarea').forEach(campo => {
            campo.value = '';
        });
    }
};

console.log('✅ script.js carregado com sucesso!');
