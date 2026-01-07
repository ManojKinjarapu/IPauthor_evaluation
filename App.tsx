
import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { PatentCase, AuditResult, BatchSummary } from './types.ts';
import { auditSingleCase } from './services/geminiService.ts';
import ResultView from './components/ResultView.tsx';
import DashboardCharts from './components/DashboardCharts.tsx';
import { 
  FileJson, 
  FileSpreadsheet, 
  Play, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Layers,
  Search,
  Activity,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Database,
  Link,
  Download,
  BrainCircuit,
  Info,
  AlertTriangle,
  Settings2,
  Key,
  RefreshCcw
} from 'lucide-react';

// Declaring global interface for AIStudio to match existing environment types and resolve conflicts.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // FIX: Changed aistudio to optional to ensure consistency with environment-injected definitions.
    aistudio?: AIStudio;
  }
}

const normalizeToDigits = (val: any): string => {
  if (!val) return '';
  const str = String(val).toUpperCase();
  const digits = str.replace(/^US/, '').replace(/[^0-9]/g, '').replace(/^0+/, '');
  return digits;
};

const findBestHeader = (headers: string[], keywords: string[]): string => {
  let bestMatch = '';
  let highestScore = -1;
  headers.forEach(h => {
    const clean = h.replace(/[^\x20-\x7E]/g, '').toLowerCase().trim();
    let score = 0;
    keywords.forEach(kw => {
      const k = kw.toLowerCase();
      if (clean === k) score += 100;
      else if (clean.includes(k)) score += 20;
    });
    if (score > highestScore) {
      highestScore = score;
      bestMatch = h;
    }
  });
  return highestScore > 0 ? bestMatch : '';
};

const agenticExtract = (data: any, keywords: string[]): string => {
  if (!data) return '';
  if (typeof data === 'string') return data.trim();
  if (typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data);
    const bestKey = findBestHeader(keys, keywords);
    if (bestKey && typeof data[bestKey] === 'string') return data[bestKey];
    if (bestKey && typeof data[bestKey] === 'object') return agenticExtract(data[bestKey], keywords);
    return Object.values(data)
      .map(v => (typeof v === 'string' && v.length > 20 ? v : ''))
      .filter(v => v !== '')
      .join('\n\n');
  }
  if (Array.isArray(data)) {
    return data.map(item => agenticExtract(item, keywords)).join('\n\n');
  }
  return String(data);
};

