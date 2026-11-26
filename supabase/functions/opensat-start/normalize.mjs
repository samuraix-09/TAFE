const domains = {
  english: new Set(["Information and Ideas", "Craft and Structure", "Expression of Ideas", "Standard English Conventions"]),
  math: new Set(["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"]),
};
export function normalizeBank(raw, section) {
  if (!Array.isArray(raw)) throw Error("Invalid OpenSAT response");
  const seen = new Set();
  return raw.flatMap((item) => {
    const q = item?.question;
    if (!domains[section].has(item?.domain) || typeof item.id !== "string" ||
        !["Easy","Medium","Hard"].includes(item.difficulty) ||
        typeof q?.question !== "string" || !q.question.trim() || q.question.length > 15000 ||
        !["A","B","C","D"].includes(q.correct_answer)) return [];
    const options = ["A","B","C","D"].map((key) => typeof q.choices?.[key] === "string" ? q.choices[key].trim() : null);
    if (options.some((value) => !value || value.length > 8000) || new Set(options).size !== 4) return [];
    const paragraph = typeof q.paragraph === "string" && q.paragraph !== "null" ? q.paragraph.slice(0, 18000).trim() : "";
    const visual = item.visuals ?? q.visuals;
    const svg = typeof visual?.svg_content === "string" && /^\s*<svg[\s>]/i.test(visual.svg_content) && visual.svg_content.length < 120000
      ? visual.svg_content : null;
    const fingerprint = (q.question + "\n" + paragraph + "\n" + [...options].sort().join("\n")).replace(/\s+/g," ").trim().toLowerCase();
    if (seen.has(fingerprint) || seen.has(item.id)) return [];
    seen.add(fingerprint);
    seen.add(item.id);
    return [{
      prompt:q.question, options, answer:options[q.correct_answer.charCodeAt(0)-65],
      explanation:typeof q.explanation === "string" ? q.explanation.slice(0,18000) : "",
      difficulty:item.difficulty, group_name:item.domain, type:"multiple_choice", required:true, points:1,
      config:{opensat:true,sat_topic:item.domain, passage:paragraph, ...(svg ? {svg} : {})}
    }];
  });
}
