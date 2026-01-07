
import React from 'react';
import { AuditResult } from '../types';
import ScoreGauge from './ScoreGauge';
import { CheckCircle, AlertCircle, FileText, Target, Gavel, Scale, BrainCircuit, Zap, Database } from 'lucide-react';

interface ResultViewProps {
  result: AuditResult;
}

const ResultView: React.FC<ResultViewProps> = ({ result }) => {
  const evalData = result.evaluation_result;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div className="p-10 flex flex-col lg:flex-row items-center gap-12">
          <div className="w-full lg:w-2/5">
            <ScoreGauge score={evalData.final_score} />
            <div className="mt-4 text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Retrieval Success</span>
              <div className="flex items-center justify-center gap-1">
                 <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: `${evalData.strategy_evaluation.retrieval_success_rate}%` }} />
                 </div>
                 <span className="text-xs font-bold text-slate-700">{evalData.strategy_evaluation.retrieval_success_rate}%</span>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit size={18} className="text-indigo-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Precision Audit</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Intelligence Breakdown</h2>
              <p className="text-slate-500 text-lg font-medium mt-2 leading-relaxed">Cross-referenced strategy performance vs. specification retrieval.</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <span className={`px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm border ${
                evalData.strategy_evaluation.prediction_accuracy === 'Exact Match' ? 'bg-green-50 text-green-700 border-green-200' :
                evalData.strategy_evaluation.prediction_accuracy === 'Concept Match' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                evalData.strategy_evaluation.prediction_accuracy === 'Partial Match' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {evalData.strategy_evaluation.prediction_accuracy}
              </span>
              <span className="px-5 py-2 rounded-2xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border border-slate-200 shadow-sm">
                Origin: {evalData.winning_amendment.source_type}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-indigo-50/50 group-hover:text-indigo-50 transition-colors">
             <Database size={120} />
          </div>
          <div className="flex items-center gap-3 mb-6 relative">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm"><Zap size={20} /></div>
            <h3 className="font-black uppercase tracking-widest text-xs text-slate-500">Technical Delta Detected</h3>
          </div>
          <div className="space-y-4 relative">
            <div className="bg-slate-900 p-4 rounded-xl border-l-4 border-indigo-500">
               <p className="text-indigo-300 font-mono text-[11px] mb-1 font-black uppercase tracking-widest">Limitation added:</p>
               <p className="text-white font-bold text-sm leading-relaxed italic">&ldquo;{evalData.winning_amendment.technical_delta}&rdquo;</p>
            </div>
            <div className="pt-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">Spec Evidence Path</span>
              <p className="text-xs text-slate-700 font-bold bg-slate-50 p-3 rounded-xl border border-slate-100">
                {evalData.winning_amendment.evidence_link}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-emerald-50/50 group-hover:text-emerald-50 transition-colors">
            <CheckCircle size={120} />
          </div>
          <div className="flex items-center gap-3 mb-6 relative">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shadow-sm"><Target size={20} /></div>
            <h3 className="font-black uppercase tracking-widest text-xs text-slate-500">Retrieval Comparison</h3>
          </div>
          <div className="space-y-4 relative">
            <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-black uppercase tracking-widest">Predicted Strategy</span>
              <span className="text-xs font-black text-emerald-900 px-3 py-1 bg-white rounded-lg shadow-sm">{evalData.strategy_evaluation.best_matching_strategy_name}</span>
            </div>
            <p className="text-slate-700 leading-relaxed text-sm font-medium">{evalData.strategy_evaluation.match_analysis}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute -bottom-10 -right-10 opacity-10">
          <Gavel size={240} />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-white/10 rounded-2xl text-indigo-400"><Gavel size={24} /></div>
          <h3 className="font-black uppercase tracking-[0.2em] text-xs text-slate-400">Agentic Audit Narrative</h3>
        </div>
        <p className="text-slate-200 leading-relaxed text-lg font-light italic relative">
          &ldquo;{evalData.auditor_reasoning}&rdquo;
        </p>
        <div className="mt-8 flex items-center gap-3 border-t border-white/5 pt-8">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-black text-[10px]">AI</div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Legal Intelligence Verification Engine</span>
        </div>
      </div>
    </div>
  );
};

export default ResultView;