const App: React.FC = () => {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [selectedApp, setSelectedApp] = useState<AuditResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mergedCases, setMergedCases] = useState<PatentCase[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } catch (e) {
          console.error("Failed to check key status", e);
          setHasKey(false);
        }
      } else {
        // If not in AIStudio environment, assume process.env.API_KEY is handled externally
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleDataLoad = async () => {
    if (!jsonFile || !csvFile) {
      alert("Please upload both Strategy JSON and Granted CSV.");
      return;
    }

    try {
      const jsonRaw = JSON.parse(await jsonFile.text());
      const csvText = await csvFile.text();
      const csvParsed = Papa.parse(csvText, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (h) => h.replace(/[^\x20-\x7E]/g, '').trim()
      });
      
      const headers = csvParsed.meta.fields || [];
      setCsvHeaders(headers);
      const csvData = csvParsed.data as any[];

      const csvIdCol = findBestHeader(headers, ['application', 'app', 'number', 'serial', 'id']);
      const csvClaimsCol = findBestHeader(headers, ['granted', 'allowed', 'final', 'claims']);

      const jsonItems = Array.isArray(jsonRaw) 
        ? jsonRaw 
        : Object.entries(jsonRaw).map(([k, v]) => ({ 
            __raw_id: k, 
            ...(typeof v === 'object' ? v : { content: v }) 
          }));

      const mapped = jsonItems.map((item: any) => {
        const jsonId = agenticExtract(item, ['application', 'app', 'id', 'number']) || item.__raw_id;
        const normJsonId = normalizeToDigits(jsonId);

        const csvRow = csvData.find(row => {
          const rawCsvId = row[csvIdCol];
          const normCsvId = normalizeToDigits(rawCsvId);
          if (!normJsonId || !normCsvId) return false;
          return normJsonId === normCsvId || normJsonId.includes(normCsvId) || normCsvId.includes(normJsonId);
        });

        return {
          appNumber: String(jsonId || 'Unknown'),
          originalClaims: agenticExtract(item, ['original', 'pre', 'pending', 'claims']),
          officeActionSummary: agenticExtract(item, ['office', 'action', 'rejection', 'oa']),
          generatedStrategies: agenticExtract(item, ['strategy', 'strategies', 'proposed', 'options']),
          specification: agenticExtract(item, ['specification', 'description', 'spec', 'content']),
          grantedClaims: csvRow ? (csvRow[csvClaimsCol] || '') : ''
        };
      });

      setMergedCases(mapped);
    } catch (err) {
      console.error("Mapping Error:", err);
      alert("Mapping failed. Ensure JSON is valid and CSV headers are clear.");
    }
  };

  const runBatchAudit = async () => {
    if (mergedCases.length === 0) return;
    setProcessing(true);
    setResults([]);
    setProgress(0);

    const auditResults: AuditResult[] = [];
    for (let i = 0; i < mergedCases.length; i++) {
      try {
        const result = await auditSingleCase(mergedCases[i]);
        auditResults.push(result);
        setResults([...auditResults]); 
        setProgress(Math.round(((i + 1) / mergedCases.length) * 100));
      } catch (e: any) {
        console.error(`Audit failed: ${mergedCases[i].appNumber}`, e);
        if (e?.message?.includes("Requested entity was not found")) {
          setHasKey(false);
          alert("Project key error. Please select a valid paid API key.");
          setProcessing(false);
          return;
        }
      }
    }
    setProcessing(false);
  };

  const summary: BatchSummary = useMemo(() => ({
    totalApps: results.length,
    avgScore: results.reduce((a, b) => a + b.evaluation_result.final_score, 0) / (results.length || 1),
    totalSavings: results.reduce((a, b) => a + b.roi_metrics.cost_saved, 0),
    totalHours: results.reduce((a, b) => a + b.roi_metrics.hours_saved, 0),
    accuracyDistribution: results.reduce((acc, curr) => {
      const label = curr.evaluation_result.strategy_evaluation.prediction_accuracy;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    sourceDistribution: results.reduce((acc, curr) => {
      const label = curr.evaluation_result.winning_amendment.source_type;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  }), [results]);

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-[3rem] p-12 max-w-xl text-center shadow-2xl">
          <div className="bg-indigo-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
            <Key size={48} className="text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">API Key Required</h1>
          <p className="text-slate-600 text-lg mb-8 leading-relaxed">
            This tool uses Gemini 3 Pro intelligence. Please select a <span className="text-indigo-600 font-bold">paid API key</span> from a project with billing enabled to proceed.
          </p>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-sm font-bold text-slate-400 hover:text-indigo-500 block mb-10 transition-colors underline decoration-2 underline-offset-4">
            Learn about API Billing
          </a>
          <button onClick={handleSelectKey} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 active:scale-95 transition-all">
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-5 sticky top-0 z-50 border-b border-indigo-500/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none">IPauthor <span className="text-indigo-400 font-light">Auditor</span></h1>
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Intelligence Accuracy Agent</p>
            </div>
          </div>
          {processing && (
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Auditing Cases</p>
                <p className="text-xs font-mono text-slate-400">Contextual Delta Analysis active</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-800 rounded-full h-1.5 overflow-hidden ring-1 ring-slate-700">
                  <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-sm font-black font-mono text-indigo-400">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {results.length === 0 && !processing && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-slate-200 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-500">
                  <Settings2 size={120} />
               </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Efficacy Audit Portal</h2>
              <p className="text-slate-500 text-lg mb-12 max-w-2xl mx-auto leading-relaxed">
                Connect AI strategies with legal ground truth. Our engine uses <span className="text-indigo-600 font-bold">Sliding Numeric Normalization</span> to fix common CSV matching issues.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-10">
                <FileUploader 
                  icon={<FileJson className="text-indigo-500" size={32} />}
                  label="Strategy JSON"
                  description="Proposed AI amendments & strategies"
                  onFile={(f) => setJsonFile(f)}
                  fileName={jsonFile?.name}
                />
                <FileUploader 
                  icon={<FileSpreadsheet className="text-emerald-500" size={32} />}
                  label="Granted CSV"
                  description="Allowed claims from USPTO/Official sources"
                  onFile={(f) => setCsvFile(f)}
                  fileName={csvFile?.name}
                />
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={handleDataLoad}
                  disabled={!jsonFile || !csvFile}
                  className="px-16 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-slate-800 disabled:opacity-20 transition-all shadow-2xl flex items-center gap-4 active:scale-95"
                >
                  <Link size={24} />
                  Run Correlation Agent
                </button>
              </div>
            </div>

            {mergedCases.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-emerald-100 rounded-2xl text-emerald-600 shadow-inner"><CheckCircle2 size={24}/></div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight">Mapping Intelligence Log</h3>
                      <p className="text-sm text-slate-500">Matched {mergedCases.filter(c => c.grantedClaims).length} of {mergedCases.length} items from CSV.</p>
                    </div>
                  </div>
                  <button
                    onClick={runBatchAudit}
                    className="w-full sm:w-auto px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl flex items-center justify-center gap-4 shadow-xl shadow-indigo-200 transition-all transform hover:-translate-y-1"
                  >
                    <Play fill="currentColor" size={24} />
                    Execute Senior Audit
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-400 font-black">
                      <tr>
                        <th className="p-5">Source ID</th>
                        <th className="p-5">Normalized ID</th>
                        <th className="p-5 text-center">Data Integrity</th>
                        <th className="p-5">Ground Truth Connection</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mergedCases.map((c, idx) => (
                        <tr key={`${c.appNumber}-${idx}`} className="hover:bg-slate-50/50">
                          <td className="p-5 font-mono font-bold text-slate-700">{c.appNumber}</td>
                          <td className="p-5"><code className="bg-slate-100 px-2 py-1 rounded text-slate-500">{normalizeToDigits(c.appNumber)}</code></td>
                          <td className="p-5">
                            <div className="flex justify-center gap-2">
                               <StatusBubble label="Claims" isOk={!!c.originalClaims} />
                               <StatusBubble label="Spec" isOk={!!c.specification} />
                               <StatusBubble label="AI" isOk={!!c.generatedStrategies} />
                            </div>
                          </td>
                          <td className="p-5">
                             {c.grantedClaims ? (
                               <div className="flex items-center gap-2 text-emerald-600 font-black">
                                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                 <span className="text-[10px] uppercase tracking-widest">SUCCESSFULLY MATCHED</span>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2 text-red-500 font-black">
                                 <XCircle size={14}/>
                                 <span className="text-[10px] uppercase tracking-widest">MISSING IN CSV</span>
                               </div>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-5 bg-indigo-50 rounded-[1.5rem] border border-indigo-100 flex items-start gap-4">
                   <Info className="text-indigo-500 shrink-0 mt-1" size={20} />
                   <div className="text-sm">
                     <p className="font-bold text-indigo-900 mb-1">Diagnostic Report:</p>
                     <p className="text-indigo-700 leading-relaxed">
                        Detected CSV Headers: <span className="font-mono font-bold bg-indigo-100 px-1 rounded">{csvHeaders.join(', ')}</span>.
                        The engine identified <span className="underline decoration-indigo-300">"{findBestHeader(csvHeaders, ['application', 'number'])}"</span> as the primary ID column.
                     </p>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
             <div className="flex items-center justify-between bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner"><Activity size={24} /></div>
                <div>
                   <h2 className="text-xl font-black text-slate-900">Senior Quality Audit Report</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Ground Truth vs AI Strategy Comparison</p>
                </div>
              </div>
              <button
                onClick={() => { setResults([]); setMergedCases([]); }}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl transition-all"
              >
                <RefreshCcw size={18} />
                Reset Pipeline
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatsCard icon={<DollarSign className="text-emerald-500" />} label="ROI Value" value={`$${summary.totalSavings.toLocaleString()}`} />
              <StatsCard icon={<Clock className="text-blue-500" />} label="Hours Saved" value={`${summary.totalHours} hrs`} />
              <StatsCard icon={<TrendingUp className="text-indigo-500" />} label="Avg Efficacy" value={`${summary.avgScore.toFixed(1)}%`} />
              <StatsCard icon={<Layers className="text-amber-500" />} label="Batch Count" value={`${results.length}`} />
            </div>

            <DashboardCharts summary={summary} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 space-y-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search Audit History..." 
                    className="w-full pl-12 pr-4 py-5 bg-white border border-slate-200 rounded-3xl outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden max-h-[700px] overflow-y-auto">
                  {results.filter(r => r.appNumber.includes(searchTerm)).map(res => (
                    <button
                      key={res.appNumber}
                      onClick={() => setSelectedApp(res)}
                      className={`w-full text-left p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex items-center justify-between group transition-all ${selectedApp?.appNumber === res.appNumber ? 'bg-indigo-50/50 border-l-[8px] border-l-indigo-600 pl-4' : ''}`}
                    >
                      <div>
                        <p className="font-bold text-slate-800 font-mono text-sm truncate max-w-[140px]">{res.appNumber}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-wider">{res.evaluation_result.strategy_evaluation.prediction_accuracy}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xl font-black ${res.evaluation_result.final_score >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {res.evaluation_result.final_score}%
                        </span>
                        <ChevronRight size={18} className="inline ml-2 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8">
                {selectedApp ? (
                  <ResultView result={selectedApp} />
                ) : (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] h-full min-h-[500px] flex flex-col items-center justify-center p-16 text-center text-slate-400">
                    <div className="p-8 bg-slate-50 rounded-full mb-8">
                      <BrainCircuit size={64} className="opacity-10 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Audit Findings Dashboard</h3>
                    <p className="text-slate-500 max-w-sm leading-relaxed text-sm">Select a case from the list to visualize how AI strategies performed against legal Ground Truth.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const StatusBubble: React.FC<{ label: string, isOk: boolean }> = ({ label, isOk }) => (
  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-opacity ${isOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200 opacity-50'}`}>
    {label}
  </span>
);

const FileUploader: React.FC<{ icon: React.ReactNode, label: string, description: string, onFile: (f: File) => void, fileName?: string }> = ({ icon, label, description, onFile, fileName }) => (
  <div className="relative group">
    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files && onFile(e.target.files[0])} />
    <div className={`p-8 border-2 border-dashed rounded-[2rem] flex flex-col items-center text-center gap-4 transition-all ${fileName ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-400 bg-slate-50/80 shadow-inner'}`}>
      <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">{icon}</div>
      <div>
        <p className="text-base font-black text-slate-900 tracking-tight">{label}</p>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">{description}</p>
        <div className="mt-4 flex justify-center">
          <span className={`text-[10px] font-mono font-bold truncate max-w-[150px] px-3 py-1.5 rounded-lg ${fileName ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
            {fileName || 'Drop File Here'}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const StatsCard: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 group hover:translate-y-[-4px] transition-all">
    <div className="flex items-center gap-3 mb-6">
      <div className="p-3 bg-slate-50 rounded-xl shadow-inner group-hover:bg-indigo-50 transition-colors">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
    </div>
    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
  </div>
);

export default App;
