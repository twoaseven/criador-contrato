// ============================================================
// 1. CONFIGURAÇÃO SUPABASE
// ============================================================
// 🔑 SUAS CHAVES DO SUPABASE:
const SUPABASE_URL = 'https://gyhsyvthfyvvcrvupqev.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aHN5dnRoZnl2dmNydnVwcWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTc3OTMsImV4cCI6MjEwMjIzMzc5M30.kdi06B-HGANbdTC5B6VjdqczXevYeUZTjWL9Wan-Ff0';

let supabaseClient = null;
let dbStatus = 'offline';

let CLAUSULAS_PADRAO = [
    { id: 'c1', descricao: 'Reajuste pelo IG-M', texto: 'O valor do aluguel será reajustado anualmente pelo índice IG-M, calculado pro-rata die.' },
    { id: 'c2', descricao: 'Reajuste pelo IPCA', texto: 'O valor do aluguel será reajustado anualmente pelo índice IPCA (IBGE), calculado pro-rata die.' },
    { id: 'c3', descricao: 'Benfeitorias e Reformas', texto: 'O locatário poderá realizar benfeitorias úteis e voluptuárias, desde que comunicadas previamente ao locador. Benfeitorias necessárias poderão ser executadas independentemente de autorização, mediante comprovação de urgência.' },
    { id: 'c4', descricao: 'Sublocação Proibida', texto: 'É vedada a sublocação total ou parcial do imóvel, bem como a cessão ou transferência da locação, sem o consentimento prévio e escrito do locador.' },
    { id: 'c5', descricao: 'Visitação para Venda', texto: 'O locador poderá visitar o imóvel para fins de venda, com agendamento prévio de 48 (quarenta e oito) horas, em horário comercial, respeitando a privacidade do locatário.' },
    { id: 'c6', descricao: 'Responsabilidade por Danos', texto: 'O locatário é responsável por todos os danos causados ao imóvel, salvo os decorrentes de uso normal e deterioração natural. A pintura interna deverá ser refeita a cada 5 (cinco) anos, por conta do locatário.' },
    { id: 'c7', descricao: 'Renovação Antecipada', texto: 'A renovação do contrato poderá ser solicitada com antecedência mínima de 60 (sessenta) dias do término do prazo, mediante termo aditivo.' },
    { id: 'c8', descricao: 'Silêncio e Tolerância', texto: 'A tolerância ou o não exercício de qualquer direito por parte do locador não constituirá novação ou renúncia, podendo ser exercido a qualquer tempo.' }
];

let CLAUSULAS = [...CLAUSULAS_PADRAO];
let clausulasAdicionais = [];

// ============================================================
// 2. FUNÇÕES DE MÁSCARA
// ============================================================
function mascaraCPF(valor) {
    valor = valor.replace(/\D/g, '');
    if (valor.length <= 11) {
        valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
        valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
        valor = valor.replace(/(\d{3})(\d{2})$/, '$1-$2');
    }
    return valor;
}

function mascaraRG(valor) {
    valor = valor.replace(/\D/g, '');
    if (valor.length <= 9) {
        valor = valor.replace(/(\d{2})(\d)/, '$1.$2');
        valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
        valor = valor.replace(/(\d{3})(\d{1})$/, '$1-$2');
    }
    return valor;
}

function mascaraTelefone(valor) {
    valor = valor.replace(/\D/g, '');
    if (valor.length <= 11) {
        valor = valor.replace(/^(\d{2})(\d)/, '($1) $2');
        valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
}

function mascaraValor(valor) {
    valor = valor.replace(/\D/g, '');
    if (valor.length > 0) {
        valor = (parseInt(valor) / 100).toFixed(2);
        valor = valor.replace('.', ',');
        valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return valor;
}

function aplicarMascara(event, tipo) {
    const input = event.target;
    let valor = input.value;
    if (tipo === 'cpf') {
        input.value = mascaraCPF(valor);
    } else if (tipo === 'rg') {
        input.value = mascaraRG(valor);
    } else if (tipo === 'telefone') {
        input.value = mascaraTelefone(valor);
    } else if (tipo === 'valor') {
        input.value = mascaraValor(valor);
    }
}

function removerMascara(valor) {
    return valor.replace(/\D/g, '');
}

// ============================================================
// 3. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('anoFooter').textContent = new Date().getFullYear();

    if (!document.getElementById('dataElaboracao').value) {
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('dataElaboracao').value = hoje;
    }

    if (!document.getElementById('numContrato').value) {
        const ano = new Date().getFullYear();
        const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        document.getElementById('numContrato').value = `${ano}/${num}`;
    }

    document.querySelectorAll('#locadorCpf, #locatarioCpf, #fiadorCpf, #fiadorConjugeCpf, #buscaCpf').forEach(el => {
        el.addEventListener('input', function(e) { aplicarMascara(e, 'cpf'); });
    });

    document.querySelectorAll('#locadorRg, #locatarioRg, #fiadorRg, #fiadorConjugeRg').forEach(el => {
        el.addEventListener('input', function(e) { aplicarMascara(e, 'rg'); });
    });

    document.querySelectorAll('#locadorTel, #locatarioTel, #fiadorTel').forEach(el => {
        el.addEventListener('input', function(e) { aplicarMascara(e, 'telefone'); });
    });

    document.querySelectorAll('#imovelValor, #caucaoValor').forEach(el => {
        el.addEventListener('input', function(e) { aplicarMascara(e, 'valor'); });
    });

    carregarClausulas();
    initSupabase();
});

