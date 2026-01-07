
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
  BrainCircuit,
  Info,
  AlertTriangle
} from 'lucide-react';

/**
 * Aggressive normalization for Patent Identifiers.
 * Strips all non-digits to handle "16/123,456", "US16123456", and "16123456" identically.
 */
const normalizeId = (id: any): string => {
  if (id === undefined || id === null) return '';
  const str = String(id).toLowerCase();
  const numericOnly = str.replace(/[^0-9]/g, '');
  // Many patent IDs are the last 8 digits. We'll return the full numeric string
  // but the matcher will prioritize length.
  return numericOnly.trim();
};

/**
 * Strips non-printable characters and BOMs from CSV headers.
 */
const cleanHeader = (h: string): string => {
  return h.replace(/[^\x20-\x7E]/g, '').trim();
};

/**
 * Weighted scoring to find the BEST column/key for a specific concept.
 */
const findBestKey = (obj: any, conceptKeywords: string[]): string => {
  if (!obj || typeof obj !== 'object') return '';
  const keys = Object.keys(obj);
  let bestKey = '';
  let highestScore = -1;

  keys.forEach(key => {
    const k = cleanHeader(key).toLowerCase();
    let score = 0;
    
    conceptKeywords.forEach(kw => {
      const normalizedKw = kw.toLowerCase();
      if (k === normalizedKw) score += 100; // Perfect match
      else if (k.startsWith(normalizedKw)) score += 50;
      else if (k.includes(normalizedKw)) score += 20;
    });

    if (score > highestScore) {
      highestScore = score;
      bestKey = key;
    }
  });

  return highestScore > 0 ? bestKey : '';
};

/**
 * Agentic data crawler: Deeply extracts text from nested objects.
 */
