import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { PatentCase, AuditResult, BatchSummary } from './types';
import { auditSingleCase } from './services/geminiService';
import ResultView from './components/ResultView';
import DashboardCharts from './components/DashboardCharts';
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
  BrainCircuit
} from 'lucide-react';

const normalizeId = (id: string | number | undefined | null): string => {
  if (id === undefined || id === null) return '';
  return String(id).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
};

const getValueByFuzzyKey = (obj: any, targetKeys: string[]): any => {
  if (!obj) return undefined;
  const objKeys = Object.keys(obj);
  
  for (const target of targetKeys) {
    const exactMatch = objKeys.find(k => k.trim() === target);
    if (exactMatch && obj[exactMatch] !== undefined && obj[exactMatch] !== null) return obj[exactMatch];
  }

  const normalizedTargets = targetKeys.map(t => t.toLowerCase().replace(/[\s_-]/g, ''));
  for (const key of objKeys) {
    const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, '').replace(/[^\x20-\x7E]/g, '');
    if (normalizedTargets.includes(normalizedKey)) return obj[key];
  }
  return undefined;
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

  const handleDataLoad = async () => {
    if (!jsonFile || !csvFile) {
      alert("Please upload both Strategies JSON and Granted Claims CSV.");
      return;
    }

    try {
      const jsonRaw = JSON.parse(await jsonFile.text());
      const csvText = await csvFile.text();
      
      const csvParsed = Papa.parse(csvText, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().replace(/[^\x20-\x7E]/g, '')
      }).data as any[];

      const jsonItems = Array.isArray(jsonRaw) 
        ? jsonRaw 
        : Object.entries(jsonRaw).map(([key, val]: [string, any]) => ({ 
            'application number': key, 
            ...(typeof val === 'object' ? val : { content: val }) 
          }));

      const cases: PatentCase[] = jsonItems.map((item: any) => {
        const rawAppNum = getValueByFuzzyKey(item, ['application number', 'app_number', 'id', 'application_id']);
        const normAppNum = normalizeId(rawAppNum);
        
        const csvRow = csvParsed.find(row => {
          const csvAppNum = getValueByFuzzyKey(row, ['Application number', 'App Number', 'application_number', 'id']);
          return normalizeId(csvAppNum) === normAppNum && normAppNum !== '';
        });

        const stratsRaw = getValueByFuzzyKey(item, ['generated_options', 'strategies', 'options']);
        const strategiesText = typeof stratsRaw === 'object' ? JSON.stringify(stratsRaw, null, 2) : String(stratsRaw || '');

        return {
          appNumber: String(rawAppNum || 'Unknown'),
          originalClaims: String(getValueByFuzzyKey(item, ['claims', 'Original Claims', 'original_claims']) || ''),
          officeActionSummary: String(getValueByFuzzyKey(item, ['office_action', 'OA summary', 'office_action_summary']) || ''),
          generatedStrategies: strategiesText,
          specification: String(getValueByFuzzyKey(item, ['specification', 'description', 'application_specification']) || ''),
          grantedClaims: String(getValueByFuzzyKey(csvRow, ['granted claims', 'Granted Claims', 'final_claims']) || '')
        };
      });

      setMergedCases(cases);
    } catch (err) {
      console.error("Mapping Failed:", err);
      alert("Criticial Mapping Error: Check JSON format and CSV headers.");
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
      } catch (e) {
        console.error(`Audit error: ${mergedCases[i].appNumber}`, e);
      }
    }
    setProcessing(false);
  };

  const exportCSVReport = () => {
    if (results.length === 0) return;

    const exportData = results.map(res => ({
      "Application Number": res.appNumber,
      "Winning Amendment Summary": res.evaluation_result.winning_amendment.summary,
      "Winning Amendment Source Type": res.evaluation_result.winning_amendment.source_type,
      "Winning Amendment Source Details": res.evaluation_result.winning_amendment.source_details,
      "Best Matching Strategy Name": res.evaluation_result.strategy_evaluation.best_matching_strategy_name,
      "Prediction Accuracy": res.evaluation_result.strategy_evaluation.prediction_accuracy,
      "Match Analysis": res.evaluation_result.strategy_evaluation.match_analysis,
      "Final Score": res.evaluation_result.final_score,
      "Auditor Reasoning": res.evaluation_result.auditor_reasoning
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `IPauthor_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const filteredResults = results.filter(r => r.appNumber.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-5 sticky top-0 z-50 shadow-2xl border-b border-indigo-500/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <BrainCircuit size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none">IPauthor <span className="text-indigo-400 font-light">Auditor</span></h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mt-1">Advanced Performance Evaluator</p>
            </div>
          </div>
          {processing && (
            <div className="flex items-center gap-6 animate-pulse">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Processing Batch</p>
                <p className="text-xs font-mono text-slate-400">Step: Delta Analysis</p>
              </div>
              <div className="w-40 bg-slate-800 rounded-full h-2 overflow-hidden ring-1 ring-slate-700">
                <div className="bg-indigo-500 h-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-lg font-black font-mono text-indigo-400">{progress}%</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {results.length === 0 && !processing && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-[2rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-200 text-center">
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Strategy Quality Audit</h2>
              <p className="text-slate-500 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
                Connect your IPauthor <span className="font-bold text-indigo-600">generated_options</span> with the legal 
                <span className="font-bold text-emerald-600"> Ground Truth</span> to measure predicted winning moves.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
                <FileUploader 
                  icon={<FileJson className="text-indigo-500" size={32} />}
                  label="IPauthor Strategies"
                  description="Required: 'generated_options' or 'strategies' key."
                  onFile={(f) => setJsonFile(f)}
                  fileName={jsonFile?.name}
                />
                <FileUploader 
                  icon={<FileSpreadsheet className="text-emerald-500" size={32} />}
                  label="Ground Truth (CSV)"
                  description="Required: 'Application number' and 'granted claims'."
                  onFile={(f) => setCsvFile(f)}
                  fileName={csvFile?.name}
                />
              </div>
              
              <div className="mt-12 flex flex-col items-center gap-6">
                <button
                  onClick={handleDataLoad}
                  disabled={!jsonFile || !csvFile}
                  className="px-16 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-slate-800 disabled:opacity-20 transition-all shadow-2xl hover:shadow-indigo-500/10 flex items-center gap-4 active:scale-95"
                >
                  <Link size={24} />
                  Correlate Files
                </button>
              </div>
            </div>

            {mergedCases.length > 0 && (
              <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600"><CheckCircle2 size={32}/></div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight">Sync Verified</h3>
                      <p className="text-sm text-slate-500">Found {mergedCases.filter(c => c.grantedClaims).length} matches across {mergedCases.length} records.</p>
                    </div>
                  </div>
                  <button
                    onClick={runBatchAudit}
                    className="w-full sm:w-auto px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl flex items-center justify-center gap-4 shadow-xl shadow-indigo-200 transition-all transform hover:-translate-y-1 active:scale-95"
                  >
                    <Play fill="currentColor" size={24} />
                    Execute Audit
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] uppercase text-slate-400 font-black bg-slate-50/80">
                      <tr>
                        <th className="p-5">Application ID</th>
                        <th className="p-5">Options Found</th>
                        <th className="p-5">OA Found</th>
                        <th className="p-5">CSV Correlation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mergedCases.map((c, idx) => (
                        <tr key={`${c.appNumber}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-5 font-mono font-bold text-slate-700">{c.appNumber}</td>
                          <StatusCell val={c.generatedStrategies} />
                          <StatusCell val={c.officeActionSummary} />
                          <td className="p-5">
                             {c.grantedClaims ? (
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shadow-sm">MATCHED</span>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-red-500 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">MISSING</span>
                               </div>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Activity size={24} /></div>
                <h2 className="text-xl font-black text-slate-900">Batch Dashboard</h2>
              </div>
              <button
                onClick={exportCSVReport}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-200 active:scale-95"
              >
                <Download size={18} />
                Export Audit (.CSV)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatsCard 
                icon={<DollarSign className="text-emerald-500" />}
                label="Total Attorney Savings"
                value={`$${summary.totalSavings.toLocaleString()}`}
                trend="Based on 2nd OA Avoidance"
              />
              <StatsCard 
                icon={<Clock className="text-blue-500" />}
                label="Hours Recovered"
                value={`${summary.totalHours} hrs`}
                trend="Productivity Lift"
              />
              <StatsCard 
                icon={<TrendingUp className="text-indigo-500" />}
                label="Average Accuracy"
                value={`${summary.avgScore.toFixed(1)}%`}
                trend="Strategy Efficacy"
              />
              <StatsCard 
                icon={<Layers className="text-amber-500" />}
                label="Applications Processed"
                value={`${results.length} / ${mergedCases.length}`}
                trend="Batch Coverage"
              />
            </div>

            <DashboardCharts summary={summary} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 space-y-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by ID..." 
                    className="w-full pl-12 pr-4 py-5 text-base bg-white border border-slate-200 rounded-3xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden max-h-[700px] overflow-y-auto">
                  {filteredResults.map(res => (
                    <button
                      key={res.appNumber}
                      onClick={() => setSelectedApp(res)}
                      className={`w-full text-left p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-all flex items-center justify-between group ${selectedApp?.appNumber === res.appNumber ? 'bg-indigo-50/50 border-l-[6px] border-l-indigo-600 pl-4.5' : ''}`}
                    >
                      <div>
                        <span className="text-[10px] font-black text-slate-400 block mb-1 tracking-widest uppercase">APP ID</span>
                        <p className="font-bold text-slate-800 font-mono">{res.appNumber}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-black ${res.evaluation_result.final_score >= 85 ? 'text-emerald-600' : res.evaluation_result.final_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {res.evaluation_result.final_score}%
                        </span>
                        <ChevronRight size={18} className="inline ml-3 text-slate-300 group-hover:text-indigo-400 transition-all transform group-hover:translate-x-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8">
                {selectedApp ? (
                  <ResultView result={selectedApp} />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-[3rem] h-full min-h-[500px] flex flex-col items-center justify-center p-16 text-center text-slate-400 shadow-sm border-dashed">
                    <div className="p-8 bg-slate-50 rounded-full mb-8 ring-8 ring-slate-100/50">
                      <BrainCircuit size={64} className="opacity-20 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Strategy Intelligence Deep-Dive</h3>
                    <p className="text-slate-500 max-w-sm leading-relaxed">Select an audited application to visualize the automated Delta Analysis and legal matching logic.</p>
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

const StatusCell: React.FC<{ val?: string }> = ({ val }) => {
  const isFound = val && val.trim().length > 10;
  return (
    <td className="p-5">
      {isFound ? (
        <div className="flex items-center gap-2 text-emerald-600 font-black">
          <CheckCircle2 size={16} />
          <span className="text-[10px] uppercase tracking-wider">Populated</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-amber-500 font-black opacity-70">
          <XCircle size={16} />
          <span className="text-[10px] uppercase tracking-wider">Empty/Low Info</span>
        </div>
      )}
    </td>
  );
};

const FileUploader: React.FC<{ icon: React.ReactNode, label: string, description: string, onFile: (f: File) => void, fileName?: string }> = ({ icon, label, description, onFile, fileName }) => (
  <div className="relative group">
    <input 
      type="file" 
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
      onChange={(e) => e.target.files && onFile(e.target.files[0])}
    />
    <div className={`p-10 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center text-center gap-6 transition-all ${fileName ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 hover:border-indigo-400 bg-slate-50/80 hover:bg-white shadow-inner'}`}>
      <div className="p-5 bg-white rounded-3xl shadow-xl ring-1 ring-slate-100 group-hover:scale-110 transition-transform">{icon}</div>
      <div>
        <p className="text-xl font-black text-slate-900 tracking-tight">{label}</p>
        <p className="text-xs text-slate-500 mt-2 mb-4 px-4 font-medium">{description}</p>
        <div className="flex justify-center">
          <span className={`text-xs font-mono font-bold truncate max-w-[200px] px-4 py-2 rounded-xl ${fileName ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {fileName || 'Click to Upload'}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const StatsCard: React.FC<{ icon: React.ReactNode, label: string, value: string, trend: string }> = ({ icon, label, value, trend }) => (
  <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col justify-between hover:scale-[1.02] transition-all group overflow-hidden relative">
    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
      {/* Fix: cast icon to React.ReactElement<any> to allow 'size' prop and ensure it's a valid element before cloning */}
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 120 }) : null}
    </div>
    <div className="flex items-center gap-4 mb-6">
      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors shadow-inner">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
    </div>
    <div>
      <h3 className="text-4xl font-black text-slate-900 leading-none mb-2">{value}</h3>
      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{trend}</p>
    </div>
  </div>
);

export default App;