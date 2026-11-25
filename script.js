// ============================================================
// 1. CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL = 'https://uzsujdqyutzennhcjkyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6c3VqZHF5dXR6ZW5uaGNqa3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDcwNjAsImV4cCI6MjEwMjY4MzA2MH0.LSsLFovpMNcdhQkBu4qwLo9r_pU9xdITT32M01qI9QY';

let supabaseClient = null;
let dbStatus = 'offline';
let CLAUSULAS = [];
let clausulasAdicionais = [];

// ============================================================
// 2. MÁSCARAS E UTILITÁRIOS
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
        v = (parseInt(v, 10) / 100).toFixed(2);
        v = v.replace('.', ',');
        v = v.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    return v;
}

function aplicarMascara(e, tipo) {
    const input = e.target;
    if (tipo === 'cpf') input.value = mascaraCPF(input.value);
    else if (tipo === 'rg') input.value = mascaraRG(input.value);
    else if (tipo === 'telefone') input.value = mascaraTelefone(input.value);
    else if (tipo === 'valor') input.value = mascaraValor(input.value);
}

function removerMascara(v) {
    return (v || '').replace(/\D/g, '');
}

function mostrarMensagem(msg, tipo) {
    const el = document.getElementById('msgBusca');
    if (!el) return;
    el.textContent = msg;
    el.style.color = tipo === 'success' ? '#28a745' : tipo === 'error' ? '#dc3545' : '#ffc107';
    setTimeout(() => { if (el) el.textContent = ''; }, 5000);
}

function escaparHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');
}

function hojeISO() {
    return new Date().toISOString().split('T')[0];
}

// ============================================================
// 3. TOGGLES (FIADOR E OUTORGA CONJUGAL) + DATA
// ============================================================
function toggleOutorgaConjugal(checkbox) {
    const container = document.getElementById('camposConjugeFiadorContainer');
    if (!container) return;

    const ativo = Boolean(checkbox && checkbox.checked);
    container.style.display = ativo ? 'block' : 'none';

    if (!ativo) {
        container.querySelectorAll('input, select, textarea').forEach((campo) => {
            campo.value = '';
        });
    }
}

function toggleFiador(checkbox) {
    const container = document.getElementById('camposFiadorContainer');
    if (!container) return;

    const ativar = Boolean(checkbox && checkbox.checked);
    container.style.display = ativar ? 'block' : 'none';

    if (!ativar) {
        container.querySelectorAll('input, select, textarea').forEach((campo) => {
            if (campo.type === 'checkbox' || campo.type === 'radio') campo.checked = false;
            else campo.value = '';
        });
        toggleOutorgaConjugal(document.getElementById('outorgaConjugalFiador'));
    }
}

function sincronizarDataInicioComAssinatura() {
    const inicio = document.getElementById('dataInicio');
    const elab = document.getElementById('dataElaboracao');
    if (!inicio || !inicio.value) return;
    if (elab && elab.dataset.manual !== 'true') {
        elab.value = inicio.value;
    }
}

// ============================================================
// 4. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    const anoFooter = document.getElementById('anoFooter');
    if (anoFooter) anoFooter.textContent = new Date().getFullYear();

    bloquearCampoNumeroContrato();
    vincularEventosSequenciaContrato();
    atualizarNumeroContratoAutomatico(false);

    document.querySelectorAll('#locadorCpf, #locatarioCpf, #fiadorCpf, #fiadorConjugeCpf, #buscaCpf')
        .forEach(el => el.addEventListener('input', e => aplicarMascara(e, 'cpf')));

    document.querySelectorAll('#locadorRg, #locatarioRg, #fiadorRg, #fiadorConjugeRg')
        .forEach(el => el.addEventListener('input', e => aplicarMascara(e, 'rg')));

    document.querySelectorAll('#locadorTel, #locatarioTel, #fiadorTel')
        .forEach(el => el.addEventListener('input', e => aplicarMascara(e, 'telefone')));

    document.querySelectorAll('#imovelValor')
        .forEach(el => el.addEventListener('input', e => aplicarMascara(e, 'valor')));

    const dataInicioEl = document.getElementById('dataInicio');
    dataInicioEl?.addEventListener('change', sincronizarDataInicioComAssinatura);
    dataInicioEl?.addEventListener('input', sincronizarDataInicioComAssinatura);

    toggleFiador(document.getElementById('incluirFiador'));
    toggleOutorgaConjugal(document.getElementById('outorgaConjugalFiador'));

    initSupabase();
});

