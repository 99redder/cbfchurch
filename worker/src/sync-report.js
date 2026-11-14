// Email for the weekly page-text sync report.
//
// The GitHub Action .github/workflows/sync-editable-content.yml copies
// admin-edited History/Beliefs text into the HTML every Monday, then POSTs its
// result to /api/internal/sync-report, and the Worker emails it (see index.js).

const REPO_URL = 'https://github.com/99redder/cbfchurch/';
const OUTCOMES = new Set(['success', 'failure', 'cancelled']);

// Validate the Action's JSON and return a clean report, or null if it's malformed.
export function parseSyncReport(body) {
  if (!body || typeof body !== 'object') return null;
  const outcome = String(body.outcome || '').toLowerCase();
  if (!OUTCOMES.has(outcome)) return null;
  const onlyRepoUrl = v => {
    const s = String(v || '');
    return s.startsWith(REPO_URL) ? s.slice(0, 300) : '';
  };
  return {
    outcome,
    changed: body.changed === true,
    summary: String(body.summary || '').slice(0, 4000).trim(),
    runUrl: onlyRepoUrl(body.runUrl),
    commitUrl: onlyRepoUrl(body.commitUrl)
  };
}

export function buildSyncReportEmail(report) {
  const ok = report.outcome === 'success';
  let subject;
  let resultLine;
  let changesLine;
  if (!ok) {
    subject = `CBF website weekly sync: ${report.outcome === 'cancelled' ? 'CANCELLED' : 'FAILED'}`;
    resultLine = report.outcome === 'cancelled' ? 'Cancelled before it finished' : 'FAILED';
    changesLine = report.changed
      ? 'Yes, changes were published before the problem happened (see the commit link).'
      : 'None published. Open the run log below to see what went wrong.';
  } else if (report.changed) {
    subject = 'CBF website weekly sync: page text updated';
    resultLine = 'Succeeded';
    changesLine = 'Yes. Admin edits were copied into the HTML and the site was republished.';
  } else {
    subject = 'CBF website weekly sync: ran OK, no changes';
    resultLine = 'Succeeded';
    changesLine = 'No. The History and Beliefs pages already matched the saved text.';
  }

  const text = [
    'Weekly page-text sync for www.cbfchurch.com',
    '(copies admin edits on the History and Beliefs pages into the HTML)',
    '',
    `Result: ${resultLine}`,
    `Changes: ${changesLine}`,
    '',
    'Details:',
    report.summary || '(no output)',
    '',
    report.runUrl ? `Run log: ${report.runUrl}` : '',
    report.commitUrl ? `Commit: ${report.commitUrl}` : ''
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n').trim();

  return { subject, text };
}