// ============================================================
// 4. SUPABASE - CONEXÃO
// ============================================================
async function initSupabase() {
    try {
        if (typeof supabaseJs === 'undefined') {
            throw new Error('Supabase SDK não carregado');
        }
        
        supabaseClient = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Testar conexão
        const { data, error } = await supabaseClient.from('locadores').select('count', { count: 'exact', head: true });
        
        if (error && error.code === 'PGRST301') {
            usarModoOffline();
            return;
        }
        
        dbStatus = 'online';
        document.getElementById('statusDB').className = 'status-db status-online';
        document.getElementById('statusDB').textContent = '✅ Conectado';
        
        await carregarDadosIniciais();
        mostrarMensagem('✅ Conectado ao Supabase!', 'success');
        
    } catch (error) {
        console.error('Erro ao conectar Supabase:', error);
        dbStatus = 'offline';
        document.getElementById('statusDB').className = 'status-db status-offline';
        document.getElementById('statusDB').textContent = '❌ Offline';
        usarModoOffline();
        mostrarMensagem('❌ Modo offline - dados salvos localmente', 'error');
    }
}

function usarModoOffline() {
    const dados = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    if (!dados.locadores) dados.locadores = [];
    if (!dados.locatarios) dados.locatarios = [];
    if (!dados.fiadores) dados.fiadores = [];
    if (!dados.imoveis) dados.imoveis = [];
    if (!dados.clausulas) dados.clausulas = CLAUSULAS_PADRAO;
    localStorage.setItem('contratos_db_offline', JSON.stringify(dados));
}

function mostrarMensagem(msg, tipo) {
    const el = document.getElementById('msgBusca') || document.getElementById('msgSalvoFooter');
    if (el) {
        el.textContent = msg;
        el.style.color = tipo === 'success' ? '#28a745' : '#dc3545';
        setTimeout(() => { el.textContent = ''; }, 5000);
    }
}

