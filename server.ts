import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import cors from "cors";
import { z } from "zod";

const db = new Database("qc_system.db");

// Migration: Ensure has_defects column exists in qc_cases
try {
  const tableInfo = db.prepare("PRAGMA table_info(qc_cases)").all();
  const hasDefectsColumn = tableInfo.some((col: any) => col.name === "has_defects");
  if (!hasDefectsColumn) {
    db.exec("ALTER TABLE qc_cases ADD COLUMN has_defects INTEGER DEFAULT 0");
    console.log("Migrated database: added has_defects column to qc_cases");
  }
} catch (e) {
  console.log("Migration check skipped or table not yet created");
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS qc_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hospital_name TEXT NOT NULL,
    medical_record_no TEXT NOT NULL,
    patient_status INTEGER, -- 1: Death, 2: Discharged against advice, 3: Other
    death_reason TEXT,
    surgery_level INTEGER, -- 1: Level 4, 2: Other, 3: Non-surgery
    main_diagnosis TEXT,
    main_operation TEXT,
    main_surgery TEXT,
    expert_name TEXT,
    has_defects INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS qc_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS qc_standard_problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    problem_code TEXT,
    problem_desc TEXT,
    is_custom_required INTEGER DEFAULT 0,
    FOREIGN KEY (item_id) REFERENCES qc_items(id)
  );

  CREATE TABLE IF NOT EXISTS qc_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER,
    item_id INTEGER,
    problem_id INTEGER,
    custom_content TEXT,
    FOREIGN KEY (case_id) REFERENCES qc_cases(id),
    FOREIGN KEY (item_id) REFERENCES qc_items(id),
    FOREIGN KEY (problem_id) REFERENCES qc_standard_problems(id)
  );