const deepExtract = (val: any, depth = 0): string => {
  if (val === undefined || val === null) return '';
  if (depth > 5) return ''; 
  
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return val.map(i => deepExtract(i, depth + 1)).filter(s => s.length > 0).join('\n\n');
  
  if (typeof val === 'object') {
    // Priority keys for AI outputs
    const priority = ['text', 'content', 'summary', 'body', 'value', 'description', 'strategies', 'claims'];
    const bestKey = findBestKey(val, priority);
    if (bestKey && typeof val[bestKey] === 'string') return val[bestKey];
    
    // Fallback: concatenate all meaningful string parts
    return Object.entries(val)
      .map(([k, v]) => {
        const content = deepExtract(v, depth + 1);
        return content.length > 5 ? `${k.toUpperCase()}: ${content}` : '';
      })
      .filter(s => s.length > 0)
      .join('\n');
  }
  return String(val);
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
      alert("Please upload both Strategies JSON and Ground Truth CSV.");
      return;
    }

    try {
      const jsonRaw = JSON.parse(await jsonFile.text());
      const csvText = await csvFile.text();
      
      const csvParsed = Papa.parse(csvText, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (h) => cleanHeader(h)
      }).data as any[];

      // Standardize JSON into an iterable list
      const jsonItems = Array.isArray(jsonRaw) 
        ? jsonRaw 
        : Object.entries(jsonRaw).map(([key, val]: [string, any]) => ({ 
            '__detected_id': key, 
            ...(typeof val === 'object' ? val : { content: val }) 
          }));

      const cases: PatentCase[] = jsonItems.map((item: any) => {
        // Step 1: Find ID in JSON
        const idKey = findBestKey(item, ['application', 'app', 'number', 'id', 'case', '__detected_id']);
        const rawAppNum = item[idKey] || item['__detected_id'];
        const normAppNum = normalizeId(rawAppNum);

        // Step 2: Match in CSV using Weighted Header Scoring
        const csvRow = csvParsed.find(row => {
          const csvIdKey = findBestKey(row, ['application', 'app', 'number', 'id', 'serial']);
          if (!csvIdKey) return false;
          const normCsvId = normalizeId(row[csvIdKey]);
          
          // Fuzzy numeric match: Allow matches if one is a suffix of the other (handles US vs Raw numbers)
          if (normAppNum === normCsvId && normAppNum !== '') return true;
          if (normAppNum.length > 5 && normCsvId.endsWith(normAppNum)) return true;
          if (normCsvId.length > 5 && normAppNum.endsWith(normCsvId)) return true;
          return false;
        });

        // Step 3: Agentic Deep Extraction of all required fields
        return {
          appNumber: String(rawAppNum || 'Unknown'),
          originalClaims: deepExtract(item[findBestKey(item, ['original', 'pre', 'claims', 'initial'])]),
          officeActionSummary: deepExtract(item[findBestKey(item, ['office', 'action', 'rejection', 'oa'])]),
          generatedStrategies: deepExtract(item[findBestKey(item, ['strategy', 'strategies', 'options', 'proposed'])]),
          specification: deepExtract(item[findBestKey(item, ['description', 'specification', 'spec', 'content'])]),
          grantedClaims: csvRow ? deepExtract(csvRow[findBestKey(csvRow, ['granted', 'final', 'allowed', 'claims'])]) : ''
        };
      });

      setMergedCases(cases);
    } catch (err) {
      console.error("Mapping Engine Failure:", err);
      alert("Extraction Error: Failed to parse files. Ensure JSON is valid and CSV has clear headers.");
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
        console.error(`Audit error for ${mergedCases[i].appNumber}:`, e);
      }
    }
    setProcessing(false);
  };

  const exportCSVReport = () => {
    if (results.length === 0) return;
    const csv = Papa.unparse(results.map(res => ({
      "Application ID": res.appNumber,
      "Audit Score": res.evaluation_result.final_score,
      "Winning Limitation": res.evaluation_result.winning_amendment.technical_delta,
      "Specification Reference": res.evaluation_result.winning_amendment.evidence_link,
      "Accuracy Level": res.evaluation_result.strategy_evaluation.prediction_accuracy,
      "Agent Reasoning": res.evaluation_result.auditor_reasoning
    })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IPauthor_Intelligence_Audit_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
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
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl">
              <BrainCircuit size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none">IPauthor <span className="text-indigo-400 font-light">Auditor</span></h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mt-1">Weighted Mapping Engine v2.0</p>
            </div>
          </div>
          {processing && (
            <div className="flex items-center gap-6 animate-pulse">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Deep Delta Audit</p>
                <p className="text-xs font-mono text-slate-400">Comparing Claims vs. Ground Truth</p>
              </div>
              <div className="w-40 bg-slate-800 rounded-full h-2 overflow-hidden ring-1 ring-slate-700">
                <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-lg font-black font-mono text-indigo-400">{progress}%</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {results.length === 0 && !processing && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-[2rem] p-10 shadow-xl border border-slate-200 text-center">
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Technical Efficacy Audit</h2>
              <p className="text-slate-500 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
                Connect your <span className="text-indigo-600 font-bold">Strategy JSON</span> (AI Output) with your <span className="text-emerald-600 font-bold">Granted Claims CSV</span> (Ground Truth) for precision evaluation.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
                <FileUploader 
                  icon={<FileJson className="text-indigo-500" size={32} />}
                  label="Strategy JSON"
                  description="Complex/nested JSON supported. Agent will auto-detect claims and specs."
                  onFile={(f) => setJsonFile(f)}
                  fileName={jsonFile?.name}
                />
                <FileUploader 
                  icon={<FileSpreadsheet className="text-emerald-500" size={32} />}
                  label="Granted Claims CSV"
                  description="Required: 'Application Number' and 'Granted Claims' columns."
                  onFile={(f) => setCsvFile(f)}
                  fileName={csvFile?.name}
                />
              </div>
              
              <div className="mt-12 flex flex-col items-center gap-6">
                <button
                  onClick={handleDataLoad}
                  disabled={!jsonFile || !csvFile}
                  className="px-16 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-slate-800 disabled:opacity-20 transition-all shadow-2xl flex items-center gap-4 active:scale-95"
                >
                  <Link size={24} />
                  Correlate & Map Data
                </button>
              </div>
            </div>

            {mergedCases.length > 0 && (
              <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600"><CheckCircle2 size={32}/></div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight">Data Map Complete</h3>
                      <p className="text-sm text-slate-500">
                        {mergedCases.filter(c => c.grantedClaims).length} Matches / {mergedCases.length} JSON Records
                      </p>
                    </div>
                  </div>
                  {mergedCases.filter(c => c.grantedClaims).length === 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-200">
                      <AlertTriangle size={18} />
                      <span className="text-xs font-bold">Check CSV column names: "Application Number"</span>
                    </div>
                  )}
                  <button
                    onClick={runBatchAudit}
                    className="w-full sm:w-auto px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl flex items-center justify-center gap-4 shadow-xl shadow-indigo-200 transition-all transform hover:-translate-y-1"
                  >
                    <Play fill="currentColor" size={24} />
                    Execute Delta Audit
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] uppercase text-slate-400 font-black bg-slate-50/80">
                      <tr>
                        <th className="p-5">Application ID</th>
                        <th className="p-5">Claims</th>
                        <th className="p-5">Strategies</th>
                        <th className="p-5">Office Action</th>
                        <th className="p-5">Description</th>
                        <th className="p-5">Ground Truth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mergedCases.map((c, idx) => (
                        <tr key={`${c.appNumber}-${idx}`} className="hover:bg-slate-50/50">
                          <td className="p-5 font-mono font-bold text-slate-700">{c.appNumber}</td>
                          <StatusCell val={c.originalClaims} />
                          <StatusCell val={c.generatedStrategies} />
                          <StatusCell val={c.officeActionSummary} />
                          <StatusCell val={c.specification} />
                          <td className="p-5">
                             {c.grantedClaims ? (
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1">
                                   <CheckCircle2 size={10}/> CONNECTED
                                 </span>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-red-500 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 flex items-center gap-1">
                                   <XCircle size={10}/> NO CSV MATCH
                                 </span>
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
            <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Activity size={24} /></div>
                <h2 className="text-xl font-black text-slate-900">Intelligence Performance Report</h2>
              </div>
              <button
                onClick={exportCSVReport}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-lg active:scale-95"
              >
                <Download size={18} />
                Export Audit Report
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatsCard icon={<DollarSign className="text-emerald-500" />} label="Value Created" value={`$${summary.totalSavings.toLocaleString()}`} trend="Avoided 2nd OAs" />
              <StatsCard icon={<Clock className="text-blue-500" />} label="Attorney Productivity" value={`${summary.totalHours} hrs`} trend="Time Optimization" />
              <StatsCard icon={<TrendingUp className="text-indigo-500" />} label="Average Quality" value={`${summary.avgScore.toFixed(1)}%`} trend="Strategy Matching" />
              <StatsCard icon={<Layers className="text-amber-500" />} label="Audited Total" value={`${results.length}`} trend="Success Sample" />
            </div>

            <DashboardCharts summary={summary} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 space-y-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search Case IDs..." 
                    className="w-full pl-12 pr-4 py-5 bg-white border border-slate-200 rounded-3xl outline-none shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden max-h-[700px] overflow-y-auto">
                  {filteredResults.map(res => (
                    <button
                      key={res.appNumber}
                      onClick={() => setSelectedApp(res)}
                      className={`w-full text-left p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex items-center justify-between group ${selectedApp?.appNumber === res.appNumber ? 'bg-indigo-50/50 border-l-[6px] border-l-indigo-600 pl-4.5' : ''}`}
                    >
                      <div>
                        <span className="text-[10px] font-black text-slate-400 block mb-1 tracking-widest uppercase">CASE ID</span>
                        <p className="font-bold text-slate-800 font-mono truncate max-w-[150px]">{res.appNumber}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-black ${res.evaluation_result.final_score >= 85 ? 'text-emerald-600' : res.evaluation_result.final_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {res.evaluation_result.final_score}%
                        </span>
                        <ChevronRight size={18} className="inline ml-3 text-slate-300 group-hover:text-indigo-400 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8">
                {selectedApp ? (
                  <ResultView result={selectedApp} />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-[3rem] h-full min-h-[500px] flex flex-col items-center justify-center p-16 text-center text-slate-400 border-dashed">
                    <div className="p-8 bg-slate-50 rounded-full mb-8">
                      <BrainCircuit size={64} className="opacity-20 text-indigo-500" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Delta Evidence Deep-Dive</h3>
                    <p className="text-slate-500 max-w-sm leading-relaxed">Select a case to visualize how the AI strategies compared against the legal ground truth.</p>
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
          <span className="text-[10px] uppercase tracking-wider">Empty</span>
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
    <div className={`p-10 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center text-center gap-6 transition-all ${fileName ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-400 bg-slate-50/80 shadow-inner'}`}>
      <div className="p-5 bg-white rounded-3xl shadow-md group-hover:scale-110 transition-transform">{icon}</div>
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
  <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col justify-between hover:scale-[1.02] transition-all relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 120 }) : null}
    </div>
    <div className="flex items-center gap-4 mb-6">
      <div className="p-3 bg-slate-50 rounded-2xl shadow-inner">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
    </div>
    <div>
      <h3 className="text-4xl font-black text-slate-900 leading-none mb-2">{value}</h3>
      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{trend}</p>
    </div>
  </div>
);

export default App;