// ============================================================
// 5. FUNÇÕES DO BANCO DE DADOS
// ============================================================
function getDadosFormulario() {
    return {
        numContrato: document.getElementById('numContrato').value.trim(),
        dataElaboracao: document.getElementById('dataElaboracao').value,
        prazoContrato: document.getElementById('prazoContrato').value || '12',
        foroCidade: document.getElementById('foroCidade').value.trim() || 'São Paulo',
        locador: {
            nome: document.getElementById('locadorNome').value.trim(),
            nacionalidade: document.getElementById('locadorNacionalidade').value.trim() || 'brasileiro',
            estadoCivil: document.getElementById('locadorEstadoCivil').value || 'solteiro',
            profissao: document.getElementById('locadorProfissao').value.trim() || 'não informada',
            rg: document.getElementById('locadorRg').value.trim() || 'não informado',
            cpf: document.getElementById('locadorCpf').value.trim(),
            endereco: document.getElementById('locadorEnd').value.trim() || 'não informado',
            telefone: document.getElementById('locadorTel').value.trim() || 'não informado',
            email: document.getElementById('locadorEmail').value.trim() || 'não informado'
        },
        locatario: {
            nome: document.getElementById('locatarioNome').value.trim(),
            nacionalidade: document.getElementById('locatarioNacionalidade').value.trim() || 'brasileiro',
            estadoCivil: document.getElementById('locatarioEstadoCivil').value || 'solteiro',
            profissao: document.getElementById('locatarioProfissao').value.trim() || 'não informada',
            rg: document.getElementById('locatarioRg').value.trim() || 'não informado',
            cpf: document.getElementById('locatarioCpf').value.trim(),
            endereco: document.getElementById('locatarioEnd').value.trim() || 'não informado',
            telefone: document.getElementById('locatarioTel').value.trim() || 'não informado',
            email: document.getElementById('locatarioEmail').value.trim() || 'não informado'
        },
        fiador: {
            nome: document.getElementById('fiadorNome').value.trim(),
            nacionalidade: document.getElementById('fiadorNacionalidade').value.trim() || 'brasileiro',
            estadoCivil: document.getElementById('fiadorEstadoCivil').value || 'solteiro',
            profissao: document.getElementById('fiadorProfissao').value.trim() || 'não informada',
            rg: document.getElementById('fiadorRg').value.trim() || 'não informado',
            cpf: document.getElementById('fiadorCpf').value.trim() || 'não informado',
            endereco: document.getElementById('fiadorEnd').value.trim() || 'não informado',
            telefone: document.getElementById('fiadorTel').value.trim() || 'não informado',
            email: document.getElementById('fiadorEmail').value.trim() || 'não informado',
            conjugeNome: document.getElementById('fiadorConjugeNome').value.trim(),
            conjugeCpf: document.getElementById('fiadorConjugeCpf').value.trim(),
            conjugeRg: document.getElementById('fiadorConjugeRg').value.trim()
        },
        imovel: {
            endereco: document.getElementById('imovelEnd').value.trim(),
            registro: document.getElementById('imovelRegistro').value.trim(),
            tipo: document.getElementById('imovelTipo').value,
            destinacao: document.getElementById('imovelDestinacao').value || 'Residencial',
            quartos: document.getElementById('imovelQuartos').value,
            banheiros: document.getElementById('imovelBanheiros').value,
            vagas: document.getElementById('imovelVagas').value,
            metragem: document.getElementById('imovelMetragem').value,
            areaPrivativa: document.getElementById('imovelAreaPrivativa').value,
            areaComum: document.getElementById('imovelAreaComum').value,
            caracteristicas: document.getElementById('imovelCaracteristicas').value.trim(),
            inicio: document.getElementById('imovelInicio').value,
            fim: document.getElementById('imovelFim').value,
            renovacao: document.getElementById('imovelRenovacao').value,
            valor: document.getElementById('imovelValor').value.trim(),
            vencimento: document.getElementById('imovelVencimento').value,
            pagamento: document.getElementById('imovelPagamento').value,
            indice: document.getElementById('imovelIndice').value,
            periodicidade: document.getElementById('imovelPeriodicidade').value
        },
        encargos: {
            iptu: document.getElementById('iptuResponsavel').value,
            condominio: document.getElementById('condominioResponsavel').value,
            agua: document.getElementById('aguaResponsavel').value,
            luz: document.getElementById('luzResponsavel').value,
            gas: document.getElementById('gasResponsavel').value,
            seguro: document.getElementById('seguroResponsavel').value
        },
        garantia: {
            modalidade: document.getElementById('garantiaModalidade').value,
            cauçãoValor: document.getElementById('caucaoValor').value.trim(),
            seguradora: document.getElementById('seguroSeguradora').value.trim(),
            apolice: document.getElementById('seguroApolice').value.trim()
        },
        multas: {
            atraso: document.getElementById('multaAtraso').value,
            juros: document.getElementById('jurosMora').value,
            rescisoria: document.getElementById('multaRescisoria').value
        },
        vistoria: {
            observacoes: document.getElementById('vistoriaObservacoes').value.trim(),
            data: document.getElementById('vistoriaData').value,
            laudo: document.getElementById('vistoriaLaudo').value
        }
    };
}

// ============================================================
// 6. BUSCAR POR CPF
// ============================================================
async function buscarPorCpf() {
    const cpf = document.getElementById('buscaCpf').value.trim();
    if (!cpf) {
        alert('Digite um CPF para buscar.');
        return;
    }
    const cpfLimpo = removerMascara(cpf);
    
    if (dbStatus === 'online' && supabaseClient) {
        await buscarPorCpfOnline(cpfLimpo);
    } else {
        buscarPorCpfOffline(cpfLimpo);
    }
}

async function buscarPorCpfOnline(cpfLimpo) {
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
        console.error('Erro na busca:', error);
        mostrarMensagem('❌ Erro na busca', 'error');
    }
}

function buscarPorCpfOffline(cpfLimpo) {
    const dados = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    let encontrado = false;
    
    const locador = dados.locadores?.find(l => removerMascara(l.cpf) === cpfLimpo);
    if (locador) {
        preencherLocador(locador);
        encontrado = true;
    }
    
    const locatario = dados.locatarios?.find(l => removerMascara(l.cpf) === cpfLimpo);
    if (locatario) {
        preencherLocatario(locatario);
        encontrado = true;
    }
    
    const fiador = dados.fiadores?.find(f => removerMascara(f.cpf) === cpfLimpo);
    if (fiador) {
        preencherFiador(fiador);
        encontrado = true;
    }
    
    if (!encontrado) {
        alert('Nenhum cadastro encontrado para este CPF.');
    }
}

