#!/usr/bin/env node
/*
Usage:
  node scripts/csv-to-questionnaire-json.js \
    --file "D:/mini_project_asd/m_chat.csv" \
    --name MCHAT \
    --fullName "Modified Checklist for Autism in Toddlers" \
    --answerOptions "Yes,No" \
    --duration "5-10 minutes" \
    --ageRange "16-30 months" \
    > mchat.json

For TABC with numeric-coded options in CSV header (0 Never,1 Sometimes,...), you can omit --answerOptions and the script will infer from the CSV row.
*/

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

(async function main() {
  const args = parseArgs(process.argv);
  const file = args.file || args.f;
  if (!file) {
    console.error('Error: --file is required');
    process.exit(1);
  }
  const name = args.name || 'QUESTIONNAIRE';
  const fullName = args.fullName || name;
  const duration = args.duration || '';
  const ageRange = args.ageRange || '';
  const answerOptionsArg = args.answerOptions || '';

  const records = [];
  const parser = fs.createReadStream(path.resolve(file))
    .pipe(parse({
      columns: false,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    }));

  for await (const row of parser) {
    records.push(row);
  }

  // Infer structure per known formats
  // Case 1: M-CHAT (header: "Question","Option 1","Option 2")
  // Case 2: AQ_child (header: "Question","Option 1","Option 2","Option 3","Option 4")
  // Case 3: TABC (first two rows are section headers, then question rows start with numeric Serial No.)

  // Try to find the first row with a question-like string
  let startIndex = 0;
  // If first row looks like TABC header, skip until row where first cell includes a digit or the word "Question"
  for (let i = 0; i < records.length; i++) {
    const r0 = (records[i][0] || '').toString();
    if (/^\d+\.?/.test(r0) || /question/i.test(r0)) { startIndex = i; break; }
  }

  const header = records[startIndex];

  let optionsFromCsv = [];
  // If header contains columns like Option 1, Option 2..., next rows are questions
  if (header.some(h => /option/i.test(h))) {
    // If user passed answerOptions, use that; otherwise derive from the first data row
    if (answerOptionsArg) {
      optionsFromCsv = answerOptionsArg.split(',').map(s => s.trim());
    } else {
      // Try next row for options; otherwise infer from header length
      const dataRow = records[startIndex + 1] || [];
      // Options start from column index 1 usually (after Question)
      const optStart = 1;
      optionsFromCsv = dataRow.slice(optStart).filter(Boolean);
      if (optionsFromCsv.length === 0) {
        // fallback: build generic options based on number of option columns in header
        const optCols = header.filter(h => /option/i.test(h)).length;
        optionsFromCsv = Array.from({ length: optCols }, (_, i) => `Option ${i + 1}`);
      }
    }
  }

  const questions = [];
  // Iterate data rows after header and build question list
  for (let i = startIndex + 1; i < records.length; i++) {
    const row = records[i];
    if (!row || row.length === 0) continue;

    // Support different formats
    // Format A (M-CHAT / AQ): [Question, Option1, Option2, ...]
    // Format B (TABC): [Serial No., Section, Question, Option1, Option2, Option3, Option4]
    let questionText = '';
    if (row.length >= 2 && /option/i.test(header[1] || '')) {
      questionText = (row[0] || '').toString();
    } else if (row.length >= 3 && /^\d+/.test(row[0] || '')) {
      // TABC row with serial no, section, question
      questionText = (row[2] || '').toString();
      // If optionsFromCsv empty, take from this row
      if (optionsFromCsv.length === 0) {
        optionsFromCsv = row.slice(3).filter(Boolean);
      }
    } else {
      // Fallback: try first column as question
      questionText = (row[0] || '').toString();
    }

    if (!questionText || /Section/i.test(questionText)) continue;

    questions.push({ text: questionText, order: questions.length });
  }

  const out = {
    name,
    fullName,
    description: '',
    questions,
    answerOptions: optionsFromCsv.length > 0 ? optionsFromCsv : (answerOptionsArg ? answerOptionsArg.split(',').map(s => s.trim()) : ["yes","no"]),
    scoringRules: [],
    scoringInfo: '',
    duration,
    ageRange,
    isActive: true,
  };

  process.stdout.write(JSON.stringify(out, null, 2));
})();
