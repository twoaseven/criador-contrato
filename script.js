// ============================================================
// 1. CONFIGURAÇÃO SUPABASE - URL UNIFICADA
// ============================================================
// ATENÇÃO: Use a mesma URL em todos os arquivos!
// A URL correta é a do seu projeto Supabase
const SUPABASE_URL = 'https://uzsujdqyutzennhcjkyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6c3VqZHF5dXR6ZW5uaGNqa3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDcwNjAsImV4cCI6MjEwMjY4MzA2MH0.LSsLFovpMNcdhQkBu4qwLo9r_pU9xdITT32M01qI9QY';

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

    const numContrato = document.getElementById('numContrato');
    if (numContrato && !numContrato.value) {
        const ano = new Date().getFullYear();
        const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        numContrato.value = `${ano}/${num}`;
    }

    // Aplicar máscaras
    document.querySelectorAll('#locadorCpf, #locatarioCpf, #fiadorCpf, #fiadorConjugeCpf, #buscaCpf')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'cpf'); }));

    document.querySelectorAll('#locadorRg, #locatarioRg, #fiadorRg, #fiadorConjugeRg')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'rg'); }));

    document.querySelectorAll('#locadorTel, #locatarioTel, #fiadorTel')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'telefone'); }));

    document.querySelectorAll('#imovelValor, #caucaoValor')
        .forEach(el => el.addEventListener('input', function(e) { aplicarMascara(e, 'valor'); }));

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
        
        // Marcar cláusulas padrão (fallback ou do banco)
        if (c.id.startsWith('fb') || (c.id.length <= 3 && c.id.startsWith('c'))) {
            cb.checked = true;
        }
        
        label.appendChild(cb);

        const span = document.createElement('span');
        span.textContent = ' ' + c.descricao;
        label.appendChild(span);

        // Botão remover para adicionais
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
        // modo offline
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
        dataElaboracao: getVal('dataElaboracao'),
        prazoContrato: getVal('prazoContrato') || '12',
        foroCidade: getVal('foroCidade') || 'São Paulo',
        locador: {
            nome: getVal('locadorNome'),
            nacionalidade: getVal('locadorNacionalidade') || 'brasileiro',
            estadoCivil: getSelect('locadorEstadoCivil') || 'solteiro',
            profissao: getVal('locadorProfissao') || 'não informada',
            rg: getVal('locadorRg') || 'não informado',
            cpf: getVal('locadorCpf'),
            endereco: getVal('locadorEnd') || 'não informado',
            telefone: getVal('locadorTel') || 'não informado',
            email: getVal('locadorEmail') || 'não informado'
        },
        locatario: {
            nome: getVal('locatarioNome'),
            nacionalidade: getVal('locatarioNacionalidade') || 'brasileiro',
            estadoCivil: getSelect('locatarioEstadoCivil') || 'solteiro',
            profissao: getVal('locatarioProfissao') || 'não informada',
            rg: getVal('locatarioRg') || 'não informado',
            cpf: getVal('locatarioCpf'),
            endereco: getVal('locatarioEnd') || 'não informado',
            telefone: getVal('locatarioTel') || 'não informado',
            email: getVal('locatarioEmail') || 'não informado'
        },
        fiador: {
            nome: getVal('fiadorNome'),
            nacionalidade: getVal('fiadorNacionalidade') || 'brasileiro',
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
            cauçãoValor: getVal('caucaoValor'),
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
    
    // Validações
    if (!dados.imovel.valor || dados.imovel.valor === '') {
        alert("O campo Valor do Imóvel é obrigatório. Por favor, preencha com um valor.");
        return;
    }
    
    if (!dados.imovel.endereco) {
        alert("O campo Endereço do Imóvel é obrigatório.");
        return;
    }

    if (dbStatus === 'online' && supabaseClient) {
        try {
            mostrarMensagem('📦 Salvando...', 'info');
            let salvos = 0;

            // Salvar locador
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

            // Salvar locatario
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

            // Salvar fiador
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

            // Salvar imóvel
            if (dados.imovel.endereco) {
                const { error } = await supabaseClient.from('imoveis').upsert({
                    endereco: dados.imovel.endereco,
                    registro: dados.imovel.registro,
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
function formatarData(dataStr) {
    if (!dataStr) return 'a definir';
    const partes = dataStr.split('-');
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
function montarContrato(dados, clausulas) {
    const l = dados.locador;
    const lt = dados.locatario;
    const f = dados.fiador;
    const i = dados.imovel;
    const e = dados.encargos;
    const g = dados.garantia;
    const m = dados.multas;
    const v = dados.vistoria;
    const numContrato = dados.numContrato || 'NÃO INFORMADO';
    const dataElab = dados.dataElaboracao ? formatarData(dados.dataElaboracao) : 'Data não informada';
    const prazo = dados.prazoContrato || '12';
    const prazoExtenso = numeroPorExtenso(parseInt(prazo));
    const valorExtenso = valorPorExtenso(i.valor);
    const foro = dados.foroCidade || 'São Paulo';
    const inicioFormatado = i.inicio ? formatarData(i.inicio) : 'a definir';
    const fimFormatado = i.fim ? formatarData(i.fim) : 'a definir';

    let texto = '';
    texto += ' '.repeat(55) + 'CONTRATO DE LOCAÇÃO DE IMÓVEL\n';
    texto += ' '.repeat(60) + 'Nº: ' + numContrato + '\n';
    texto += ' '.repeat(62) + dataElab + '\n\n';
    texto += '='.repeat(80) + '\n\n';
    texto += 'Este contrato segue as normas da Lei do Inquilinato (Lei nº 8.245/91) e demais disposições do Código Civil Brasileiro.\n';
    texto += 'Para consulta das partes, acesse: www.contratos-aluguel.com.br/consulta\n\n';
    texto += 'IMPORTANTE: Este documento deverá ser autenticado em cartório para ter validade jurídica plena.\n\n';
    texto += '='.repeat(80) + '\n\n';

    texto += '1. QUALIFICAÇÃO DAS PARTES\n\n';
    texto += 'LOCADOR (PROPRIETÁRIO):\n';
    texto += `Nome: ${l.nome || 'NÃO INFORMADO'}\n`;
    if (l.nacionalidade) texto += `Nacionalidade: ${l.nacionalidade}\n`;
    if (l.estadoCivil) texto += `Estado Civil: ${l.estadoCivil}\n`;
    if (l.profissao) texto += `Profissão: ${l.profissao}\n`;
    texto += `RG: ${l.rg || 'NÃO INFORMADO'}\n`;
    texto += `CPF: ${l.cpf || 'NÃO INFORMADO'}\n`;
    texto += `Endereço: ${l.endereco || 'NÃO INFORMADO'}\n`;
    if (l.telefone) texto += `Telefone: ${l.telefone}\n`;
    if (l.email) texto += `E-mail: ${l.email}\n\n`;

    texto += 'LOCATÁRIO (INQUILINO):\n';
    texto += `Nome: ${lt.nome || 'NÃO INFORMADO'}\n`;
    if (lt.nacionalidade) texto += `Nacionalidade: ${lt.nacionalidade}\n`;
    if (lt.estadoCivil) texto += `Estado Civil: ${lt.estadoCivil}\n`;
    if (lt.profissao) texto += `Profissão: ${lt.profissao}\n`;
    texto += `RG: ${lt.rg || 'NÃO INFORMADO'}\n`;
    texto += `CPF: ${lt.cpf || 'NÃO INFORMADO'}\n`;
    texto += `Endereço: ${lt.endereco || 'NÃO INFORMADO'}\n`;
    if (lt.telefone) texto += `Telefone: ${lt.telefone}\n`;
    if (lt.email) texto += `E-mail: ${lt.email}\n\n`;

    if (f && f.nome) {
        texto += 'FIADOR:\n';
        texto += `Nome: ${f.nome}\n`;
        if (f.nacionalidade) texto += `Nacionalidade: ${f.nacionalidade}\n`;
        if (f.estadoCivil) texto += `Estado Civil: ${f.estadoCivil}\n`;
        if (f.profissao) texto += `Profissão: ${f.profissao}\n`;
        texto += `RG: ${f.rg || 'NÃO INFORMADO'}\n`;
        texto += `CPF: ${f.cpf || 'NÃO INFORMADO'}\n`;
        texto += `Endereço: ${f.endereco || 'NÃO INFORMADO'}\n`;
        if (f.telefone) texto += `Telefone: ${f.telefone}\n`;
        if (f.email) texto += `E-mail: ${f.email}\n`;
        if (f.conjugeNome) {
            texto += `Cônjuge: ${f.conjugeNome}, CPF: ${f.conjugeCpf || 'N/A'}, RG: ${f.conjugeRg || 'N/A'}\n`;
        }
        texto += '\n';
    }

    texto += '='.repeat(80) + '\n\n';
    texto += '2. OBJETO DO CONTRATO\n\n';
    texto += `Endereço do Imóvel: ${i.endereco || 'NÃO INFORMADO'}\n`;
    if (i.registro) texto += `Registro no Cartório de Imóveis: ${i.registro}\n`;
    if (i.tipo) texto += `Tipo: ${i.tipo}\n`;
    if (i.destinacao) texto += `Destinação: ${i.destinacao}\n`;
    if (i.quartos) texto += `Quartos: ${i.quartos}\n`;
    if (i.banheiros) texto += `Banheiros: ${i.banheiros}\n`;
    if (i.vagas) texto += `Vagas de Garagem: ${i.vagas}\n`;
    if (i.metragem) texto += `Metragem Total: ${i.metragem} m²\n`;
    if (i.areaPrivativa) texto += `Área Privativa: ${i.areaPrivativa} m²\n`;
    if (i.areaComum) texto += `Área Comum: ${i.areaComum} m²\n`;
    if (i.caracteristicas) texto += `Características: ${i.caracteristicas}\n\n`;
    texto += 'O imóvel destina-se exclusivamente ao uso ' + (i.destinacao ? i.destinacao.toLowerCase() : 'residencial') + '.\n\n';

    texto += '='.repeat(80) + '\n\n';
    texto += '3. PRAZO DA LOCAÇÃO\n\n';
    texto += `Data de Início: ${inicioFormatado}\n`;
    texto += `Data de Término: ${fimFormatado}\n`;
    texto += `Prazo: ${prazo} (${prazoExtenso}) meses\n`;
    texto += `Renovação: ${i.renovacao === 'sim' ? 'Automática' : 'Dependerá de termo aditivo'}\n\n`;

    texto += '='.repeat(80) + '\n\n';
    texto += '4. VALOR, FORMA DE PAGAMENTO E REAJUSTE\n\n';
    texto += `Valor do Aluguel: R$ ${i.valor || '0,00'} (${valorExtenso})\n`;
    texto += `Dia de Vencimento: Dia ${i.vencimento || '5'} de cada mês\n`;
    texto += `Forma de Pagamento: ${i.pagamento || 'PIX'}\n`;
    texto += `Índice de Reajuste: ${i.indice || 'IPCA'}\n`;
    texto += `Periodicidade do Reajuste: A cada ${i.periodicidade || '12'} meses\n\n`;

    texto += '='.repeat(80) + '\n\n';
    texto += '5. ENCARGOS E TRIBUTOS\n\n';
    texto += `IPTU: ${e.iptu || 'Locador'}\n`;
    texto += `Condomínio: ${e.condominio || 'Locatário'}\n`;
    texto += `Água: ${e.agua || 'Locatário'}\n`;
    texto += `Luz: ${e.luz || 'Locatário'}\n`;
    texto += `Gás: ${e.gas || 'Locatário'}\n`;
    texto += `Seguro Incêndio: ${e.seguro || 'Locador'}\n\n`;

    texto += '='.repeat(80) + '\n\n';
    texto += '6. GARANTIAS LOCATÍCIAS\n\n';
    texto += `Modalidade: ${g.modalidade || 'Fiança'}\n`;
    if (g.modalidade === 'Caução' && g.cauçãoValor) {
        texto += `Valor da Caução: R$ ${g.cauçãoValor}\n`;
    }
    if (g.modalidade === 'Seguro Fiança') {
        if (g.seguradora) texto += `Seguradora: ${g.seguradora}\n`;
        if (g.apolice) texto += `Apólice nº: ${g.apolice}\n`;
    }
    texto += '\n';

    texto += '='.repeat(80) + '\n\n';
    texto += '7. MULTAS E RESCISÃO\n\n';
    texto += `Multa por Atraso: ${m.atraso || '2'}%\n`;
    texto += `Juros de Mora: ${m.juros || '1'}% ao mês\n`;
    texto += `Multa Rescisória: ${m.rescisoria || '3'} meses\n\n`;

    texto += '='.repeat(80) + '\n\n';
    texto += '8. VISTORIA\n\n';
    texto += 'O Laudo de Vistoria Inicial é parte integrante deste contrato.\n';
    if (v.data) texto += `Data da Vistoria: ${formatarData(v.data)}\n`;
    texto += `Laudo: ${v.laudo === 'sim' ? 'Será anexado' : 'Será realizado posteriormente'}\n`;
    if (v.observacoes) texto += `Observações: ${v.observacoes}\n\n`;

    texto += '='.repeat(80) + '\n\n';
    if (clausulas.length > 0) {
        texto += 'CLÁUSULAS ADICIONAIS:\n\n';
        clausulas.forEach((c, idx) => {
            texto += `Cláusula ${idx+1}: ${c.descricao}\n`;
            texto += `${c.texto}\n\n`;
        });
        texto += '='.repeat(80) + '\n\n';
    }

    texto += 'Estando assim justos e contratados, firmam o presente instrumento em 2 (duas) vias.\n\n';
    texto += `${foro}, ${dataElab}\n\n`;
    texto += '___________________________________________\n';
    texto += 'Assinatura do LOCADOR\n\n';
    texto += '___________________________________________\n';
    texto += 'Assinatura do LOCATÁRIO\n\n';
    if (f && f.nome) {
        texto += '___________________________________________\n';
        texto += 'Assinatura do FIADOR\n\n';
    }
    texto += '___________________________________________\n';
    texto += '1ª Testemunha\n\n';
    texto += '___________________________________________\n';
    texto += '2ª Testemunha\n\n';
    texto += '='.repeat(80) + '\n';
    texto += 'Documento elaborado em conformidade com a Lei nº 8.245/91.\n';

    return texto;
}

function gerarPrevia() {
    const dados = getDadosFormulario();
    const clausulas = getClausulasMarcadas();
    const texto = montarContrato(dados, clausulas);
    const previaDiv = document.getElementById('previa');
    if (previaDiv) {
        previaDiv.textContent = texto;
        previaDiv.classList.add('visivel');
        previaDiv.scrollIntoView({ behavior: 'smooth' });
        mostrarMensagem('✓ Prévia gerada!', 'success');
    }
}

function gerarPDF() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('ativo');

    setTimeout(() => {
        try {
            if (typeof pdfMake === 'undefined') {
                throw new Error('Biblioteca pdfMake não carregada.');
            }
            const dados = getDadosFormulario();
            const clausulas = getClausulasMarcadas();

            if (!dados.locador.nome || !dados.locador.cpf) {
                alert('⚠️ Preencha Nome e CPF do Locador.');
                if (loading) loading.classList.remove('ativo');
                return;
            }
            if (!dados.locatario.nome || !dados.locatario.cpf) {
                alert('⚠️ Preencha Nome e CPF do Locatário.');
                if (loading) loading.classList.remove('ativo');
                return;
            }
            if (!dados.numContrato) {
                alert('⚠️ Informe o Número do Contrato.');
                if (loading) loading.classList.remove('ativo');
                return;
            }
            if (!dados.imovel.endereco) {
                alert('⚠️ Informe o Endereço do Imóvel.');
                if (loading) loading.classList.remove('ativo');
                return;
            }

            const textoContrato = montarContrato(dados, clausulas);
            
            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [40, 40, 40, 40],
                content: [
                    { 
                        stack: textoContrato.split('\n').map(line => ({ 
                            text: line, 
                            fontSize: 10, 
                            alignment: 'justify' 
                        })), 
                        style: 'body' 
                    }
                ],
                styles: { 
                    body: { 
                        fontSize: 10, 
                        lineHeight: 1.5, 
                        alignment: 'justify' 
                    } 
                },
                defaultStyle: { alignment: 'justify' },
                footer: function(currentPage, pageCount) {
                    return { 
                        text: `Redigido por TWO A SEVEN - Digital Solutions | Página ${currentPage} de ${pageCount}`, 
                        alignment: 'center', 
                        fontSize: 8, 
                        margin: [0,0,0,15] 
                    };
                }
            };

            pdfMake.createPdf(docDefinition).download(`Contrato_${dados.numContrato.replace(/\//g,'_')}.pdf`);
            if (loading) loading.classList.remove('ativo');
            mostrarMensagem('✅ PDF gerado!', 'success');
        } catch (error) {
            console.error('❌ Erro no PDF:', error);
            alert('❌ Erro ao gerar PDF: ' + error.message);
            if (loading) loading.classList.remove('ativo');
        }
    }, 300);
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
// EXPOR FUNÇÕES GLOBAIS
// ============================================================
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

console.log('✅ script.js carregado com sucesso!');