// ============================================================
// 7. PREENCHER CAMPOS
// ============================================================
function preencherLocador(dados) {
    document.getElementById('locadorNome').value = dados.nome || '';
    document.getElementById('locadorCpf').value = dados.cpf || '';
    document.getElementById('locadorRg').value = dados.rg || '';
    document.getElementById('locadorNacionalidade').value = dados.nacionalidade || '';
    document.getElementById('locadorProfissao').value = dados.profissao || '';
    document.getElementById('locadorEnd').value = dados.endereco || '';
    document.getElementById('locadorTel').value = dados.telefone || '';
    document.getElementById('locadorEmail').value = dados.email || '';
    if (dados.estado_civil) {
        document.getElementById('locadorEstadoCivil').value = dados.estado_civil;
    }
}

function preencherLocatario(dados) {
    document.getElementById('locatarioNome').value = dados.nome || '';
    document.getElementById('locatarioCpf').value = dados.cpf || '';
    document.getElementById('locatarioRg').value = dados.rg || '';
    document.getElementById('locatarioNacionalidade').value = dados.nacionalidade || '';
    document.getElementById('locatarioProfissao').value = dados.profissao || '';
    document.getElementById('locatarioEnd').value = dados.endereco || '';
    document.getElementById('locatarioTel').value = dados.telefone || '';
    document.getElementById('locatarioEmail').value = dados.email || '';
    if (dados.estado_civil) {
        document.getElementById('locatarioEstadoCivil').value = dados.estado_civil;
    }
}

function preencherFiador(dados) {
    document.getElementById('fiadorNome').value = dados.nome || '';
    document.getElementById('fiadorCpf').value = dados.cpf || '';
    document.getElementById('fiadorRg').value = dados.rg || '';
    document.getElementById('fiadorNacionalidade').value = dados.nacionalidade || '';
    document.getElementById('fiadorProfissao').value = dados.profissao || '';
    document.getElementById('fiadorEnd').value = dados.endereco || '';
    document.getElementById('fiadorTel').value = dados.telefone || '';
    document.getElementById('fiadorEmail').value = dados.email || '';
    if (dados.estado_civil) {
        document.getElementById('fiadorEstadoCivil').value = dados.estado_civil;
    }
    document.getElementById('fiadorConjugeNome').value = dados.conjuge_nome || '';
    document.getElementById('fiadorConjugeCpf').value = dados.conjuge_cpf || '';
    document.getElementById('fiadorConjugeRg').value = dados.conjuge_rg || '';
}

// ============================================================
// 8. SALVAR DADOS
// ============================================================
async function salvarTodosDados() {
    if (dbStatus === 'online' && supabaseClient) {
        await salvarDadosOnline();
    } else {
        salvarDadosOffline();
    }
}

async function salvarDadosOnline() {
    try {
        mostrarMensagem('⏳ Salvando...', 'info');
        const dados = getDadosFormulario();
        let salvos = 0;
        
        if (dados.locador.nome && dados.locador.cpf) {
            const cpfLimpo = removerMascara(dados.locador.cpf);
            const locadorData = {
                nome: dados.locador.nome,
                cpf: cpfLimpo,
                rg: dados.locador.rg,
                nacionalidade: dados.locador.nacionalidade,
                estado_civil: dados.locador.estadoCivil,
                profissao: dados.locador.profissao,
                endereco: dados.locador.endereco,
                telefone: dados.locador.telefone,
                email: dados.locador.email
            };
            
            const { error } = await supabaseClient
                .from('locadores')
                .upsert(locadorData, { onConflict: 'cpf' });
                
            if (!error) salvos++;
        }
        
        if (dados.locatario.nome && dados.locatario.cpf) {
            const cpfLimpo = removerMascara(dados.locatario.cpf);
            const locatarioData = {
                nome: dados.locatario.nome,
                cpf: cpfLimpo,
                rg: dados.locatario.rg,
                nacionalidade: dados.locatario.nacionalidade,
                estado_civil: dados.locatario.estadoCivil,
                profissao: dados.locatario.profissao,
                endereco: dados.locatario.endereco,
                telefone: dados.locatario.telefone,
                email: dados.locatario.email
            };
            
            const { error } = await supabaseClient
                .from('locatarios')
                .upsert(locatarioData, { onConflict: 'cpf' });
                
            if (!error) salvos++;
        }
        
        if (dados.fiador.nome && dados.fiador.cpf) {
            const cpfLimpo = removerMascara(dados.fiador.cpf);
            const fiadorData = {
                nome: dados.fiador.nome,
                cpf: cpfLimpo,
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
            };
            
            const { error } = await supabaseClient
                .from('fiadores')
                .upsert(fiadorData, { onConflict: 'cpf' });
                
            if (!error) salvos++;
        }
        
        if (dados.imovel.endereco) {
            const imovelData = {
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
            };
            
            const { error } = await supabaseClient
                .from('imoveis')
                .upsert(imovelData, { onConflict: 'endereco' });
                
            if (!error) salvos++;
        }
        
        mostrarMensagem(`✓ ${salvos} registros salvos no Supabase!`, 'success');
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        mostrarMensagem('❌ Erro ao salvar: ' + error.message, 'error');
        alert('Erro ao salvar no Supabase: ' + error.message);
    }
}

