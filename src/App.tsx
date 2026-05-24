import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ClipboardCheck, 
  Hospital, 
  User, 
  Stethoscope, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  BarChart3,
  Search,
  PlusCircle,
  FileText,
  Download
} from "lucide-react";

interface Problem {
  id: number;
  item_id: number;
  problem_code: string;
  problem_desc: string;
  is_custom_required: number;
}

interface QCItem {
  id: number;
  item_name: string;
  problems: Problem[];
}

interface Metadata {
  hospital_name: string;
  medical_record_no: string;
  patient_status: number;
  death_reason: string;
  surgery_level: number;
  main_diagnosis: string;
  main_operation: string;
  main_surgery: string;
  expert_name: string;
  has_defects: number;
}

interface SelectedProblem {
  problem_id: number;
  custom_text: string;
}

interface ItemSelection {
  item_id: number;
  selected_problems: SelectedProblem[];
}

const HOSPITALS = [
  "上海市第一人民医院",
  "上海市第六人民医院",
  "复旦大学附属中山医院",
  "上海交通大学医学院附属瑞金医院",
  "同济大学附属第十人民医院"
];

export default function App() {
  const [config, setConfig] = useState<QCItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<Metadata>({
    hospital_name: "",
    medical_record_no: "",
    patient_status: 3,
    death_reason: "",
    surgery_level: 2,
    main_diagnosis: "",
    main_operation: "",
    main_surgery: "",
    expert_name: "",
    has_defects: -1 // -1 means unselected
  });

  const [selections, setSelections] = useState<Record<number, SelectedProblem[]>>({});
  const [view, setView] = useState<"form" | "stats">("form");
  const [hospitalStats, setHospitalStats] = useState<any[]>([]);

  // 自动判定缺陷逻辑
  useEffect(() => {
    const positiveWords = ["准确", "已记录", "不涉及", "一致"];
    let hasActualDefect = false;

    Object.values(selections).forEach((selectedProbs) => {
      (selectedProbs as SelectedProblem[]).forEach(s => {
        // 从配置中查找该问题的详细描述
        const problem = config.flatMap(c => c.problems).find(p => p.id === s.problem_id);
        if (problem) {
          const isNegative = !positiveWords.some(word => problem.problem_desc.includes(word));
          if (isNegative) hasActualDefect = true;
        }
      });
    });

    if (hasActualDefect) {
      setMetadata(prev => ({ ...prev, has_defects: 1 }));
    }
  }, [selections, config]);

  useEffect(() => {
    fetch("/api/qc-config")
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      });
  }, []);

  const handleToggleProblem = (itemId: number, problem: Problem, itemIndex: number) => {
    const isSingleChoice = itemIndex >= 26 && itemIndex <= 38;

    setSelections(prev => {
      const current = prev[itemId] || [];
      const exists = current.find(p => p.problem_id === problem.id);
      
      if (isSingleChoice) {
        // If clicking the one that is already selected, unselect it
        if (exists) {
          return {
            ...prev,
            [itemId]: []
          };
        } else {
          // Replace any previous selection for this item
          return {
            ...prev,
            [itemId]: [{ problem_id: problem.id, custom_text: "" }]
          };
        }
      }

      if (exists) {
        return {
          ...prev,
          [itemId]: current.filter(p => p.problem_id !== problem.id)
        };
      } else {
        return {
          ...prev,
          [itemId]: [...current, { problem_id: problem.id, custom_text: "" }]
        };
      }
    });
  };

  const handleCustomTextChange = (itemId: number, problemId: number, text: string) => {
    setSelections(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map(p => 
        p.problem_id === problemId ? { ...p, custom_text: text } : p
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 最终校验逻辑
    const positiveWords = ["准确", "已记录", "不涉及", "一致"];
    let hasActualDefect = false;
    Object.values(selections).forEach((selectedProbs) => {
      (selectedProbs as SelectedProblem[]).forEach(s => {
        const problem = config.flatMap(c => c.problems).find(p => p.id === s.problem_id);
        if (problem) {
          const isNegative = !positiveWords.some(word => problem.problem_desc.includes(word));
          if (isNegative) hasActualDefect = true;
        }
      });
    });

    if (metadata.has_defects === -1) {
      setError("请确认该病例是否存在缺陷（页面底部勾选）");
      return;
    }

    if (hasActualDefect && metadata.has_defects === 0) {
      setError("校验失败：您已勾选具体的缺陷项目，但结论选择了‘无缺陷’。请修正结论。");
      return;
    }

    if (!hasActualDefect && metadata.has_defects === 1) {
      setError("校验失败：您选择了‘有缺陷’，但未在上方质控表中勾选任何具体的缺陷项（正性项除外）。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const details: ItemSelection[] = Object.entries(selections).map(([itemId, probs]) => ({
      item_id: parseInt(itemId),
      selected_problems: probs as SelectedProblem[]
    }));

    try {
      const res = await fetch("/api/qc-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata, details })
      });
      
      if (!res.ok) throw new Error("Submission failed");
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Reset form
      setMetadata({
        hospital_name: "",
        medical_record_no: "",
        patient_status: 3,
        death_reason: "",
        surgery_level: 2,
        main_diagnosis: "",
        main_operation: "",
        main_surgery: "",
        expert_name: "",
        has_defects: -1
      });
      setSelections({});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchStats = async () => {
    const hospRes = await fetch("/api/stats/hospitals");
    const hospData = await hospRes.json();
    setHospitalStats(hospData);
    setView("stats");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      >
        <Activity size={32} />
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#1E293B] font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#2563EB] rounded flex items-center justify-center text-white font-bold">QC</div>
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">病例质控信息填报管理系统</h1>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Medical Quality Control System</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setView("form")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === "form" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              数据录入
            </button>
            <button 
              onClick={fetchStats}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === "stats" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              统计分析
            </button>
          </div>
          <div className="hidden md:flex items-center space-x-3 text-sm border-l border-slate-200 pl-6">
            <span className="text-slate-500">状态:</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200 font-medium">系统在线</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "form" ? (
            <motion.form 
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="h-full grid grid-cols-12 gap-6 p-6 overflow-hidden"
            >
              {/* Left Column: Metadata (col-span-4) */}
              <section className="col-span-12 lg:col-span-4 flex flex-col space-y-6 overflow-hidden">
                <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-6 flex flex-col h-full overflow-hidden">
                  <h2 className="border-l-4 border-[#2563EB] pl-3 font-bold text-[#1E293B] mb-6">病例元数据填写</h2>
                  <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">被检查医院名称</label>
                      <select 
                        required
                        className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all text-sm"
                        value={metadata.hospital_name}
                        onChange={e => setMetadata({...metadata, hospital_name: e.target.value})}
                      >
                        <option value="">请选择医院...</option>
                        {HOSPITALS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">病历号 (MRN)</label>
                        <input 
                          required
                          type="text"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all text-sm"
                          placeholder="MRN"
                          value={metadata.medical_record_no}
                          onChange={e => setMetadata({...metadata, medical_record_no: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">质控专家</label>
                        <input 
                          required
                          type="text"
                          className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all text-sm"
                          placeholder="姓名"
                          value={metadata.expert_name}
                          onChange={e => setMetadata({...metadata, expert_name: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">患者离院状态</label>
                      <select 
                        className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all text-sm"
                        value={metadata.patient_status}
                        onChange={e => {
                          const status = parseInt(e.target.value);
                          setMetadata({
                            ...metadata, 
                            patient_status: status,
                            death_reason: status !== 1 ? "" : metadata.death_reason
                          });
                        }}
                      >
                        <option value={1}>死亡 (Death)</option>
                        <option value={2}>非医嘱离院 (Discharged AMA)</option>
                        <option value={3}>常规出院 (Regular)</option>
                      </select>
                    </div>

                    <AnimatePresence>
                      {metadata.patient_status === 1 && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-1 overflow-hidden"
                        >
                          <label className="block text-[11px] font-bold text-rose-500 uppercase tracking-tight">死亡原因 (必填)</label>
                          <input 
                            required
                            type="text"
                            className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-all text-sm"
                            placeholder="请输入死亡原因..."
                            value={metadata.death_reason}
                            onChange={e => setMetadata({...metadata, death_reason: e.target.value})}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">主要诊断</label>
                      <textarea 
                        className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all text-sm min-h-[100px] resize-none"
                        placeholder="主要诊断内容描述..."
                        value={metadata.main_diagnosis}
                        onChange={e => setMetadata({...metadata, main_diagnosis: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">手术级别</label>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                        <label className="flex items-center text-sm cursor-pointer group">
                          <input 
                            type="radio" 
                            name="surg" 
                            className="mr-2 w-4 h-4 accent-blue-600" 
                            checked={metadata.surgery_level === 1}
                            onChange={() => setMetadata({...metadata, surgery_level: 1, main_operation: ""})}
                          /> 
                          <span className="text-slate-600 group-hover:text-slate-900">四级手术</span>
                        </label>
                        <label className="flex items-center text-sm cursor-pointer group">
                          <input 
                            type="radio" 
                            name="surg" 
                            className="mr-2 w-4 h-4 accent-blue-600" 
                            checked={metadata.surgery_level === 2}
                            onChange={() => setMetadata({...metadata, surgery_level: 2, main_operation: ""})}
                          /> 
                          <span className="text-slate-600 group-hover:text-slate-900">其他级别</span>
                        </label>
                        <label className="flex items-center text-sm cursor-pointer group">
                          <input 
                            type="radio" 
                            name="surg" 
                            className="mr-2 w-4 h-4 accent-blue-600" 
                            checked={metadata.surgery_level === 3}
                            onChange={() => setMetadata({...metadata, surgery_level: 3, main_surgery: ""})}
                          /> 
                          <span className="text-slate-600 group-hover:text-slate-900">非手术</span>
                        </label>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {metadata.surgery_level === 3 ? (
                        <motion.div 
                          key="op"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="space-y-1"
                        >
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">主要操作名称 (选填)</label>
                          <input 
                            type="text"
                            className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#2563EB] transition-all text-sm"
                            placeholder="非手术患者主要操作..."
                            value={metadata.main_operation}
                            onChange={e => setMetadata({...metadata, main_operation: e.target.value})}
                          />
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="surg"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="space-y-1"
                        >
                          <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-tight">主要手术名称 (必填)</label>
                          <input 
                            required
                            type="text"
                            className="w-full px-3 py-2 bg-blue-50/30 border border-blue-200 rounded focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                            placeholder="请输入手术名称..."
                            value={metadata.main_surgery}
                            onChange={e => setMetadata({...metadata, main_surgery: e.target.value})}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </section>

              {/* Right Column: QC Items (col-span-8) */}
              <section className="col-span-12 lg:col-span-8 flex flex-col overflow-hidden">
                <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-6 flex flex-col h-full overflow-hidden">
                  <h2 className="border-l-4 border-[#2563EB] pl-3 font-bold text-[#1E293B] mb-6">质控项目与问题分类</h2>
                  <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
                    {config.map((item, idx) => (
                      <div key={item.id} className={`${idx !== config.length - 1 ? 'border-b border-slate-100 pb-8' : ''}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-slate-700">{idx + 1}. {item.item_name}</h3>
                          {selections[item.id]?.length > 0 && (
                            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 animate-in fade-in zoom-in duration-300">
                              已勾选 {selections[item.id].length} 项
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.problems.map((problem) => {
                            const isSelected = (selections[item.id] || []).some(p => p.problem_id === problem.id);
                            const selection = (selections[item.id] || []).find(p => p.problem_id === problem.id);
                            
                            return (
                              <div key={problem.id} className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProblem(item.id, problem, idx + 1)}
                                  className={`inline-flex items-center px-3 py-1.5 rounded border text-sm transition-all cursor-pointer select-none ${
                                    isSelected 
                                    ? "bg-[#DBEAFE] border-[#2563EB] text-[#1E40AF] font-medium" 
                                    : "bg-[#F8FAFC] border-[#E2E8F0] text-slate-600 hover:border-slate-300"
                                  }`}
                                >
                                  {problem.problem_desc}
                                </button>
                                
                                {isSelected && problem.is_custom_required === 1 && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-full max-w-sm"
                                  >
                                    <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">自定义分类描述</label>
                                    <input
                                      required
                                      type="text"
                                      className="w-full px-3 py-1.5 bg-blue-50/50 border border-blue-200 rounded text-sm focus:outline-none focus:border-blue-400"
                                      placeholder="描述具体问题..."
                                      value={selection?.custom_text || ""}
                                      onChange={e => handleCustomTextChange(item.id, problem.id, e.target.value)}
                                    />
                                  </motion.div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Bottom Fixed Action Bar */}
              <div className="col-span-12 flex flex-col bg-white border border-[#E2E8F0] rounded-lg shadow-sm mt-auto">
                {/* 缺陷判定区域 */}
                <div className="px-6 py-3 border-b border-slate-50 flex items-center bg-slate-50/30">
                  <span className="text-sm font-bold text-slate-700 mr-8 flex items-center">
                    <AlertCircle size={16} className="mr-2 text-blue-500" />
                    最终质控结论：
                  </span>
                  <div className="flex gap-x-8">
                    <label className="flex items-center text-sm cursor-pointer group">
                      <input 
                        type="radio" 
                        name="final_defects" 
                        className="mr-2 w-4 h-4 accent-red-600" 
                        checked={metadata.has_defects === 1}
                        onChange={() => setMetadata({...metadata, has_defects: 1})}
                      /> 
                      <span className={`font-medium ${metadata.has_defects === 1 ? 'text-red-600' : 'text-slate-500 group-hover:text-slate-900'}`}>
                        有缺陷 (Has Defects)
                      </span>
                    </label>
                    <label className="flex items-center text-sm cursor-pointer group">
                      <input 
                        type="radio" 
                        name="final_defects" 
                        className="mr-2 w-4 h-4 accent-emerald-600" 
                        checked={metadata.has_defects === 0}
                        onChange={() => setMetadata({...metadata, has_defects: 0})}
                      /> 
                      <span className={`font-medium ${metadata.has_defects === 0 ? 'text-emerald-600' : 'text-slate-500 group-hover:text-slate-900'}`}>
                        无缺陷 (No Defects)
                      </span>
                    </label>
                  </div>
                  {metadata.has_defects === -1 && (
                    <span className="ml-auto text-[11px] text-rose-500 font-bold animate-pulse">
                      * 必填项：请选择判定结果
                    </span>
                  )}
                </div>

                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1">
                    {error && (
                      <span className="text-rose-600 text-xs font-bold flex items-center gap-1">
                        <AlertCircle size={14} /> {error}
                      </span>
                    )}
                    {success && (
                      <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 size={14} /> 报告提交成功
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      className="px-6 py-2 border border-slate-300 text-slate-600 text-sm rounded font-medium hover:bg-slate-50 transition-colors"
                    >
                      存为草稿
                    </button>
                    <button
                      disabled={submitting}
                      className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-blue-300 text-white px-8 py-2 rounded text-sm font-bold transition-all flex items-center gap-2 shadow-sm"
                    >
                      {submitting ? "正在提交..." : "提交质控报告"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.form>
          ) : (
            <motion.div 
              key="stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 max-w-5xl mx-auto h-full overflow-hidden flex flex-col space-y-6"
            >
              {/* Hospital Counts Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm p-8 flex flex-col shrink-0">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="border-l-4 border-[#2563EB] pl-3 text-xl font-bold text-[#1E293B]">各医院质控病例数统计</h2>
                    <p className="text-slate-400 text-xs font-semibold mt-1">Medical Records by Hospital</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => window.open("/api/export")}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded shadow-sm transition-all"
                    >
                      <Download size={18} />
                      导出原始数据 (CSV)
                    </button>
                    <Hospital className="text-blue-600" size={24} />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hospitalStats.length > 0 ? (
                    hospitalStats.map((h, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-lg flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">{h.hospital_name}</span>
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-blue-600 mr-2">{h.count}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">份</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-4 text-center text-slate-400 text-sm italic">
                      暂无数据
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