// ============================================================
// 5. SUPABASE E CLÁUSULAS
// ============================================================
async function initSupabase() {
    const statusDB = document.getElementById('statusDB');
    if (statusDB) {
        statusDB.textContent = '⏳ Conectando...';
        statusDB.className = 'status-db status-loading';
    }

    try {
        if (typeof supabase === 'undefined') throw new Error('SDK do Supabase não carregado');
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const { error } = await supabaseClient
            .from('clausulas')
            .select('count', { count: 'exact', head: true });
        if (error) throw error;

        dbStatus = 'online';
        if (statusDB) {
            statusDB.textContent = '✅ Online';
            statusDB.className = 'status-db status-online';
        }
        await carregarClausulasDoSupabase();
    } catch (_) {
        dbStatus = 'offline';
        if (statusDB) {
            statusDB.textContent = '⚠️ Offline (modo local)';
            statusDB.className = 'status-db status-offline';
        }
        usarClausulasFallback();
        carregarClausulas();
    }
}

async function carregarClausulasDoSupabase() {
    try {
        const { data, error } = await supabaseClient.from('clausulas').select('*').order('id');
        if (error) throw error;

        if (data && data.length > 0) {
            CLAUSULAS = data.filter(c => c.is_padrao === true).map(c => ({ id: String(c.id), descricao: c.descricao, texto: c.texto }));
            clausulasAdicionais = data.filter(c => c.is_padrao === false).map(c => ({ id: String(c.id), descricao: c.descricao, texto: c.texto }));
            carregarClausulas();
        } else {
            usarClausulasFallback();
            carregarClausulas();
        }
    } catch (_) {
        usarClausulasFallback();
        carregarClausulas();
    }
}

function usarClausulasFallback() {
    CLAUSULAS = [
        { id: 'fb1', descricao: 'Benfeitorias e Reformas', texto: 'O locatário poderá realizar benfeitorias úteis e voluptuárias mediante comunicação prévia ao locador.' },
        { id: 'fb2', descricao: 'Sublocação Proibida', texto: 'É vedada a sublocação total ou parcial do imóvel sem consentimento prévio e escrito do locador.' },
        { id: 'fb3', descricao: 'Visitação para Venda', texto: 'O locador poderá visitar o imóvel mediante agendamento prévio de 48 horas em horário comercial.' },
        { id: 'fb4', descricao: 'Responsabilidade por Danos', texto: 'O locatário responderá pelos danos causados ao imóvel, ressalvado o desgaste natural.' },
        { id: 'fb5', descricao: 'Renovação Antecipada', texto: 'A renovação poderá ser solicitada com antecedência mínima de 60 dias do término do prazo.' },
        { id: 'fb6', descricao: 'Silêncio e Tolerância', texto: 'A tolerância quanto a qualquer obrigação não constituirá novação ou renúncia de direitos.' }
    ];
    clausulasAdicionais = [];
}

function carregarClausulas() {
    const container = document.getElementById('clausulasContainer');
    if (!container) return;
    container.innerHTML = '';

    const todas = [...CLAUSULAS, ...clausulasAdicionais].sort((a, b) => a.descricao.localeCompare(b.descricao));
    for (const c of todas) {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = c.id;
        cb.id = 'claus_' + c.id;
        cb.checked = c.id.startsWith('fb');
        label.appendChild(cb);

        const span = document.createElement('span');
        span.textContent = ' ' + c.descricao;
        label.appendChild(span);
        container.appendChild(label);
    }
}