function salvarDadosOffline() {
    const dados = getDadosFormulario();
    let db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    
    if (!db.locadores) db.locadores = [];
    if (!db.locatarios) db.locatarios = [];
    if (!db.fiadores) db.fiadores = [];
    if (!db.imoveis) db.imoveis = [];
    
    if (dados.locador.nome && dados.locador.cpf) {
        const cpfLimpo = removerMascara(dados.locador.cpf);
        const index = db.locadores.findIndex(l => removerMascara(l.cpf) === cpfLimpo);
        const locadorData = {
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
        if (index >= 0) db.locadores[index] = locadorData;
        else db.locadores.push(locadorData);
    }
    
    if (dados.locatario.nome && dados.locatario.cpf) {
        const cpfLimpo = removerMascara(dados.locatario.cpf);
        const index = db.locatarios.findIndex(l => removerMascara(l.cpf) === cpfLimpo);
        const locatarioData = {
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
        if (index >= 0) db.locatarios[index] = locatarioData;
        else db.locatarios.push(locatarioData);
    }
    
    if (dados.fiador.nome && dados.fiador.cpf) {
        const cpfLimpo = removerMascara(dados.fiador.cpf);
        const index = db.fiadores.findIndex(f => removerMascara(f.cpf) === cpfLimpo);
        const fiadorData = {
            nome: dados.fiador.nome,
            cpf: dados.fiador.cpf,
            rg: dados.fiador.rg,
            nacionalidade: dados.fiador.nacionalidade,
            estadoCivil: dados.fiador.estadoCivil,
            profissao: dados.fiador.profissao,
            endereco: dados.fiador.endereco,
            telefone: dados.fiador.telefone,
            email: dados.fiador.email,
            conjugeNome: dados.fiador.conjugeNome,
            conjugeCpf: dados.fiador.conjugeCpf,
            conjugeRg: dados.fiador.conjugeRg
        };
        if (index >= 0) db.fiadores[index] = fiadorData;
        else db.fiadores.push(fiadorData);
    }
    
    if (dados.imovel.endereco) {
        const index = db.imoveis.findIndex(i => i.endereco === dados.imovel.endereco);
        const imovelData = {
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
        if (index >= 0) db.imoveis[index] = imovelData;
        else db.imoveis.push(imovelData);
    }
    
    localStorage.setItem('contratos_db_offline', JSON.stringify(db));
    mostrarMensagem('✓ Dados salvos localmente (offline)!', 'success');
}

// ============================================================
// 9. CLÁUSULAS
// ============================================================
function carregarClausulas() {
    const container = document.getElementById('clausulasContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const todasClausulas = [...CLAUSULAS, ...clausulasAdicionais];
    const ordenadas = todasClausulas.sort((a, b) => a.descricao.localeCompare(b.descricao));
    
    ordenadas.forEach(c => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = c.id;
        cb.id = 'claus_' + c.id;
        label.appendChild(cb);
        
        const texto = document.createElement('span');
        texto.textContent = ' ' + c.descricao;
        label.appendChild(texto);
        
        // Botão remover apenas para cláusulas adicionais
        if (clausulasAdicionais.some(ad => ad.id === c.id)) {
            const btnRemover = document.createElement('button');
            btnRemover.type = 'button';
            btnRemover.className = 'btn-remove-clausula';
            btnRemover.textContent = '✕';
            btnRemover.style.marginLeft = 'auto';
            btnRemover.onclick = function(e) {
                e.stopPropagation();
                removerClausula(c.id);
            };
            label.appendChild(btnRemover);
        }
        
        container.appendChild(label);
    });
}

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
    const novaClausula = { id: novoId, descricao: desc, texto: texto };
    
    // Salvar no Supabase se online
    if (dbStatus === 'online' && supabaseClient) {
        supabaseClient
            .from('clausulas')
            .insert({ descricao: desc, texto: texto, is_padrao: false })
            .then(({ error }) => {
                if (error) console.error('Erro ao salvar cláusula:', error);
            });
    }
    
    clausulasAdicionais.push(novaClausula);
    document.getElementById('novaClausulaDesc').value = '';
    document.getElementById('novaClausulaTexto').value = '';
    
    carregarClausulas();
    mostrarMensagem('✓ Cláusula adicionada com sucesso!', 'success');
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
                    if (error) console.error('Erro ao remover cláusula:', error);
                });
        }
        
        carregarClausulas();
        mostrarMensagem('✓ Cláusula removida!', 'success');
    }
}

