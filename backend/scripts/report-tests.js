const fs = require('fs');

const reportPath = process.argv[2] || 'test-results.json';

if (!fs.existsSync(reportPath)) {
  console.error(`Report file not found: ${reportPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const results = [];

for (const suite of data.testResults || []) {
  for (const test of suite.assertionResults || []) {
    const name = test.fullName
      ? test.fullName
      : [...(test.ancestorTitles || []), test.title].join(' > ');
    results.push({ status: test.status, name });
  }
}

const counts = {
  passed: 0,
  failed: 0,
  pending: 0,
  skipped: 0,
  todo: 0,
  total: results.length,
};

console.log('Test results:');
for (const result of results) {
  const status = result.status.toUpperCase();
  console.log(`${status} ${result.name}`);
  if (result.status === 'passed') counts.passed += 1;
  else if (result.status === 'failed') counts.failed += 1;
  else if (result.status === 'pending') counts.pending += 1;
  else if (result.status === 'skipped') counts.skipped += 1;
  else if (result.status === 'todo') counts.todo += 1;
}

console.log(
  `Summary: total=${counts.total} passed=${counts.passed} failed=${counts.failed} pending=${counts.pending} skipped=${counts.skipped} todo=${counts.todo}`,
);