function getClausulasMarcadas() {
    const ids = Array.from(document.querySelectorAll('#clausulasContainer input[type="checkbox"]:checked')).map(cb => cb.value);
    return [...CLAUSULAS, ...clausulasAdicionais].filter(c => ids.includes(c.id));
}

// ============================================================
// 6. BUSCA E PREENCHIMENTO
// ============================================================
async function buscarPorCpf() {
    const cpfInput = document.getElementById('buscaCpf');
    if (!cpfInput || !cpfInput.value.trim()) {
        alert('Digite um CPF para buscar.');
        return;
    }
    const cpfLimpo = removerMascara(cpfInput.value.trim());

    if (dbStatus === 'online' && supabaseClient) {
        try {
            let encontrado = false;
            const { data: locador } = await supabaseClient.from('locadores').select('*').eq('cpf', cpfLimpo).maybeSingle();
            if (locador) { preencherParte('locador', locador); encontrado = true; }

            const { data: locatario } = await supabaseClient.from('locatarios').select('*').eq('cpf', cpfLimpo).maybeSingle();
            if (locatario) { preencherParte('locatario', locatario); encontrado = true; }

            const { data: fiador } = await supabaseClient.from('fiadores').select('*').eq('cpf', cpfLimpo).maybeSingle();
            if (fiador) { preencherParte('fiador', fiador); encontrado = true; }

            if (!encontrado) alert('Nenhum cadastro encontrado para este CPF.');
            else mostrarMensagem('✓ Cadastro carregado!', 'success');
        } catch (err) {
            console.error(err);
            mostrarMensagem('❌ Erro na busca', 'error');
        }
    } else {
        const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
        let encontrado = false;
        const l = db.locadores?.find(x => removerMascara(x.cpf) === cpfLimpo);
        if (l) { preencherParte('locador', l); encontrado = true; }
        const lt = db.locatarios?.find(x => removerMascara(x.cpf) === cpfLimpo);
        if (lt) { preencherParte('locatario', lt); encontrado = true; }
        const f = db.fiadores?.find(x => removerMascara(x.cpf) === cpfLimpo);
        if (f) { preencherParte('fiador', f); encontrado = true; }
        if (!encontrado) alert('Nenhum cadastro encontrado para este CPF.');
    }
}

function preencherParte(prefixo, dados) {
    const map = {
        [`${prefixo}Nome`]: 'nome',
        [`${prefixo}Cpf`]: 'cpf',
        [`${prefixo}Rg`]: 'rg',
        [`${prefixo}Nacionalidade`]: 'nacionalidade',
        [`${prefixo}Profissao`]: 'profissao',
        [`${prefixo}End`]: 'endereco',
        [`${prefixo}Tel`]: 'telefone',
        [`${prefixo}Email`]: 'email'
    };
    for (const [id, key] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = dados[key] || '';
    }
    const ec = document.getElementById(`${prefixo}EstadoCivil`);
    if (ec && dados.estado_civil) ec.value = dados.estado_civil;

    if (prefixo === 'fiador') {
        const cbFiador = document.getElementById('incluirFiador');
        if (cbFiador && !cbFiador.checked) {
            cbFiador.checked = true;
            toggleFiador(cbFiador);
        }
        const cNome = document.getElementById('fiadorConjugeNome');
        const cCpf = document.getElementById('fiadorConjugeCpf');
        const cRg = document.getElementById('fiadorConjugeRg');
        if (cNome) cNome.value = dados.conjuge_nome || '';
        if (cCpf) cCpf.value = dados.conjuge_cpf || '';
        if (cRg) cRg.value = dados.conjuge_rg || '';

        const temConjuge = Boolean(dados.conjuge_nome || dados.conjuge_cpf || dados.conjuge_rg);
        const cbConjuge = document.getElementById('outorgaConjugalFiador');
        if (cbConjuge) {
            cbConjuge.checked = temConjuge;
            toggleOutorgaConjugal(cbConjuge);
        }
    }

    if (prefixo === 'locador' || prefixo === 'locatario') {
        atualizarNumeroContratoAutomatico(true);
    }
}

