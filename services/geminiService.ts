
import { GoogleGenAI, Type } from "@google/genai";
import { PatentCase, AuditResult } from "../types";

const SYSTEM_INSTRUCTION = `# SYSTEM ROLE
You are an expert AI Patent Auditor specializing in technical delta analysis. Your goal is to determine if an AI tool ("IPauthor") successfully extracted the winning technical concept from a patent's description.

# MANDATORY WORKFLOW
1.  **Technical Delta Analysis**: Compare Original vs. Granted Claims. Identify the *specific* phrase or limitation that was added.
2.  **Evidence Search**: Locate this winning limitation in the Specification. Note the context (e.g., paragraph number or technical section).
3.  **Strategy Matching**: Audit all provided IPauthor strategies. Look for semantic matches, technical synonyms, or direct paragraph references.
4.  **Retrieval Success Mapping**: Rate how well the tool performed at finding the correct "needle" in the specification "haystack".

# SCORING ENGINE
- **100 (Direct Hit)**: IPauthor suggested the exact winning limitation or referenced the exact spec paragraph.
- **85 (Strategic Hit)**: IPauthor suggested the correct technical feature but used different wording.
- **70 (Proximate Hit)**: IPauthor suggested a limitation closely related to the winning one.
- **Below 70**: The tool missed the winning concept.

# OUTPUT
You must return a structured JSON response reflecting this detailed audit.`;

export async function auditSingleCase(caseData: PatentCase): Promise<AuditResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
# AUDIT DATA

APP NUMBER: ${caseData.appNumber}

1. ORIGINAL CLAIMS:
${caseData.originalClaims}

2. GRANTED CLAIMS (Ground Truth):
${caseData.grantedClaims}

3. OFFICE ACTION SUMMARY:
${caseData.officeActionSummary}

4. IPAUTHOR STRATEGIES (Evaluation Subject):
${caseData.generatedStrategies}

5. APPLICATION SPECIFICATION:
${caseData.specification}

# TASK
Perform the Delta Audit. Extract the technical delta, find its source in the spec, and evaluate if IPauthor found it.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          evaluation_result: {
            type: Type.OBJECT,
            properties: {
              winning_amendment: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  source_type: { type: Type.STRING },
                  source_details: { type: Type.STRING },
                  technical_delta: { type: Type.STRING, description: "The exact technical limitation added to the claims" },
                  evidence_link: { type: Type.STRING, description: "Specific paragraph or section in the spec where this delta originated" }
                },
                required: ["summary", "source_type", "source_details", "technical_delta", "evidence_link"]
              },
              strategy_evaluation: {
                type: Type.OBJECT,
                properties: {
                  best_matching_strategy_name: { type: Type.STRING },
                  prediction_accuracy: { type: Type.STRING },
                  match_analysis: { type: Type.STRING },
                  retrieval_success_rate: { type: Type.NUMBER }
                },
                required: ["best_matching_strategy_name", "prediction_accuracy", "match_analysis", "retrieval_success_rate"]
              },
              final_score: { type: Type.NUMBER },
              auditor_reasoning: { type: Type.STRING }
            },
            required: ["winning_amendment", "strategy_evaluation", "final_score", "auditor_reasoning"]
          }
        },
        required: ["evaluation_result"]
      }
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  const result = parsed.evaluation_result;
  const avoided = (result?.final_score || 0) >= 70;
  
  return {
    appNumber: caseData.appNumber,
    evaluation_result: result,
    roi_metrics: {
      cost_saved: avoided ? 4500 : 0,
      hours_saved: avoided ? 15 : 0,
      avoided_second_oa: avoided
    }
  };
}