`);

// Seed Initial Data - Force refresh for config changes
const forceRefresh = true;
if (forceRefresh) {
  db.exec("DELETE FROM qc_results; DELETE FROM qc_standard_problems; DELETE FROM qc_items;");
  const insertItem = db.prepare("INSERT INTO qc_items (item_name) VALUES (?)");
  const insertProblem = db.prepare("INSERT INTO qc_standard_problems (item_id, problem_code, problem_desc, is_custom_required) VALUES (?, ?, ?, ?)");

  const items = [
    { name: "主诉 (Chief Complaint)", problems: [
      { code: "1", desc: "主诉超过20个字" },
      { code: "2", desc: "主诉与现病史不一致" },
      { code: "3", desc: "主诉不能导出第一诊断" },
      { code: "4", desc: "主诉未说明发病时间" },
      { code: "5", desc: "主诉不规范或用诊断代替,而在现病史中发现有症状" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "现病史 (History of Present Illness)", problems: [
      { code: "1", desc: "现病史与主诉不相关、不相符" },
      { code: "2", desc: "起病时间描述不准确或未写有无诱因" },
      { code: "3", desc: "主要症状发生部位、时间、性质、程度及伴随症状描述不清楚" },
      { code: "4", desc: "无疾病演变情况" },
      { code: "5", desc: "缺有鉴别诊断意义的重要阴性症状与体征" },
      { code: "6", desc: "未记录发病以来诊疗经过及结果" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "体格检查 (Physical Examination)", problems: [
      { code: "1", desc: "体格检查缺项" },
      { code: "2", desc: "与本次住院疾病相关查体项目不充分" },
      { code: "3", desc: "主要阳性体征未记录" },
      { code: "4", desc: "专科检查不全面" },
      { code: "5", desc: "应有的鉴别诊断体征未记或记录不全" },
      { code: "6", desc: "体格检查与专科检查体征前后矛盾" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "病例特点 (Case Features)", problems: [
      { code: "1", desc: "拷贝/照搬入院记录现病史" },
      { code: "2", desc: "拷贝体检及辅助检查" },
      { code: "3", desc: "未归纳提炼，条理不清" },
      { code: "4", desc: "病例特点不能支撑初步诊断" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "拟诊讨论 (Diagnosis Discussion)", problems: [
      { code: "1", desc: "无分析讨论、无鉴别诊断" },
      { code: "2", desc: "分析讨论不够、鉴别诊断不够" },
      { code: "3", desc: "拟诊讨论部分重复病例特点" },
      { code: "4", desc: "同科同种疾病拟诊讨论内容完全相同" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "诊疗计划 (Treatment Plan)", problems: [
      { code: "1", desc: "诊疗计划套话空话" },
      { code: "2", desc: "诊疗计划缺乏针对性" },
      { code: "3", desc: "诊疗计划不具体" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "病情记录 (Progress Notes)", problems: [
      { code: "1", desc: "未及时记录病情变化" },
      { code: "2", desc: "未及时记录检查结果" },
      { code: "3", desc: "病情及检查结果无分析、判断、处理的记录" },
      { code: "4", desc: "辅助检查检验结果代替病情记录" },
      { code: "5", desc: "医嘱病危的患者未每天记录病程" },
      { code: "6", desc: "医嘱病重的患者未每2天记录一次病程" },
      { code: "7", desc: "病情稳定患者未每3天记录一次病程" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "二次以上病程记录完全相同" },
      { code: "10", desc: "转入记录拷贝转出记录" },
      { code: "11", desc: "缺有创操作记录" },
      { code: "99", desc: "其他", custom: 1 }
    ]},
    { name: "首次查房 (Initial Ward Round)", problems: [
      { code: "1", desc: "未记录上级医师查房对病史有无补充、查体有无新发现" },
      { code: "2", desc: "48小时内无上级医师查房记录" },
      { code: "3", desc: "无分析讨论、无鉴别诊断" },
      { code: "4", desc: "无病情评估记录" },
      { code: "5", desc: "无诊疗方案" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "日常查房 (Daily Ward Rounds)", problems: [
      { code: "1", desc: "主治医师日常查房无内容、无分析、无处理意见或其它缺陷" },
      { code: "2", desc: "副主任以上医师查房无分析及指导诊疗的意见" },
      { code: "3", desc: "对确诊困难或疗效不确切的病例无分析、内容简单，或记录内容有明显缺陷" },
      { code: "4", desc: "病情有恶化趋势未观察到并做相关记录" },
      { code: "5", desc: "缺上级医师日常查房记录" },
      { code: "6", desc: "医嘱病危的患者未每天记录上级医师查房意见" },
      { code: "7", desc: "出院前缺上级医师查房" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "术前评估及准备 (Pre-op Assessment)", problems: [
      { code: "1", desc: "无术前24小时内术者查房记录" },
      { code: "2", desc: "未完成术前常规检验（如肝功、肾功、出凝血时间、HBSAG、血常规、尿常规、血型等）" },
      { code: "3", desc: "未完成术前常规检查（如心电图、胸片等）" },
      { code: "4", desc: "无手术医嘱" },
      { code: "5", desc: "手术医嘱不规范" },
      { code: "6", desc: "手术医嘱开立时间和手术知情同意书签署时间早于术前讨论" },
      { code: "7", desc: "严重合并症评估及处理结果未记录" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "术前小结/讨论记录 (Pre-op Summary/Discussion)", problems: [
      { code: "1", desc: "无术前小结" },
      { code: "2", desc: "术前小结有缺项、漏项" },
      { code: "3", desc: "无术前讨论" },
      { code: "4", desc: "术前讨论有缺项、漏项等内容缺陷" },
      { code: "5", desc: "术前讨论手术指征不明确" },
      { code: "6", desc: "术前讨论手术指征拷贝病史或检查结果" },
      { code: "7", desc: "术前讨论讨论意见拷贝病史等内容" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "未记录手术风险防范措施" },
      { code: "99", desc: "其他", custom: 1 }
    ]},
    { name: "四级手术术前多学科讨论记录 (Grade 4 Surgery MDT)", problems: [
      { code: "1", desc: "四级手术无多学科讨论" },
      { code: "2", desc: "四级手术多学科讨论记录不规范" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "麻醉记录 (Anesthesia Record)", problems: [
      { code: "1", desc: "无麻醉记录单" },
      { code: "2", desc: "未记录麻醉监测内容、麻醉中的病情变化和处理措施" },
      { code: "3", desc: "麻醉记录缺项或写错或不规范" },
      { code: "4", desc: "无麻醉术前访视" },
      { code: "5", desc: "无麻醉术后访视" },
      { code: "6", desc: "术前/术后访视内容不规范" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "手术记录 (Operative Record)", problems: [
      { code: "1", desc: "无手术记录单" },
      { code: "2", desc: "手术记录缺项或写错" },
      { code: "3", desc: "手术记录内容不规范" },
      { code: "4", desc: "手术名称与手术记录不符" },
      { code: "5", desc: "手术记录内容与麻醉记录内容不一致" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "术后记录 (Post-operative Records)", problems: [
      { code: "1", desc: "无术后24小时内术者查房记录" },
      { code: "2", desc: "无术后当天首次病程记录" },
      { code: "3", desc: "无术后连续三天病程记录" },
      { code: "4", desc: "未详细记录患者术后病情变化、生命体征等" },
      { code: "5", desc: "未详细记录与手术相关重点观察内容及处理情况" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "出院/死亡记录 (Discharge/Death Record)", problems: [
      { code: "1", desc: "出院/死亡记录项目不全" },
      { code: "2", desc: "大量导入检验检查结果，未对住院期间诊疗情况进行归纳总结" },
      { code: "3", desc: "死亡患者诊疗经过中对病情演变、抢救经过记录不全" },
      { code: "4", desc: "缺出院诊断/死亡诊断" },
      { code: "5", desc: "出院诊断依据不充分、诊断不规范" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "死亡病例讨论记录 (Death Case Discussion)", problems: [
      { code: "1", desc: "缺死亡病例讨论记录" },
      { code: "2", desc: "死亡病例讨论未在规定时间内完成" },
      { code: "3", desc: "主持人员不符合要求" },
      { code: "4", desc: "参加人员不符合要求" },
      { code: "5", desc: "死亡原因未分析记录" },
      { code: "7", desc: "拷贝问题" },
      { code: "9", desc: "其他", custom: 1 }
    ]},
    { name: "抗菌药物使用记录符合率 (Antibiotic Use Compliance)", problems: [
      { code: "1", desc: "严重违反抗菌药物使用原则（药物品种、剂型选择、用量、用法、用药疗程、用药时机等不符合要求）" },
      { code: "2", desc: "使用抗菌药物无医嘱" },
      { code: "3", desc: "医嘱不完整不规范" },
      { code: "4", desc: "情况在病程记录中没有相应记录" },
      { code: "5", desc: "使用、停用、更换、联合或超说明书范围使用时，无用药理由或理由不充分" },
      { code: "6", desc: "48-72小时内无效果评价" },
      { code: "7", desc: "治疗性使用抗生素无病原学检查" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他缺陷", custom: 1 },
      { code: "10", desc: "经验用药时未说明理由，无样可采时未注明原因" },
      { code: "11", desc: "不涉及" }
    ]},
    { name: "恶性肿瘤化学治疗记录符合率 (Malignant Tumor Chemotherapy Compliance)", problems: [
      { code: "1", desc: "恶性肿瘤化学治疗无医嘱" },
      { code: "2", desc: "医嘱中化疗药物名称、剂量、使用方法书写不规范" },
      { code: "3", desc: "缺恶性肿瘤化学治疗知情同意书" },
      { code: "4", desc: "恶性肿瘤化学治疗知情同意书写不规范" },
      { code: "5", desc: "病程中未记录化学治疗的情况" },
      { code: "6", desc: "病程中化学治疗记录情况（药物名称、剂量、使用方法、时间）与医嘱不一致" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他缺陷", custom: 1 },
      { code: "10", desc: "不涉及" }
    ]},
    { name: "恶性肿瘤放射治疗记录符合率 (Malignant Tumor Radiotherapy Compliance)", problems: [
      { code: "1", desc: "恶性肿瘤放射治疗无医嘱" },
      { code: "2", desc: "医嘱中放射剂量、放射方式、放射部位、放射时间书写不规范" },
      { code: "3", desc: "缺恶性肿瘤放射治疗知情同意书" },
      { code: "4", desc: "恶性肿瘤放射治疗知情同意书写不规范" },
      { code: "5", desc: "无恶性肿瘤放射治疗记录单或病程中未记录放射治疗的情况" },
      { code: "6", desc: "病程或放射治疗单中放射治疗记录情况（放射剂量、放射方式、放射部位、放射时间）与医嘱不一致" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他缺陷", custom: 1 },
      { code: "10", desc: "不涉及" }
    ]},
    { name: "植入物相关记录符合率 (Implant-related Record Compliance)", problems: [
      { code: "1", desc: "拟使用的植入类医用耗材使用前未纳入术前讨论" },
      { code: "2", desc: "知情同意书未包含植入物种类、规格/型号、数量和价格等信息" },
      { code: "3", desc: "手术记录中未记录植入物名称、种类、规格/型号、材质及数量等信息" },
      { code: "4", desc: "术中使用植入物与术前不一致未做说明及告知" },
      { code: "5", desc: "植入物条形码有缺失" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他缺陷", custom: 1 },
      { code: "10", desc: "不涉及" }
    ]},
    { name: "临床用血相关记录符合率 (Clinical Blood Use Compliance)", problems: [
      { code: "1", desc: "无输血知情同意书" },
      { code: "2", desc: "输血知情同意书填写或签名不完整" },
      { code: "3", desc: "无输血医嘱或输血医嘱不规范" },
      { code: "4", desc: "输血前常规检查不完整" },
      { code: "5", desc: "无输血前评估记录或输血前评估记录不完整" },
      { code: "6", desc: "无输血病程记录" },
      { code: "7", desc: "输血病程记录不完整或不规范" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他缺陷", custom: 1 },
      { code: "10", desc: "无输血后评价" },
      { code: "11", desc: "有术中输血，但手术记录、麻醉记录、术后首次病程记录中输血相关内容记录不一致" },
      { code: "12", desc: "不涉及" }
    ]},
    { name: "患者抢救记录及时完成率 (Patient Rescue Record Timely Completion Rate)", problems: [
      { code: "1", desc: "缺抢救记录" },
      { code: "2", desc: "缺抢救医嘱" },
      { code: "3", desc: "未按时限（抢救结束后6小时内）完成抢救记录" },
      { code: "4", desc: "抢救记录无病情变化情况及措施" },
      { code: "5", desc: "未记录参加抢救的医务人员姓名及专业技术职称" },
      { code: "6", desc: "记录时间未具体到分钟" },
      { code: "7", desc: "医嘱未在抢救结束后6小时内补记" },
      { code: "8", desc: "拷贝问题" },
      { code: "9", desc: "其他缺陷", custom: 1 },
      { code: "10", desc: "实施有创抢救措施未签署知情告知书" },
      { code: "11", desc: "不涉及" }
    ]},
    { name: "核心制度落实情况 (Core System Implementation)", problems: [
      { code: "1", desc: "管床医师交、接班记录缺陷" },
      { code: "2", desc: "缺手术安全核查表" },
      { code: "3", desc: "手术安全核查表缺陷" },
      { code: "4", desc: "缺危急值报告病程记录或有缺陷" },
      { code: "9", desc: "其他缺陷", custom: 1 }
    ]},
    { name: "诊疗合理性 (Diagnostics and Treatment Rationality)", problems: [
      { code: "1", desc: "点击此处描述具体诊疗合理性问题", custom: 1 }
    ]},
    { name: "主要诊断填写 (Primary Diagnosis Entry)", problems: [
      { code: "1", desc: "医师错填" },
      { code: "2", desc: "其他问题", custom: 1 }
    ]},
    { name: "主要诊断编码 (Primary Diagnosis Coding)", problems: [
      { code: "1", desc: "编码员错编" },
      { code: "2", desc: "其他问题", custom: 1 }
    ]},
    { name: "其他诊断填写 (Other Diagnosis Entry)", problems: [
      { code: "1", desc: "医师错填" },
      { code: "2", desc: "医师多填" },
      { code: "3", desc: "医师漏填" }
    ]},
    { name: "其他诊断编码 (Other Diagnosis Coding)", problems: [
      { code: "1", desc: "编码员错编" },
      { code: "2", desc: "编码员多编" },
      { code: "3", desc: "编码员漏编" }
    ]},
    { name: "主要手术操作填写 (Primary Procedure Entry)", problems: [
      { code: "1", desc: "医师错填" },
      { code: "2", desc: "其他问题", custom: 1 },
      { code: "3", desc: "不涉及" }
    ]},
    { name: "主要手术操作编码 (Primary Procedure Coding)", problems: [
      { code: "1", desc: "编码员错编" },
      { code: "2", desc: "其他问题", custom: 1 },
      { code: "3", desc: "不涉及" }
    ]},
    { name: "其他手术操作填写 (Other Procedure Entry)", problems: [
      { code: "1", desc: "医师错填" },
      { code: "2", desc: "医师多填" },
      { code: "3", desc: "医师漏填" },
      { code: "4", desc: "不涉及" }
    ]},
    { name: "其他手术操作编码 (Other Procedure Coding)", problems: [
      { code: "1", desc: "编码员错编" },
      { code: "2", desc: "编码员多编" },
      { code: "3", desc: "编码员漏编" },
      { code: "4", desc: "不涉及" }
    ]},
    { name: "入院病情 (Admission Condition)", problems: [
      { code: "1", desc: "准确" },
      { code: "2", desc: "不准确" }
    ]},
    { name: "入院途径 (Admission Pathway)", problems: [
      { code: "1", desc: "准确" },
      { code: "2", desc: "不准确" }
    ]},
    { name: "首页术者与手术记录一致性 (Consistency between Operator and Records)", problems: [
      { code: "1", desc: "一致" },
      { code: "2", desc: "不一致" },
      { code: "3", desc: "不涉及" }
    ]},
    { name: "有创呼吸机使用时间记录 (Invasive Ventilator Usage Time Recording)", problems: [
      { code: "1", desc: "已记录" },
      { code: "2", desc: "未记录" },
      { code: "3", desc: "不涉及" }
    ]},
    { name: "颅脑损伤患者昏迷时间记录 (Coma Time Recording for TBI)", problems: [
      { code: "1", desc: "已记录" },
      { code: "2", desc: "未记录" },
      { code: "3", desc: "不涉及" }
    ]}
  ];

  for (const item of items) {
    const res = insertItem.run(item.name);
    const itemId = res.lastInsertRowid;
    for (const prob of item.problems) {
      insertProblem.run(itemId, prob.code, prob.desc, prob.custom || 0);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/qc-config", (req, res) => {
    const items = db.prepare("SELECT * FROM qc_items").all();
    const problems = db.prepare("SELECT * FROM qc_standard_problems").all();
    
    const config = items.map((item: any) => ({
      ...item,
      problems: problems.filter((p: any) => p.item_id === item.id)
    }));

    res.json(config);
  });

  app.post("/api/qc-cases", (req, res) => {
    const schema = z.object({
      metadata: z.object({
        hospital_name: z.string(),
        medical_record_no: z.string(),
        patient_status: z.number().optional(),
        death_reason: z.string().optional(),
        surgery_level: z.number().optional(),
        main_diagnosis: z.string().optional(),
        main_operation: z.string().optional(),
        main_surgery: z.string().optional(),
        expert_name: z.string(),
        has_defects: z.number().optional()
      }),
      details: z.array(z.object({
        item_id: z.number(),
        selected_problems: z.array(z.object({
          problem_id: z.number(),
          custom_text: z.string().optional()
        }))
      }))
    });

    const body = schema.parse(req.body);

    const transaction = db.transaction(() => {
      const insertCase = db.prepare(`
        INSERT INTO qc_cases (
          hospital_name, medical_record_no, patient_status, death_reason, 
          surgery_level, main_diagnosis, main_operation, main_surgery, expert_name, has_defects
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const caseRes = insertCase.run(
        body.metadata.hospital_name,
        body.metadata.medical_record_no,
        body.metadata.patient_status || null,
        body.metadata.death_reason || null,
        body.metadata.surgery_level || null,
        body.metadata.main_diagnosis || null,
        body.metadata.main_operation || null,
        body.metadata.main_surgery || null,
        body.metadata.expert_name,
        body.metadata.has_defects || 0
      );

      const caseId = caseRes.lastInsertRowid;
      const insertResult = db.prepare(`
        INSERT INTO qc_results (case_id, item_id, problem_id, custom_content)
        VALUES (?, ?, ?, ?)
      `);

      for (const item of body.details) {
        for (const prob of item.selected_problems) {
          insertResult.run(caseId, item.item_id, prob.problem_id, prob.custom_text || null);
        }
      }

      return caseId;
    });

    try {
      const caseId = transaction();
      res.json({ success: true, caseId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save record" });
    }
  });

  app.get("/api/stats/hospitals", (req, res) => {
    const stats = db.prepare(`
      SELECT hospital_name, COUNT(*) as count 
      FROM qc_cases 
      GROUP BY hospital_name
      ORDER BY count DESC
    `).all();
    res.json(stats);
  });

  app.get("/api/export", (req, res) => {
    const data = db.prepare(`
      SELECT 
        c.hospital_name, c.medical_record_no, 
        CASE c.patient_status 
          WHEN 1 THEN '死亡' 
          WHEN 2 THEN '非医嘱离院' 
          WHEN 3 THEN '常规出院' 
          ELSE '' 
        END as patient_status_text,
        c.death_reason,
        CASE c.surgery_level 
          WHEN 1 THEN '四级手术' 
          WHEN 2 THEN '其他级别' 
          WHEN 3 THEN '非手术' 
          ELSE '' 
        END as surgery_level_text,
        c.main_diagnosis, c.main_surgery, c.main_operation,
        c.expert_name, 
        CASE c.has_defects WHEN 1 THEN '有缺陷' ELSE '无缺陷' END as has_defects_text,
        c.created_at,
        i.item_name, p.problem_desc, r.custom_content
      FROM qc_cases c
      LEFT JOIN qc_results r ON c.id = r.case_id
      LEFT JOIN qc_items i ON r.item_id = i.id
      LEFT JOIN qc_standard_problems p ON r.problem_id = p.id
      ORDER BY c.id DESC, i.id ASC
    `).all();

    const headers = [
      "医院名称", "病历号", "离院状态", "死亡原因", "手术级别", 
      "主要诊断", "主要手术", "主要操作", "质控专家", "是否有缺陷", 
      "填报时间", "质控项目", "缺陷内容", "自定义备注"
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(",")];
    for (const row of data as any[]) {
      const values = [
        row.hospital_name, row.medical_record_no, row.patient_status_text, row.death_reason,
        row.surgery_level_text, row.main_diagnosis, row.main_surgery, row.main_operation,
        row.expert_name, row.has_defects_text, row.created_at,
        row.item_name, row.problem_desc, row.custom_content
      ].map(escapeCSV);
      csvRows.push(values.join(","));
    }

    const csvContent = "\ufeff" + csvRows.join("\n"); // Add BOM for Excel UTF-8 support
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=qc_export.csv");
    res.send(csvContent);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