function selecionarImovelPorDropdown(valor) {
    const campos = ['imovelEnd', 'imovelRegistro', 'imovelCartorio', 'imovelInscricaoMunicipal', 'imovelTipo', 'imovelDestinacao'];
    if (!valor) {
        campos.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = id === 'imovelDestinacao' ? 'Residencial' : '';
        });
        return;
    }
    const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    const imovel = (db.imoveis || []).find(item => item.endereco === valor);
    if (!imovel) return;

    document.getElementById('imovelEnd').value = imovel.endereco || '';
    document.getElementById('imovelRegistro').value = imovel.registro || '';
    document.getElementById('imovelCartorio').value = imovel.cartorio || '';
    document.getElementById('imovelInscricaoMunicipal').value = imovel.inscricao_municipal || '';
    document.getElementById('imovelTipo').value = imovel.tipo || '';
    document.getElementById('imovelDestinacao').value = imovel.destinacao || 'Residencial';
}

// ============================================================
// 7. DADOS DO FORMULÁRIO E MONTAGEM DO CONTRATO
// ============================================================
function getDadosFormulario() {
    const getVal = id => (document.getElementById(id)?.value || '').trim();
    const getSelect = id => document.getElementById(id)?.value || '';
    const getChecked = id => Boolean(document.getElementById(id)?.checked);

    const dataInicio = getVal('dataInicio');
    const dataValidade = getVal('dataValidade');
    const dataElaboracao = getVal('dataElaboracao') || dataInicio || hojeISO();

    return {
        numContrato: getVal('numContrato'),
        dataInicio,
        dataValidade,
        dataElaboracao,
        foroCidade: 'Manaus',
        locador: {
            nome: getVal('locadorNome'),
            nacionalidade: getVal('locadorNacionalidade'),
            estadoCivil: getSelect('locadorEstadoCivil'),
            profissao: getVal('locadorProfissao'),
            rg: getVal('locadorRg'),
            cpf: getVal('locadorCpf'),
            endereco: getVal('locadorEnd'),
            telefone: getVal('locadorTel'),
            email: getVal('locadorEmail')
        },
        locatario: {
            nome: getVal('locatarioNome'),
            nacionalidade: getVal('locatarioNacionalidade'),
            estadoCivil: getSelect('locatarioEstadoCivil'),
            profissao: getVal('locatarioProfissao'),
            rg: getVal('locatarioRg'),
            cpf: getVal('locatarioCpf'),
            endereco: getVal('locatarioEnd'),
            telefone: getVal('locatarioTel'),
            email: getVal('locatarioEmail')
        },
        fiadorAtivo: getChecked('incluirFiador'),
        fiador: {
            nome: getVal('fiadorNome'),
            nacionalidade: getVal('fiadorNacionalidade'),
            estadoCivil: getSelect('fiadorEstadoCivil'),
            profissao: getVal('fiadorProfissao'),
            rg: getVal('fiadorRg'),
            cpf: getVal('fiadorCpf'),
            endereco: getVal('fiadorEnd'),
            telefone: getVal('fiadorTel'),
            email: getVal('fiadorEmail'),
            outorgaConjugal: getChecked('outorgaConjugalFiador'),
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
            valor: getVal('imovelValor'),
            vencimento: getSelect('imovelVencimento') || '5',
            indice: getSelect('imovelIndice') || 'IPCA'
        },
        encargos: {
            iptu: getSelect('iptuResponsavel'),
            condominio: getSelect('condominioResponsavel'),
            agua: getSelect('aguaResponsavel'),
            luz: getSelect('luzResponsavel'),
            gas: getSelect('gasResponsavel'),
            seguro: getSelect('seguroResponsavel')
        }
    };
}