// ============================================================
// 10. FORMATAR DADOS
// ============================================================
function formatarData(dataStr) {
    if (!dataStr) return 'a definir';
    const partes = dataStr.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function numeroPorExtenso(num) {
    const numeros = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
                    'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte',
                    'vinte e um', 'vinte e dois', 'vinte e três', 'vinte e quatro', 'vinte e cinco', 'vinte e seis',
                    'vinte e sete', 'vinte e oito', 'vinte e nove', 'trinta', 'trinta e um', 'trinta e dois',
                    'trinta e três', 'trinta e quatro', 'trinta e cinco', 'trinta e seis', 'trinta e sete',
                    'trinta e oito', 'trinta e nove', 'quarenta', 'quarenta e um', 'quarenta e dois', 'quarenta e três',
                    'quarenta e quatro', 'quarenta e cinco', 'quarenta e seis', 'quarenta e sete', 'quarenta e oito',
                    'quarenta e nove', 'cinquenta', 'cinquenta e um', 'cinquenta e dois', 'cinquenta e três',
                    'cinquenta e quatro', 'cinquenta e cinco', 'cinquenta e seis', 'cinquenta e sete',
                    'cinquenta e oito', 'cinquenta e nove', 'sessenta'];
    return numeros[num] || num;
}

function getNomeMes(num) {
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return meses[num - 1] || '';
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
// 11. MONTAR CONTRATO
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
    const fimFormatado = i.fim ? formatarData(i.fim) : `${formatarData(i.inicio) || 'a definir'}`;

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
    }\n\n`;

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
            texto += `Cláusula ${idx + 1}: ${c.descricao}\n`;
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

// ============================================================
// 12. GERAR PRÉVIA
// ============================================================
function gerarPrevia() {
    const dados = getDadosFormulario();
    const clausulas = getClausulasMarcadas();
    const texto = montarContrato(dados, clausulas);
    const previaDiv = document.getElementById('previa');
    previaDiv.textContent = texto;
    previaDiv.classList.add('visivel');
    previaDiv.scrollIntoView({ behavior: 'smooth' });
    mostrarMensagem('✓ Prévia gerada com sucesso!', 'success');
}

// ============================================================
// 13. GERAR PDF
// ============================================================
function gerarPDF() {
    const loading = document.getElementById('loading');
    loading.classList.add('ativo');
    loading.textContent = '⏳ Gerando PDF... Aguarde...';

    setTimeout(function() {
        try {
            if (typeof pdfMake === 'undefined') {
                throw new Error('Biblioteca pdfMake não carregada.');
            }

            const dados = getDadosFormulario();
            const clausulas = getClausulasMarcadas();

            if (!dados.locador.nome || !dados.locador.cpf) {
                alert('⚠️ Preencha Nome e CPF do Locador.');
                loading.classList.remove('ativo');
                return;
            }

            if (!dados.locatario.nome || !dados.locatario.cpf) {
                alert('⚠️ Preencha Nome e CPF do Locatário.');
                loading.classList.remove('ativo');
                return;
            }

            if (!dados.numContrato) {
                alert('⚠️ Informe o Número do Contrato.');
                loading.classList.remove('ativo');
                return;
            }

            if (!dados.imovel.endereco) {
                alert('⚠️ Informe o Endereço do Imóvel.');
                loading.classList.remove('ativo');
                return;
            }

            const textoContrato = montarContrato(dados, clausulas);

            function criarLinhas(texto) {
                return texto.split('\n').map(line => ({ 
                    text: line, 
                    fontSize: 10,
                    alignment: 'justify'
                }));
            }

            const cabecalhoVia = (titulo, nome, cpf) => {
                return `VIA DO ${titulo.toUpperCase()}\n${nome} - CPF: ${cpf}\n\n`;
            };

            const viaLocador = cabecalhoVia('locador', dados.locador.nome, dados.locador.cpf) + textoContrato;
            const viaLocatario = cabecalhoVia('locatário', dados.locatario.nome, dados.locatario.cpf) + textoContrato;

            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [40, 40, 40, 40],
                content: [
                    { stack: criarLinhas(viaLocador), style: 'body' },
                    { text: '', pageBreak: 'after' },
                    { stack: criarLinhas(viaLocatario), style: 'body' }
                ],
                styles: {
                    body: {
                        fontSize: 10,
                        lineHeight: 1.5,
                        alignment: 'justify'
                    }
                },
                defaultStyle: {
                    alignment: 'justify'
                },
                footer: function(currentPage, pageCount) {
                    return {
                        text: `Redigido por TWO A SEVEN - Digital Solutions | Página ${currentPage} de ${pageCount}`,
                        alignment: 'center',
                        fontSize: 8,
                        margin: [0, 0, 0, 15]
                    };
                }
            };

            const pdfDoc = pdfMake.createPdf(docDefinition);
            const nomeArquivo = `Contrato_${dados.numContrato.replace(/\//g, '_')}.pdf`;
            pdfDoc.download(nomeArquivo);
            
            loading.classList.remove('ativo');
            mostrarMensagem('✅ PDF gerado com sucesso!', 'success');

        } catch (error) {
            console.error('Erro detalhado:', error);
            alert('❌ Erro ao gerar PDF: ' + error.message);
            loading.classList.remove('ativo');
        }
    }, 300);
}

