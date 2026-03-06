#!/usr/bin/env node

/**
 * Test Execution Script for Task 27
 * 
 * This script runs all tests (property, unit, integration) and generates
 * a comprehensive report of the results.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log('\n' + '='.repeat(80), 'cyan');
  log(title, 'bright');
  log('='.repeat(80), 'cyan');
}

function runCommand(command, description) {
  log(`\n${description}...`, 'blue');
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: __dirname,
    });
    log('✓ Success', 'green');
    return { success: true, output };
  } catch (error) {
    log('✗ Failed', 'red');
    return { success: false, output: error.stdout || error.stderr || error.message };
  }
}

function parseJestOutput(output) {
  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    totalSuites: 0,
    passedSuites: 0,
    failedSuites: 0,
    coverage: null,
  };

  // Parse test counts
  const testMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (testMatch) {
    results.passedTests = parseInt(testMatch[1]);
    results.totalTests = parseInt(testMatch[2]);
    results.failedTests = results.totalTests - results.passedTests;
  }

  // Parse suite counts
  const suiteMatch = output.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (suiteMatch) {
    results.passedSuites = parseInt(suiteMatch[1]);
    results.totalSuites = parseInt(suiteMatch[2]);
    results.failedSuites = results.totalSuites - results.passedSuites;
  }

  // Parse coverage
  const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
  if (coverageMatch) {
    results.coverage = {
      statements: parseFloat(coverageMatch[1]),
      branches: parseFloat(coverageMatch[2]),
      functions: parseFloat(coverageMatch[3]),
      lines: parseFloat(coverageMatch[4]),
    };
  }

  return results;
}

function generateReport(results) {
  const timestamp = new Date().toISOString();
  
  let report = `# Test Execution Report - Task 27\n\n`;
  report += `**Generated:** ${timestamp}\n\n`;
  report += `## Summary\n\n`;

  // Overall status
  const allPassed = results.property.success && results.unit.success && results.integration.success;
  report += `**Overall Status:** ${allPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  // Property Tests
  report += `### Task 27.1: Property Tests\n\n`;
  report += `- **Status:** ${results.property.success ? '✅ PASSED' : '❌ FAILED'}\n`;
  if (results.property.parsed) {
    report += `- **Test Suites:** ${results.property.parsed.passedSuites}/${results.property.parsed.totalSuites} passed\n`;
    report += `- **Tests:** ${results.property.parsed.passedTests}/${results.property.parsed.totalTests} passed\n`;
    if (results.property.parsed.failedTests > 0) {
      report += `- **Failed Tests:** ${results.property.parsed.failedTests}\n`;
    }
  }
  report += `\n`;

  // Unit Tests
  report += `### Task 27.2: Unit Tests\n\n`;
  report += `- **Status:** ${results.unit.success ? '✅ PASSED' : '❌ FAILED'}\n`;
  if (results.unit.parsed) {
    report += `- **Test Suites:** ${results.unit.parsed.passedSuites}/${results.unit.parsed.totalSuites} passed\n`;
    report += `- **Tests:** ${results.unit.parsed.passedTests}/${results.unit.parsed.totalTests} passed\n`;
    if (results.unit.parsed.failedTests > 0) {
      report += `- **Failed Tests:** ${results.unit.parsed.failedTests}\n`;
    }
    if (results.unit.parsed.coverage) {
      const cov = results.unit.parsed.coverage;
      report += `\n**Code Coverage:**\n`;
      report += `- Statements: ${cov.statements}%\n`;
      report += `- Branches: ${cov.branches}%\n`;
      report += `- Functions: ${cov.functions}%\n`;
      report += `- Lines: ${cov.lines}%\n`;
      
      const meetsThreshold = cov.statements >= 80 && cov.branches >= 80 && 
                            cov.functions >= 80 && cov.lines >= 80;
      report += `\n**Coverage Threshold (80%):** ${meetsThreshold ? '✅ MET' : '❌ NOT MET'}\n`;
    }
  }
  report += `\n`;

  // Integration Tests
  report += `### Task 27.3: Integration Tests\n\n`;
  report += `- **Status:** ${results.integration.success ? '✅ PASSED' : '❌ FAILED'}\n`;
  if (results.integration.parsed) {
    report += `- **Test Suites:** ${results.integration.parsed.passedSuites}/${results.integration.parsed.totalSuites} passed\n`;
    report += `- **Tests:** ${results.integration.parsed.passedTests}/${results.integration.parsed.totalTests} passed\n`;
    if (results.integration.parsed.failedTests > 0) {
      report += `- **Failed Tests:** ${results.integration.parsed.failedTests}\n`;
    }
  }
  report += `\n`;

  // Manual Testing
  report += `### Task 27.4: Manual Testing\n\n`;
  report += `Manual testing checklist is available in TEST_EXECUTION_GUIDE.md\n\n`;
  report += `Please complete the manual testing checklist and document results.\n\n`;

  // Next Steps
  report += `## Next Steps\n\n`;
  if (allPassed) {
    report += `✅ All automated tests passed!\n\n`;
    report += `1. Complete manual testing checklist (Task 27.4)\n`;
    report += `2. Document any issues found during manual testing\n`;
    report += `3. Fix any failing tests or bugs\n`;
    report += `4. Proceed to Task 28 (Documentation)\n`;
  } else {
    report += `❌ Some tests failed. Please:\n\n`;
    report += `1. Review test output above for failure details\n`;
    report += `2. Fix failing tests\n`;
    report += `3. Re-run this script\n`;
    report += `4. Complete manual testing once all automated tests pass\n`;
  }

  return report;
}

async function main() {
  section('Task 27: Testing and Quality Assurance');
  log('Running comprehensive test suite...\n');

  const results = {
    property: { success: false, output: '', parsed: null },
    unit: { success: false, output: '', parsed: null },
    integration: { success: false, output: '', parsed: null },
  };

  // Task 27.1: Property Tests
  section('Task 27.1: Running Property Tests (45 properties, 100+ iterations each)');
  const propertyResult = runCommand('npm run test:property', 'Executing property tests');
  results.property = propertyResult;
  results.property.parsed = parseJestOutput(propertyResult.output);
  
  if (propertyResult.success) {
    log(`\n✓ All property tests passed!`, 'green');
    log(`  Test Suites: ${results.property.parsed.passedSuites}/${results.property.parsed.totalSuites}`, 'green');
    log(`  Tests: ${results.property.parsed.passedTests}/${results.property.parsed.totalTests}`, 'green');
  } else {
    log(`\n✗ Property tests failed!`, 'red');
    log(`  Failed Suites: ${results.property.parsed.failedSuites}`, 'red');
    log(`  Failed Tests: ${results.property.parsed.failedTests}`, 'red');
  }

  // Task 27.2: Unit Tests
  section('Task 27.2: Running Unit Tests (with coverage)');
  const unitResult = runCommand('npm run test:unit -- --coverage', 'Executing unit tests');
  results.unit = unitResult;
  results.unit.parsed = parseJestOutput(unitResult.output);
  
  if (unitResult.success) {
    log(`\n✓ All unit tests passed!`, 'green');
    log(`  Test Suites: ${results.unit.parsed.passedSuites}/${results.unit.parsed.totalSuites}`, 'green');
    log(`  Tests: ${results.unit.parsed.passedTests}/${results.unit.parsed.totalTests}`, 'green');
    
    if (results.unit.parsed.coverage) {
      const cov = results.unit.parsed.coverage;
      log(`\n  Code Coverage:`, 'cyan');
      log(`    Statements: ${cov.statements}%`, cov.statements >= 80 ? 'green' : 'yellow');
      log(`    Branches: ${cov.branches}%`, cov.branches >= 80 ? 'green' : 'yellow');
      log(`    Functions: ${cov.functions}%`, cov.functions >= 80 ? 'green' : 'yellow');
      log(`    Lines: ${cov.lines}%`, cov.lines >= 80 ? 'green' : 'yellow');
    }
  } else {
    log(`\n✗ Unit tests failed!`, 'red');
    log(`  Failed Suites: ${results.unit.parsed.failedSuites}`, 'red');
    log(`  Failed Tests: ${results.unit.parsed.failedTests}`, 'red');
  }

  // Task 27.3: Integration Tests
  section('Task 27.3: Running Integration Tests');
  const integrationResult = runCommand('npm run test:integration', 'Executing integration tests');
  results.integration = integrationResult;
  results.integration.parsed = parseJestOutput(integrationResult.output);
  
  if (integrationResult.success) {
    log(`\n✓ All integration tests passed!`, 'green');
    log(`  Test Suites: ${results.integration.parsed.passedSuites}/${results.integration.parsed.totalSuites}`, 'green');
    log(`  Tests: ${results.integration.parsed.passedTests}/${results.integration.parsed.totalTests}`, 'green');
  } else {
    log(`\n✗ Integration tests failed!`, 'red');
    log(`  Failed Suites: ${results.integration.parsed.failedSuites}`, 'red');
    log(`  Failed Tests: ${results.integration.parsed.failedTests}`, 'red');
  }

  // Generate Report
  section('Generating Test Report');
  const report = generateReport(results);
  const reportPath = path.join(__dirname, 'CHECKPOINT_27_RESULTS.md');
  fs.writeFileSync(reportPath, report);
  log(`\n✓ Report saved to: ${reportPath}`, 'green');

  // Display Summary
  section('Test Execution Summary');
  const allPassed = results.property.success && results.unit.success && results.integration.success;
  
  if (allPassed) {
    log('\n🎉 All automated tests passed!', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Complete manual testing (Task 27.4)', 'yellow');
    log('2. Review CHECKPOINT_27_RESULTS.md', 'yellow');
    log('3. Proceed to Task 28 (Documentation)', 'yellow');
  } else {
    log('\n⚠️  Some tests failed. Please review the output above.', 'red');
    log('\nNext steps:', 'cyan');
    log('1. Review test failures', 'yellow');
    log('2. Fix failing tests', 'yellow');
    log('3. Re-run this script', 'yellow');
  }

  log('\n');
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  log(`\n✗ Error running tests: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