function formatarData(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return '';
    const partes = dataStr.trim().split('-');
    if (partes.length !== 3) return dataStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
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
        dias += new Date(anoFim, mesFim - 1, 0).getDate();
    }
    if (meses < 0) {
        anos -= 1;
        meses += 12;
    }

    const partes = [];
    if (anos > 0) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`);
    if (dias > 0) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
    return partes.join(', ');
}

function montarContrato(dados, clausulas) {
    const d = dados || {};
    const l = d.locador || {};
    const lt = d.locatario || {};
    const f = d.fiador || {};
    const i = d.imovel || {};
    const e = d.encargos || {};
    const listaClausulas = Array.isArray(clausulas) ? clausulas : [];

    const inicioBR = formatarData(d.dataInicio) || '??/??/????';
    const fimBR = formatarData(d.dataValidade) || '??/??/????';
    const duracao = calcularDuracaoExtenso(d.dataInicio, d.dataValidade);
    const textoValidade = duracao ? `De ${inicioBR} a ${fimBR} (${duracao})` : `De ${inicioBR} a ${fimBR}`;
    const dataAssinaturaBR = formatarData(d.dataElaboracao) || inicioBR;
    const cidade = d.foroCidade || 'Manaus';

    const temFiador = Boolean(
        d.fiadorAtivo && (
            f.nome || f.cpf || f.rg || f.endereco || f.telefone || f.email
        )
    );

    const detalhesImovel = [
        i.registro ? `Matrícula/Registro: ${escaparHtml(i.registro)}` : '',
        i.cartorio ? `Cartório: ${escaparHtml(i.cartorio)}` : '',
        i.inscricaoMunicipal ? `Inscrição Municipal/IPTU: ${escaparHtml(i.inscricaoMunicipal)}` : '',
        i.tipo ? `Tipo: ${escaparHtml(i.tipo)}` : '',
        i.quartos ? `Quartos: ${escaparHtml(i.quartos)}` : '',
        i.banheiros ? `Banheiros: ${escaparHtml(i.banheiros)}` : '',
        i.vagas ? `Vagas: ${escaparHtml(i.vagas)}` : '',
        i.metragem ? `Metragem: ${escaparHtml(i.metragem)} m²` : '',
        i.areaPrivativa ? `Área Privativa: ${escaparHtml(i.areaPrivativa)} m²` : '',
        i.areaComum ? `Área Comum: ${escaparHtml(i.areaComum)} m²` : '',
        i.caracteristicas ? `Características: ${escaparHtml(i.caracteristicas)}` : ''
    ].filter(Boolean).join('; ');

    let html = `
        <div class="doc-titulo">*** CONTRATO DE LOCAÇÃO DE IMÓVEL ***</div>
        <div class="doc-meta">
            <div><strong>CONTRATO Nº:</strong> ${escaparHtml(d.numContrato || '')}</div>
            <div><strong>VALIDADE DO CONTRATO:</strong> ${escaparHtml(textoValidade)}</div>
        </div>

        <hr class="doc-divisor" />
        <div class="doc-lei">
            Este contrato segue as normas da Lei do Inquilinato (Lei nº 8.245/91) e do Código Civil Brasileiro.<br />
            <div class="doc-aviso-importante">
                <div class="doc-aviso-titulo">IMPORTANTE:</div>
                <ul class="doc-aviso-lista">
                    <li><strong>Autenticação em Cartório:</strong><br>
                    Este documento deverá ser autenticado em cartório para reforçar a autenticidade das assinaturas e garantir maior segurança jurídica.</li>
                    <li><strong>Assessoria Jurídica:</strong><br>
                    Recomenda-se a análise prévia por advogado do setor imobiliário antes da assinatura.</li>
                </ul>
            </div>
        </div>

        <hr class="doc-divisor" />
        <div class="doc-secao">1. QUALIFICAÇÃO DAS PARTES</div>
        <p class="doc-paragrafo">
            <strong>LOCADOR (PROPRIETÁRIO):</strong> ${escaparHtml(l.nome)}, nacionalidade ${escaparHtml(l.nacionalidade)},
            estado civil ${escaparHtml(l.estadoCivil)}, profissão ${escaparHtml(l.profissao)}, RG nº ${escaparHtml(l.rg)},
            CPF nº ${escaparHtml(l.cpf)}, residente em ${escaparHtml(l.endereco)}, telefone ${escaparHtml(l.telefone)}, e-mail ${escaparHtml(l.email)}.
        </p>
        <p class="doc-paragrafo">
            <strong>LOCATÁRIO (INQUILINO):</strong> ${escaparHtml(lt.nome)}, nacionalidade ${escaparHtml(lt.nacionalidade)},
            estado civil ${escaparHtml(lt.estadoCivil)}, profissão ${escaparHtml(lt.profissao)}, RG nº ${escaparHtml(lt.rg)},
            CPF nº ${escaparHtml(lt.cpf)}, residente em ${escaparHtml(lt.endereco)}, telefone ${escaparHtml(lt.telefone)}, e-mail ${escaparHtml(lt.email)}.
        </p>
    `;

    if (temFiador) {
        const textoConjuge = f.outorgaConjugal
            ? `, com outorga conjugal de ${escaparHtml(f.conjugeNome || 'não informado')}, CPF nº ${escaparHtml(f.conjugeCpf || 'não informado')}, RG nº ${escaparHtml(f.conjugeRg || 'não informado')}`
            : '';

        html += `
        <p class="doc-paragrafo">
            <strong>FIADOR:</strong> ${escaparHtml(f.nome)}, nacionalidade ${escaparHtml(f.nacionalidade)},
            estado civil ${escaparHtml(f.estadoCivil)}, profissão ${escaparHtml(f.profissao)}, RG nº ${escaparHtml(f.rg)},
            CPF nº ${escaparHtml(f.cpf)}, residente em ${escaparHtml(f.endereco)}, telefone ${escaparHtml(f.telefone)}, e-mail ${escaparHtml(f.email)}${textoConjuge}.
        </p>`;
    }

    html += `
        <hr class="doc-divisor" />
        <div class="doc-secao">2. OBJETO DO CONTRATO</div>
        <p class="doc-paragrafo">
            Locação do imóvel situado em <strong>${escaparHtml(i.endereco)}</strong>${detalhesImovel ? ` (${detalhesImovel})` : ''},
            destinado exclusivamente ao uso <strong>${escaparHtml((i.destinacao || '').toLowerCase())}</strong>.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">3. PRAZO DA LOCAÇÃO</div>
        <p class="doc-paragrafo">
            Vigência: <strong>${escaparHtml(textoValidade)}</strong>.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">4. VALOR E REAJUSTE</div>
        <p class="doc-paragrafo">
            Aluguel mensal de <strong>R$ ${escaparHtml(i.valor)}</strong>, vencimento todo dia <strong>${escaparHtml(i.vencimento)}</strong>,
            reajustado anualmente pelo índice <strong>${escaparHtml(i.indice)}</strong>.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">5. ENCARGOS E TRIBUTOS</div>
        <p class="doc-paragrafo">
            <strong>IPTU:</strong> ${escaparHtml(e.iptu)};
            <strong>Condomínio:</strong> ${escaparHtml(e.condominio)};
            <strong>Água:</strong> ${escaparHtml(e.agua)};
            <strong>Luz:</strong> ${escaparHtml(e.luz)};
            <strong>Gás:</strong> ${escaparHtml(e.gas)};
            <strong>Seguro Incêndio:</strong> ${escaparHtml(e.seguro)}.
        </p>

        <hr class="doc-divisor" />
        <div class="doc-secao">6. CLÁUSULAS ADICIONAIS</div>
    `;

    if (listaClausulas.length > 0) {
        listaClausulas.forEach((c, idx) => {
            html += `<p class="doc-paragrafo"><strong>Cláusula ${idx + 1} (${escaparHtml(c.descricao)}):</strong> ${escaparHtml(c.texto)}</p>`;
        });
    } else {
        html += `<p class="doc-paragrafo">Nenhuma cláusula adicional selecionada.</p>`;
    }

    html += `
        <hr class="doc-divisor" />
        <div class="doc-local-data">${escaparHtml(cidade)}, ${escaparHtml(dataAssinaturaBR)}.</div>
        <div class="doc-assinaturas">
            <div class="doc-assinatura-item">Assinatura do LOCADOR</div>
            <div class="doc-assinatura-item">Assinatura do LOCATÁRIO</div>
            ${temFiador ? '<div class="doc-assinatura-item">Assinatura do FIADOR</div>' : ''}
        </div>
    `;

    return html;
}

function gerarPrevia() {
    const previaDiv = document.getElementById('previa');
    const areaImprimir = document.getElementById('acaoImprimirPrevia');
    if (!previaDiv) return;

    previaDiv.innerHTML = montarContrato(getDadosFormulario(), getClausulasMarcadas());
    previaDiv.classList.add('visivel');
    if (areaImprimir) areaImprimir.style.display = 'flex';
    previaDiv.scrollIntoView({ behavior: 'smooth' });
}

function imprimirPreviaLimpa() {
    const previaDiv = document.getElementById('previa');
    if (!previaDiv || !previaDiv.innerHTML.trim()) {
        alert('Gere a prévia do contrato antes de imprimir.');
        return;
    }

    const estilos = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML).join('\n');

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
        alert('Permita pop-ups para abrir a impressão.');
        return;
    }

    win.document.write(`
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Contrato</title>${estilos}
        <style>@page{size:A4;margin:14mm;}body{background:#fff!important;color:#111!important;margin:0!important;}</style>
        </head><body><div id="previa" class="previa visivel">${previaDiv.innerHTML}</div>
        <script>window.onload=()=>setTimeout(()=>window.print(),200);</script></body></html>
    `);
    win.document.close();
}

// ============================================================
// 8. SEQUÊNCIA AUTOMÁTICA DO NÚMERO DO CONTRATO
// ============================================================
function bloquearCampoNumeroContrato() {
    const inputNum = document.getElementById('numContrato');
    if (!inputNum) return;
    inputNum.readOnly = true;
    inputNum.setAttribute('readonly', 'readonly');
    inputNum.classList.add('campo-bloqueado', 'num-contrato-automatico');
}

function gerarChavePartes(cpfLocador, cpfLocatario) {
    const cpfL = removerMascara(cpfLocador);
    const cpfLt = removerMascara(cpfLocatario);
    if (cpfL.length !== 11 || cpfLt.length !== 11) return '';
    return `${cpfL}_${cpfLt}`;
}

function obterUltimaSequenciaLocal(chave) {
    if (!chave) return 0;
    const db = JSON.parse(localStorage.getItem('contratos_db_offline') || '{}');
    const lista = Array.isArray(db.contratos) ? db.contratos : [];
    return lista
        .filter(item => item.chave_partes === chave)
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
    if (!forcarAtualizacao && !chaveMudou && inputNum.dataset.sequencia) return;

    const proximaSeq = Math.max(obterUltimaSequenciaLocal(chave), await obterUltimaSequenciaSupabase(chave)) + 1;
    inputNum.dataset.chaveAtual = chave;
    inputNum.dataset.sequencia = String(proximaSeq);
    inputNum.value = `${ano}/${String(proximaSeq).padStart(3, '0')}`;
}

function vincularEventosSequenciaContrato() {
    const inputCpfL = document.getElementById('locadorCpf');
    const inputCpfLt = document.getElementById('locatarioCpf');
    const aoAlterarCpf = () => atualizarNumeroContratoAutomatico(false);

    inputCpfL?.addEventListener('input', aoAlterarCpf);
    inputCpfL?.addEventListener('change', aoAlterarCpf);
    inputCpfLt?.addEventListener('input', aoAlterarCpf);
    inputCpfLt?.addEventListener('change', aoAlterarCpf);
}

// ============================================================
// 9. GLOBAIS
// ============================================================
window.toggleFiador = toggleFiador;
window.toggleOutorgaConjugal = toggleOutorgaConjugal;
window.buscarPorCpf = buscarPorCpf;
window.selecionarImovelPorDropdown = selecionarImovelPorDropdown;
window.gerarPrevia = gerarPrevia;
window.imprimirPreviaLimpa = imprimirPreviaLimpa;
window.atualizarNumeroContratoAutomatico = atualizarNumeroContratoAutomatico;