// ============================================================
// 14. GERENCIADOR
// ============================================================
async function abrirGerenciador() {
    const modal = document.getElementById('modalGerenciador');
    modal.classList.add('ativo');
    
    if (dbStatus === 'online' && supabaseClient) {
        await atualizarGerenciadorOnline();
    } else {
        atualizarGerenciadorOffline();
    }
}

function fecharGerenciador() {
    document.getElementById('modalGerenciador').classList.remove('ativo');
}

async function atualizarGerenciadorOnline() {
    try {
        let html = '';
        
        const { data: locadores } = await supabaseClient.from('locadores').select('*').order('id');
        html += `<h3>👤 Locadores (${locadores?.length || 0})</h3>`;
        if (locadores && locadores.length > 0) {
            html += `<table class="tabela-dados"><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Ações</th></tr>`;
            locadores.forEach(l => {
                html += `<tr><td>${l.nome}</td><td>${l.cpf}</td><td>${l.telefone || '-'}</td>
                    <td><button class="btn-excluir" onclick="excluirRegistroOnline('locadores', ${l.id})">✕</button></td></tr>`;
            });
            html += `</table>`;
        } else {
            html += `<p>Nenhum locador cadastrado.</p>`;
        }
        
        const { data: locatarios } = await supabaseClient.from('locatarios').select('*').order('id');
        html += `<h3>👤 Locatários (${locatarios?.length || 0})</h3>`;
        if (locatarios && locatarios.length > 0) {
            html += `<table class="tabela-dados"><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Ações</th></tr>`;
            locatarios.forEach(l => {
                html += `<tr><td>${l.nome}</td><td>${l.cpf}</td><td>${l.telefone || '-'}</td>
                    <td><button class="btn-excluir" onclick="excluirRegistroOnline('locatarios', ${l.id})">✕</button></td></tr>`;
            });
            html += `</table>`;
        } else {
            html += `<p>Nenhum locatário cadastrado.</p>`;
        }
        
        const { data: fiadores } = await supabaseClient.from('fiadores').select('*').order('id');
        html += `<h3>👤 Fiadores (${fiadores?.length || 0})</h3>`;
        if (fiadores && fiadores.length > 0) {
            html += `<table class="tabela-dados"><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Ações</th></tr>`;
            fiadores.forEach(f => {
                html += `<tr><td>${f.nome}</td><td>${f.cpf}</td><td>${f.telefone || '-'}</td>
                    <td><button class="btn-excluir" onclick="excluirRegistroOnline('fiadores', ${f.id})">✕</button></td></tr>`;
            });
            html += `</table>`;
        } else {
            html += `<p>Nenhum fiador cadastrado.</p>`;
        }
        
        const { data: imoveis } = await supabaseClient.from('imoveis').select('*').order('id');
        html += `<h3>🏠 Imóveis (${imoveis?.length || 0})</h3>`;
        if (imoveis && imoveis.length > 0) {
            html += `<table class="tabela-dados"><tr><th>Endereço</th><th>Tipo</th><th>Ações</th></tr>`;
            imoveis.forEach(i => {
                html += `<tr><td>${i.endereco}</td><td>${i.tipo || '-'}</td>
                    <td><button class="btn-excluir" onclick="excluirRegistroOnline('imoveis', ${i.id})">✕</button></td></tr>`;
            });
            html += `</table>`;
        } else {
            html += `<p>Nenhum imóvel cadastrado.</p>`;
        }
        
        document.getElementById('conteudoGerenciador').innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar gerenciador:', error);
        document.getElementById('conteudoGerenciador').innerHTML = '<p>❌ Erro ao carregar dados</p>';
    }
}

function atualizarGerenciadorOffline() {
    const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    let html = '';
    
    html += `<h3>👤 Locadores (${db.locadores?.length || 0})</h3>`;
    if (db.locadores && db.locadores.length > 0) {
        html += `<table class="tabela-dados"><tr><th>Nome</th><th>CPF</th><th>Telefone</th></tr>`;
        db.locadores.forEach(l => {
            html += `<tr><td>${l.nome}</td><td>${l.cpf}</td><td>${l.telefone || '-'}</td></tr>`;
        });
        html += `</table>`;
    } else {
        html += `<p>Nenhum locador cadastrado.</p>`;
    }
    
    document.getElementById('conteudoGerenciador').innerHTML = html;
}

