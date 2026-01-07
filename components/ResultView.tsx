
import React from 'react';
import { AuditResult } from '../types';
import ScoreGauge from './ScoreGauge';
import { Target, Gavel, Zap, Search, ShieldCheck, Scale, FileText } from 'lucide-react';

interface ResultViewProps {
  result: AuditResult;
}

const ResultView: React.FC<ResultViewProps> = ({ result }) => {
  const { winning_amendment, strategy_evaluation, final_score, auditor_reasoning } = result.evaluation_result;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8">
      {/* Header Score Section */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 p-8 flex flex-col md:flex-row items-center gap-10">
        <div className="w-full md:w-1/3">
          <ScoreGauge score={final_score} />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" size={20} />
            <h2 className="text-2xl font-black text-slate-900">Efficacy Evaluation</h2>
          </div>
          <p className="text-slate-500 leading-relaxed text-sm">
            Professional audit determining the alignment between predicted strategies and allowed claim scope.
          </p>
          <div className="flex gap-2">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              final_score >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
              Accuracy: {strategy_evaluation.prediction_accuracy}
            </span>
            <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
              Source: {winning_amendment.source_type}
            </span>
          </div>
        </div>
      </div>

      {/* 1. The Winning Amendment (The Delta) */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
          <Zap size={100} />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Target size={20} /></div>
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">1. The Winning Amendment (The Delta)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase">Summary of Change</span>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">{winning_amendment.summary}</p>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase">Source of Change</span>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xs font-mono font-bold text-slate-600">{winning_amendment.source_details}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Strategy Evaluation */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
          <Scale size={100} />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><Search size={20} /></div>
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">2. Strategy Evaluation</h3>
        </div>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase">Best Performing Strategy</span>
              <p className="text-sm font-bold text-slate-800">{strategy_evaluation.best_matching_strategy_name}</p>
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase">Did tool predict outcome?</span>
              <p className={`text-sm font-bold ${final_score >= 70 ? 'text-emerald-600' : 'text-red-500'}`}>
                {final_score >= 85 ? 'Yes' : final_score >= 70 ? 'Partially' : 'No'}
              </p>
            </div>
          </div>
          <div className="space-y-2 pt-4 border-t border-slate-50">
            <span className="text-[10px] font-black text-slate-400 uppercase">Audit Analysis</span>
            <p className="text-sm text-slate-600 leading-relaxed italic">&ldquo;{strategy_evaluation.match_analysis}&rdquo;</p>
          </div>
        </div>
      </section>

      {/* 4. Auditor's Reasoning */}
      <section className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="absolute -bottom-10 -right-10 opacity-5 text-white">
          <Gavel size={240} />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-white/10 rounded-xl text-indigo-400"><Gavel size={20} /></div>
          <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm">Auditor's Professional Reasoning</h3>
        </div>
        <p className="text-lg font-light leading-relaxed text-slate-200 italic relative z-10">
          {auditor_reasoning}
        </p>
        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between opacity-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Intelligence</span>
          </div>
          <span className="text-[10px] font-mono">ID: {result.appNumber}</span>
        </div>
      </section>
    </div>
  );
};

export default ResultView;
