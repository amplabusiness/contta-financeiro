import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { formatCurrency } from '@/data/expensesData';

interface ClientData {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
}

interface ClientPayment {
  client_id: string;
  client_name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  amount: number;
  account_code?: string | null;
}

interface InvoiceRecord {
  id: string;
  client_id: string;
  amount: number;
  paid_date: string | null;
  status: string;
  clients?: ClientData | ClientData[] | null;
}

type BankClientRow = {
  documento?: string;
  numeroboleto?: string;
  pagador?: string;
  dataVencimento?: string | null;
  dataLiquidacao?: string | null;
  valorBoleto?: number;
  valorRecebido?: number;
  dataExtrato?: string | null;
};

type CoaRow = { id: string; code: string; name: string | null };

interface CollectionClientBreakdownProps {
  cobrancaDoc: string;  // e.g., "COB000005"
  amount: number;
  transactionDate?: string;  // Data da transação para filtro adicional
}

export function CollectionClientBreakdown({ cobrancaDoc, amount, transactionDate }: CollectionClientBreakdownProps) {
  const [expanded, setExpanded] = useState(true);  // Por padrão expanded
  const [clients, setClients] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [coaOptions, setCoaOptions] = useState<CoaRow[]>([]);
  const [pendingLink, setPendingLink] = useState<Record<string, string>>({}); // nome_cliente -> code selecionado

  useEffect(() => {
    console.log('CollectionClientBreakdown - cobrancaDoc:', cobrancaDoc, 'amount:', amount, 'date:', transactionDate);
    
    if (!cobrancaDoc) {
      console.log('Sem cobrancaDoc, retornando');
      return;  // Sempre buscar quando houver cobrancaDoc
    }

    const fetchClients = async () => {
      console.log('Iniciando fetch de clientes para:', cobrancaDoc, 'com amount:', amount, 'date:', transactionDate);
      setLoading(true);
      try {
        // 1) Fonte de verdade: arquivo do banco (baixa clientes) via dev API
        try {
          const params = new URLSearchParams({ doc: cobrancaDoc });
          if (transactionDate) params.set('date', transactionDate);

          // Helper para tentar um endpoint e garantir JSON
          const tryFetchJson = async (url: string) => {
            const r = await fetch(url, { headers: { Accept: 'application/json' } });
            const ct = r.headers.get('content-type') || '';
            console.log('fetch', url, 'status', r.status, 'ct', ct);
            if (!ct.toLowerCase().includes('application/json')) return null;
            try {
              return await r.json();
            } catch {
              return null;
            }
          };

          // 1a tentativa: via proxy /api
          console.log('Tentando baixa-clientes via /api ...');
          let json = await tryFetchJson(`/api/baixa-clientes?${params.toString()}`);
          // 2a tentativa: rota direta sem prefixo (proxy dedicado)
          if (!json) {
            console.log('Sem JSON em /api, tentando via /baixa-clientes ...');
            json = await tryFetchJson(`/baixa-clientes?${params.toString()}`);
          }
          // 3a tentativa: chamada absoluta direto no dev-server (evita proxy do Vite)
          // FIXME: Isso é apenas para dev local e falhará em produção (SSL/HTTPS/Localhost)
          if (!json && process.env.NODE_ENV === 'development') {
            const abs = `http://127.0.0.1:8082/api/baixa-clientes?${params.toString()}`;
            console.log('Sem JSON no proxy, tentando absoluto (HTTP):', abs);
            try {
                json = await tryFetchJson(abs);
            } catch (err) {
                console.warn('Falha ao conectar com dev-server local:', err);
            }
          }

          // 4a tentativa: leitura direta do CSV público (servido por /banco)
          if (!json) {
            const d = transactionDate ? new Date(transactionDate) : null;
            const m = d ? d.getMonth() + 1 : 1;
            const csvPath = m === 2 ? '/banco/clientes%20de%20boleto%20fev.csv' : '/banco/clientes%20boletos%20jan.csv';
            console.log('Sem JSON absoluto. Tentando CSV direto em', csvPath);
            try {
              const csvResp = await fetch(csvPath);
              const text = csvResp.ok ? await csvResp.text() : '';
              if (text) {
                const parseDateBR = (s: string | undefined) => {
                  if (!s) return null;
                  const [dd, mm, yyyy] = String(s).split('/');
                  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                  if (Number.isNaN(dt.getTime())) return null;
                  return dt.toISOString().slice(0, 10);
                };
                const parseMoneyBR = (s: string | undefined) => {
                  const cleaned = String(s || '').replace(/\./g, '').replace(',', '.');
                  const n = parseFloat(cleaned);
                  return Number.isFinite(n) ? n : 0;
                };
                const wantDoc = (cobrancaDoc || '').toUpperCase().replace(/^C?OB/, 'OB');
                const matchDoc = (v: string) => String(v || '').toUpperCase().replace(/^C?OB/, 'OB') === wantDoc;
                const wantDate = transactionDate ? new Date(transactionDate).toISOString().slice(0, 10) : null;
                const lines = text.trim().split(/\r?\n/);
                const out: BankClientRow[] = [];
                for (let i = 1; i < lines.length; i++) {
                  const parts = lines[i].split(';').map((p) => p.trim());
                  if (parts.length < 8) continue;
                  const [documento, numeroboleto, pagador, dataVencStr, dataLiqStr, valorBolStr, valorRecStr, dataExtratoStr] = parts;
                  if (!matchDoc(documento)) continue;
                  const row: BankClientRow = {
                    documento,
                    numeroboleto,
                    pagador,
                    dataVencimento: parseDateBR(dataVencStr),
                    dataLiquidacao: parseDateBR(dataLiqStr),
                    valorBoleto: parseMoneyBR(valorBolStr),
                    valorRecebido: parseMoneyBR(valorRecStr),
                    dataExtrato: parseDateBR(dataExtratoStr),
                  };
                  if (wantDate && row.dataExtrato !== wantDate) continue;
                  out.push(row);
                }
                if (out.length) {
                  const baseList = out.map((r) => ({
                    client_id: '',
                    client_name: r.pagador || 'Cliente',
                    amount: Number(r.valorRecebido) || 0,
                    cnpj: undefined,
                    email: undefined,
                    phone: undefined,
                    account_code: null as string | null,
                  }));
                  
                  // Fetch COA list and rules in parallel for better performance
                  const [coaResult, rulesResult] = await Promise.all([
                    supabase
                      .from('chart_of_accounts')
                      .select('id, code, name')
                      .ilike('code', '1.1.2.01%'),
                    supabase
                      .from('intelligence_rules')
                      .select('pattern, account_code')
                      .ilike('account_code', '1.1.2.01%')
                  ]);
                  
                  const coaList = coaResult.data || [];
                  setCoaOptions(coaList);
                  
                  // Build rule map with normalized patterns
                  const ruleMap = new Map<string, string>();
                  const normRule = (s?: string) => (s || '')
                    .toLowerCase().normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/\b(ltda|eireli|me|epp|s\/a|sa|-?\s*me)\b/g, '')
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .replace(/\s+/g, ' ').trim();
                  
                  (rulesResult.data || []).forEach(r => {
                    ruleMap.set(normRule(r.pattern as string), r.account_code as string);
                  });
                  
                  // Normalize function
                  const normalize = (s?: string) => (s || '')
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/\b(ltda|eireli|me|epp|s\/a|sa|-?\s*me)\b/g, '')
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .replace(/companhia/g, 'companhia')
                    .replace(/caopanhia/g, 'companhia')
                    .replace(/caopanhia/g, 'companhia')
                    .replace(/\s+/g, ' ')
                    .trim();
                  
                  // Pre-normalize COA names and convert to word sets for faster matching
                  const normalizedCoa = coaList.map(a => ({
                    ...a,
                    normalizedName: normalize(a.name),
                    nameWords: new Set(normalize(a.name).split(' '))
                  }));
                  
                  // Optimized similarity using pre-computed word sets
                  const similarity = (wordsA: Set<string>, wordsB: Set<string>) => {
                    if (wordsA.size === 0 || wordsB.size === 0) return 0;
                    const inter = [...wordsA].filter((w) => wordsB.has(w)).length;
                    return inter / Math.max(wordsA.size, wordsB.size);
                  };
                  
                  const withAccounts = baseList.map((c) => {
                    const normalizedClientName = normalize(c.client_name);
                    
                    // Check rule first (fastest)
                    const fromRule = ruleMap.get(normalizedClientName);
                    if (fromRule) {
                      return { ...c, account_code: fromRule };
                    }
                    
                    // Try substring match (fast)
                    let acc = normalizedCoa.find((a) => a.normalizedName.includes(normalizedClientName));
                    
                    // Fuzzy match if needed
                    if (!acc) {
                      const clientWords = new Set(normalizedClientName.split(' '));
                      let best: { item: typeof normalizedCoa[0]; score: number } | null = null;
                      for (const a of normalizedCoa) {
                        const score = similarity(clientWords, a.nameWords);
                        if (!best || score > best.score) {
                          best = { item: a, score };
                        }
                      }
                      if (best && best.score >= 0.6) acc = best.item;
                    }
                    
                    return { ...c, account_code: acc?.code || null };
                  });
                  
                  setClients(withAccounts);
                  setLoading(false);
                  return;
                }
              }
            } catch (csvErr) {
              console.warn('Falha ao ler CSV direto:', csvErr);
            }
          }

            if (json && Array.isArray(json.clientes) && json.clientes.length > 0) {
              console.log('Baixa-clientes (banco) encontrada:', json);
              const rows = json.clientes as BankClientRow[];
              // Montar lista diretamente do banco (sem depender de invoices), mantendo soma == amount
              const baseList = rows.map((r) => ({
                client_id: '',
                client_name: r.pagador || 'Cliente',
                amount: Number(r.valorRecebido) || 0,
                cnpj: undefined,
                email: undefined,
                phone: undefined,
                account_code: null as string | null,
              }));

              // Fetch COA list and rules in parallel
              const [coaResult, rulesResult] = await Promise.all([
                supabase
                  .from('chart_of_accounts')
                  .select('id, code, name')
                  .ilike('code', '1.1.2.01%'),
                supabase
                  .from('intelligence_rules')
                  .select('pattern, account_code')
                  .ilike('account_code', '1.1.2.01%')
              ]);
              
              const coaList = coaResult.data || [];
              if (coaResult.error) console.warn('Falha ao buscar plano de contas de clientes:', coaResult.error);
              setCoaOptions(coaList);
              
              // Build rule map
              const ruleMap = new Map<string, string>();
              const normRule = (s?: string) => (s || '')
                .toLowerCase().normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\b(ltda|eireli|me|epp|s\/a|sa|-?\s*me)\b/g, '')
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ').trim();
              
              (rulesResult.data || []).forEach(r => {
                ruleMap.set(normRule(r.pattern as string), r.account_code as string);
              });

              const normalize = (s?: string) => (s || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\b(ltda|eireli|me|epp|s\/a|sa|-?\s*me)\b/g, '')
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/companhia/g, 'companhia')
                .replace(/caopanhia/g, 'companhia')
                .replace(/\s+/g, ' ')
                .trim();
              
              // Pre-normalize COA for performance
              const normalizedCoa = coaList.map(a => ({
                ...a,
                normalizedName: normalize(a.name),
                nameWords: new Set(normalize(a.name).split(' '))
              }));
              
              const similarity = (wordsA: Set<string>, wordsB: Set<string>) => {
                if (wordsA.size === 0 || wordsB.size === 0) return 0;
                const inter = [...wordsA].filter((w) => wordsB.has(w)).length;
                return inter / Math.max(wordsA.size, wordsB.size);
              };

              const withAccounts = baseList.map((c) => {
                const normalizedClientName = normalize(c.client_name);
                
                // Check rule first
                const fromRule = ruleMap.get(normalizedClientName);
                if (fromRule) {
                  return { ...c, account_code: fromRule };
                }
                
                // Substring match
                let acc = normalizedCoa.find((a) => a.normalizedName.includes(normalizedClientName));
                
                // Fuzzy match
                if (!acc) {
                  const clientWords = new Set(normalizedClientName.split(' '));
                  let best: { item: typeof normalizedCoa[0]; score: number } | null = null;
                  for (const a of normalizedCoa) {
                    const score = similarity(clientWords, a.nameWords);
                    if (!best || score > best.score) {
                      best = { item: a, score };
                    }
                  }
                  if (best && best.score >= 0.6) acc = best.item;
                }
                return { ...c, account_code: acc?.code || null };
              });

              setClients(withAccounts);
              setLoading(false);
              return; // Já atendeu pela fonte do banco
            } else {
              console.log('Baixa-clientes não retornou clientes (JSON ausente ou vazio). Prosseguindo com fallback invoices.');
            }
        } catch (e) {
          console.warn('Falha ao consultar baixa-clientes API, tentando via invoices...', e);
        }

        // 2) Fallback: inferir via Supabase (invoices pagas na data / D-1)
        // Buscar transação bancária da cobrança - FILTRANDO POR COB + AMOUNT + DATA
        let query = supabase
          .from('bank_transactions')
          .select('id, amount, transaction_date, description')
          .ilike('description', `%${cobrancaDoc}%`)
          .eq('amount', amount);
        
        // Se temos a data, usar para filtro mais preciso
        if (transactionDate) {
          query = query.eq('transaction_date', transactionDate);
        }
        
        const { data: bankTxList, error: bankError } = await query.limit(1);

        console.log('Resultado banco:', { bankTxList, bankError });

        if (bankError || !bankTxList || bankTxList.length === 0) {
          console.warn('Banco de cobrança não encontrado:', bankError);
          setClients([]);
          return;
        }

        const bankTx = bankTxList[0];
        console.log('Banco encontrado:', bankTx);

        async function findMatchesForDate(dateStr: string): Promise<InvoiceRecord[]> {
          const { data, error } = await supabase
            .from('invoices')
            .select(`
              id,
              client_id,
              amount,
              paid_date,
              status,
              clients(id, name, cnpj, email, phone)
            `)
            .eq('status', 'paid')
            .eq('paid_date', dateStr)
            .order('amount', { ascending: false });
          if (error) {
            console.error('Erro ao buscar invoices (por data):', error);
            return [];
          }
          const invoices: InvoiceRecord[] = (data as InvoiceRecord[] | null || [])
            .filter((inv) => typeof inv.amount === 'number' && inv.amount > 0);
          console.log(`Invoices pagas em ${dateStr}:`, invoices.length);

          // 1) match exato por 1 invoice
          const found: InvoiceRecord[] = invoices.filter((inv) => Math.abs(inv.amount - bankTx.amount) < 0.01);
          if (found.length) return found;

          // 2) combinação
          const targetCents = Math.round(bankTx.amount * 100);
          type Item = { cents: number; inv: InvoiceRecord };
          const items: Item[] = invoices
            .map((inv) => ({ cents: Math.round(inv.amount * 100), inv }))
            .sort((a, b) => b.cents - a.cents);
          let solution: InvoiceRecord[] | null = null;
          const n = items.length;
          function backtrack(start: number, sum: number, picked: InvoiceRecord[]) {
            if (solution) return;
            if (sum === targetCents) { solution = [...picked]; return; }
            if (sum > targetCents) return;
            for (let i = start; i < n; i++) {
              const next = items[i];
              if (sum + next.cents > targetCents) continue;
              picked.push(next.inv);
              backtrack(i + 1, sum + next.cents, picked);
              picked.pop();
              if (solution) return;
            }
          }
          backtrack(0, 0, []);
          return solution || [];
        }

        // Tenta na data da transação
        let matchingInvoices: InvoiceRecord[] = await findMatchesForDate(bankTx.transaction_date);
        // Fallback: se nada no mesmo dia, tenta dia anterior (alguns bancos creditam no D+1)
        if (!matchingInvoices.length) {
          const prev = new Date(bankTx.transaction_date);
          prev.setDate(prev.getDate() - 1);
          const prevStr = prev.toISOString().slice(0, 10);
          console.log(`Sem match no mesmo dia. Tentando dia anterior: ${prevStr}`);
          matchingInvoices = await findMatchesForDate(prevStr);
        }

        console.log('Invoices finais a renderizar:', matchingInvoices.length);

        if (matchingInvoices && matchingInvoices.length > 0) {
          const clientsListBase = matchingInvoices.map((inv: InvoiceRecord) => {
            const clientData = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients || undefined;
            return {
              client_id: inv.client_id,
              client_name: clientData?.name || 'Cliente Desconhecido',
              cnpj: clientData?.cnpj,
              email: clientData?.email,
              phone: clientData?.phone,
              amount: inv.amount,
            };
          });
          // Buscar contas contábeis 1.1.2.01.xxx e mapear por nome
          const { data: coaList, error: coaErr } = await supabase
            .from('chart_of_accounts')
            .select('id, code, name')
            .ilike('code', '1.1.2.01%');
          if (coaErr) {
            console.warn('Falha ao buscar plano de contas de clientes:', coaErr);
          }
          // Normalização com tolerância a variações (ex.: CAOPANHIA vs COMPANHIA)
          const normalize = (s?: string) => (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/companhia/g, 'companhia')
            .replace(/caopanhia/g, 'companhia')
            .replace(/\s+/g, ' ')
            .trim();
          const similarity = (a: string, b: string) => {
            const A = new Set(normalize(a).split(' '));
            const B = new Set(normalize(b).split(' '));
            if (A.size === 0 || B.size === 0) return 0;
            const inter = [...A].filter((w) => B.has(w)).length;
            return inter / Math.max(A.size, B.size);
          };
              const listWithAccount = (clientsListBase || []).map((c) => {
            const fromRule = ruleMap.get(normalize(c.client_name));
            let acc = (coaList || []).find((a) => (a.name || '').toLowerCase().includes((c.client_name || '').toLowerCase()));
            if (!acc) {
              // Fallback por similaridade (> 0.6)
              let best: { item: CoaRow; score: number } | null = null;
              for (const a of (coaList as CoaRow[] | null) || []) {
                const score = similarity(a.name || '', c.client_name || '');
                if (!best || score > best.score) best = { item: a, score };
              }
              if (best && best.score >= 0.6) acc = best.item;
            }
                return { ...c, account_code: fromRule || (acc as CoaRow | undefined)?.code || null };
          });
          console.log('Clientes mapeados:', listWithAccount);
          setClients(listWithAccount);
        } else {
          console.log('Nenhuma invoice encontrada com match ao valor', bankTx.amount);
          setClients([]);
        }
      } catch (error) {
        console.error('Erro ao buscar clientes da cobrança:', error);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [cobrancaDoc, amount, transactionDate]);

  if (!clients.length && !loading) {
    return null;
  }

  return (
    <div className="mt-2 ml-0 border-l-4 border-blue-400 pl-3 py-2 bg-blue-50 rounded-r">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[10px] text-blue-700 hover:text-blue-900 font-semibold"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Users className="h-4 w-4" />
          <span>{clients.length} cliente(s) - {formatCurrency(amount)}</span>
        </button>
      </div>

      {expanded && (
        <div className="space-y-1.5 text-[9px] text-slate-700">
          {loading ? (
            <div className="text-slate-400 italic text-center py-2">Carregando clientes...</div>
          ) : clients.length > 0 ? (
            clients.map((client, idx) => {
              const key = `${client.client_name || 'Cliente'}-${client.amount}-${client.account_code || 'x'}-${idx}`;
              const isUnlinked = !client.account_code;
              const suggested = (coaOptions || []).slice(0, 1).map(o => o.code)[0] || null;
              const selected = pendingLink[client.client_name] || suggested || '';
              return (
              <div key={key} className="flex items-center gap-2 bg-white p-1.5 rounded border border-blue-200 hover:bg-blue-100 transition">
                <div className="w-24 text-[9px] text-slate-500 font-mono text-right pr-2">
                  {formatCurrency(client.amount)}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="h-6 px-1.5 bg-slate-100 rounded border border-slate-200 text-xs text-slate-700 flex items-center">
                    <span className="font-mono text-[10px] mr-2">{client.account_code || (isUnlinked ? 'PENDENTE' : '')}</span>
                    <span className="text-[11px]">Cliente: {client.client_name}</span>
                  </div>
                  {isUnlinked && (
                    <div className="flex items-center gap-1">
                      <select
                        className="h-6 text-[10px] border border-blue-300 rounded px-1 bg-white"
                        value={selected}
                        onChange={(e) => setPendingLink((p) => ({ ...p, [client.client_name]: e.target.value }))}
                      >
                        <option value="">Vincular conta 1.1.2.01...</option>
                        {(coaOptions || [])
                          .filter(o => (o.code || '').startsWith('1.1.2.01'))
                          .slice(0, 50)
                          .map((o) => (
                            <option key={o.code} value={o.code}>{o.code} - {o.name}</option>
                          ))}
                      </select>
                      <button
                        className="h-6 px-2 text-[10px] bg-blue-600 text-white rounded"
                        disabled={!selected}
                        onClick={async () => {
                          const code = selected;
                          const name = (coaOptions.find(o => o.code === code)?.name) || 'Clientes a Receber';
                          try {
                            // Persiste regra simples (padrão = nome do cliente)
                            await supabase.from('intelligence_rules').insert({
                              pattern: client.client_name,
                              account_code: code,
                              account_name: name,
                              operation_type: 'credit'
                            });
                          } catch (ruleErr) {
                            console.warn('Falha ao salvar regra de cliente', ruleErr);
                          }
                          // Reflete no estado local
                          setClients((prev) => prev.map((c) => c.client_name === client.client_name ? { ...c, account_code: code } : c));
                        }}
                      >Salvar</button>
                    </div>
                  )}
                </div>
              </div>
            );})
          ) : (
            <div className="text-slate-400 italic text-center py-2">Nenhum cliente encontrado</div>
          )}
          
          {!loading && clients.length > 0 && (
            <div className="flex items-center justify-between gap-2 bg-blue-100 p-1.5 rounded border border-blue-300 mt-2 font-semibold">
              <span className="text-slate-700">Total de clientes baixados:</span>
              <span className="font-mono text-blue-800">{formatCurrency(amount)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