async function excluirRegistroOnline(tabela, id) {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
        try {
            const { error } = await supabaseClient
                .from(tabela)
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            await atualizarGerenciadorOnline();
            mostrarMensagem('✓ Registro excluído!', 'success');
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir registro.');
        }
    }
}

// ============================================================
// 15. EXPORTAÇÃO E IMPORTAÇÃO
// ============================================================
function exportarDados() {
    if (dbStatus === 'online' && supabaseClient) {
        exportarDadosOnline();
    } else {
        exportarDadosOffline();
    }
}

async function exportarDadosOnline() {
    try {
        const [locadores, locatarios, fiadores, imoveis, clausulas] = await Promise.all([
            supabaseClient.from('locadores').select('*'),
            supabaseClient.from('locatarios').select('*'),
            supabaseClient.from('fiadores').select('*'),
            supabaseClient.from('imoveis').select('*'),
            supabaseClient.from('clausulas').select('*')
        ]);
        
        const dados = {
            locadores: locadores.data || [],
            locatarios: locatarios.data || [],
            fiadores: fiadores.data || [],
            imoveis: imoveis.data || [],
            clausulas: clausulas.data || [],
            exportado_em: new Date().toISOString()
        };
        
        const json = JSON.stringify(dados, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contratos_supabase_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        mostrarMensagem('✅ Dados exportados!', 'success');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        alert('Erro ao exportar dados.');
    }
}

function exportarDadosOffline() {
    const dados = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contratos_offline_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importarDados() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const data = JSON.parse(event.target.result);
                
                if (!data.locadores && !data.locatarios && !data.fiadores && !data.imoveis) {
                    alert('Arquivo inválido.');
                    return;
                }
                
                if (dbStatus === 'online' && supabaseClient) {
                    for (const item of data.locadores || []) {
                        await supabaseClient.from('locadores').upsert(item, { onConflict: 'cpf' });
                    }
                    for (const item of data.locatarios || []) {
                        await supabaseClient.from('locatarios').upsert(item, { onConflict: 'cpf' });
                    }
                    for (const item of data.fiadores || []) {
                        await supabaseClient.from('fiadores').upsert(item, { onConflict: 'cpf' });
                    }
                    for (const item of data.imoveis || []) {
                        await supabaseClient.from('imoveis').upsert(item, { onConflict: 'endereco' });
                    }
                    mostrarMensagem('✅ Dados importados com sucesso!', 'success');
                    await atualizarGerenciadorOnline();
                } else {
                    localStorage.setItem('contratos_db_offline', JSON.stringify(data));
                    mostrarMensagem('✅ Dados importados localmente!', 'success');
                }
            } catch (error) {
                alert('Erro ao importar dados: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function limparTodosDados() {
    if (!confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os dados cadastrados. Continuar?')) return;
    if (!confirm('Confirme novamente: Deseja realmente apagar todos os dados?')) return;
    
    if (dbStatus === 'online' && supabaseClient) {
        try {
            await supabaseClient.from('locadores').delete().neq('id', 0);
            await supabaseClient.from('locatarios').delete().neq('id', 0);
            await supabaseClient.from('fiadores').delete().neq('id', 0);
            await supabaseClient.from('imoveis').delete().neq('id', 0);
            await supabaseClient.from('clausulas').delete().neq('id', 0);
            
            mostrarMensagem('🗑️ Todos os dados foram removidos!', 'success');
            await atualizarGerenciadorOnline();
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
            alert('Erro ao limpar dados.');
        }
    } else {
        localStorage.removeItem('contratos_db_offline');
        mostrarMensagem('🗑️ Dados locais removidos!', 'success');
        atualizarGerenciadorOffline();
    }
}

// ============================================================
// 16. SINCronizar
// ============================================================
async function sincronizarDados() {
    if (dbStatus !== 'online' || !supabaseClient) {
        alert('⚠️ Modo offline. Conecte-se ao Supabase para sincronizar.');
        return;
    }
    
    try {
        mostrarMensagem('🔄 Sincronizando...', 'info');
        await carregarDadosIniciais();
        mostrarMensagem('✅ Dados sincronizados!', 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
        mostrarMensagem('❌ Erro na sincronização', 'error');
    }
}

async function carregarDadosIniciais() {
    try {
        const { data: clausulas } = await supabaseClient
            .from('clausulas')
            .select('*')
            .order('id');
            
        if (clausulas && clausulas.length > 0) {
            clausulasAdicionais = clausulas.map(c => ({
                id: String(c.id),
                descricao: c.descricao,
                texto: c.texto
            }));
            carregarClausulas();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// ============================================================
// 17. EXPOR FUNÇÕES GLOBAIS
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
