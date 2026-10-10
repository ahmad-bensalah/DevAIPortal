import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * lint-adrs.ts
 *
 * Enforces Staff-Engineer ADR quality standards across all docs/adr/NNN-*.md files.
 *
 * Required sections:
 * 1. Title format: # ADR-NNN: <Short statement>
 * 2. Status: Proposed | Accepted | Superseded by ADR-XXX
 * 3. Date: YYYY-MM-DD
 * 4. Deciders
 * 5. Related ADRs
 * 6. ## Context (min 3 lines)
 * 7. ## Decision (action-oriented statement)
 * 8. ## Alternatives Considered (min 3 alternatives, each with concrete rejection rationale)
 * 9. ## Consequences (must contain Positive, Negative (at least 2), and Mitigations)
 * 10. ## Verification (concrete command, workflow or script path)
 * 11. ## Open Questions / Revisit Triggers
 */

interface LintError {
  file: string;
  error: string;
}

export function lintAdrs(adrDir: string): LintError[] {
  const errors: LintError[] = [];
  const files = readdirSync(adrDir).filter(f => /^0\d\d-.*\.md$/.test(f));

  if (files.length === 0) {
    errors.push({ file: adrDir, error: 'No ADR files matching pattern 0NN-*.md found' });
    return errors;
  }

  for (const file of files) {
    const fullPath = join(adrDir, file);
    const content = readFileSync(fullPath, 'utf-8');

    // 1. Title format check
    const titleMatch = content.match(/^# ADR-(\d{3}):\s*(.+)$/m);
    if (!titleMatch) {
      errors.push({ file, error: 'Missing or malformed title. Expected format: "# ADR-NNN: <Statement>"' });
    }

    // 2. Metadata: Status
    const statusMatch = content.match(/[-*]\s+\*\*Status\*\*:\s*(Proposed|Accepted|Superseded by ADR-\d{3})/i);
    if (!statusMatch) {
      errors.push({ file, error: 'Missing or invalid Status metadata (must be Proposed | Accepted | Superseded by ADR-XXX)' });
    }

    // 3. Metadata: Date
    const dateMatch = content.match(/[-*]\s+\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) {
      errors.push({ file, error: 'Missing or invalid Date metadata (format: YYYY-MM-DD)' });
    }

    // 4. Metadata: Deciders
    if (!content.match(/[-*]\s+\*\*Deciders\*\*:/i)) {
      errors.push({ file, error: 'Missing Deciders metadata' });
    }

    // 5. Metadata: Related ADRs
    if (!content.match(/[-*]\s+\*\*Related ADRs\*\*:/i)) {
      errors.push({ file, error: 'Missing Related ADRs metadata' });
    }

    // 6. Section: Context
    if (!content.match(/## Context/i)) {
      errors.push({ file, error: 'Missing "## Context" heading' });
    }

    // 7. Section: Decision
    if (!content.match(/## Decision/i)) {
      errors.push({ file, error: 'Missing "## Decision" heading' });
    }

    // 8. Section: Alternatives Considered (min 3)
    if (!content.match(/## Alternatives Considered/i)) {
      errors.push({ file, error: 'Missing "## Alternatives Considered" heading' });
    } else {
      const parts = content.split(/^## Alternatives Considered/m);
      const afterSection = parts[1] || '';
      const altSection = afterSection.split(/^## /m)[0] || '';
      const altHeaders = altSection.match(/^###\s+[^\n]+/gm) || [];
      const altNumbered = altSection.match(/^\d+\.\s+\*\*[^*]+\*\*/gm) || [];
      const totalAlts = Math.max(altHeaders.length, altNumbered.length);
      if (totalAlts < 3) {
        errors.push({
          file,
          error: `Alternatives Considered must contain at least 3 evaluated options (found ${totalAlts})`,
        });
      }
    }

    // 9. Section: Consequences with Negative and Mitigations
    if (!content.match(/## Consequences/i)) {
      errors.push({ file, error: 'Missing "## Consequences" heading' });
    } else {
      if (!content.match(/### Negative/i) && !content.match(/\*\*Negative\*\*/i)) {
        errors.push({ file, error: 'Consequences must contain a dedicated Negative section' });
      }
      if (!content.match(/### Mitigations/i) && !content.match(/\*\*Mitigations\*\*/i)) {
        errors.push({ file, error: 'Consequences must contain a dedicated Mitigations section' });
      }
    }

    // 10. Section: Verification with concrete command or artifact
    if (!content.match(/## Verification/i)) {
      errors.push({ file, error: 'Missing "## Verification" heading' });
    } else {
      const verSection = content.split(/## Verification/i)[1]?.split(/## /)[0] || '';
      if (!verSection.includes('`') && !verSection.includes('make') && !verSection.includes('vitest')) {
        errors.push({ file, error: 'Verification section must name executable commands or test paths' });
      }
    }

    // 11. Section: Open questions / revisit triggers
    if (!content.match(/## Open Questions.*Revisit Triggers/i)) {
      errors.push({ file, error: 'Missing "## Open Questions / Revisit Triggers" heading' });
    }
  }

  return errors;
}

// CLI Execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const adrPath = resolve(root, 'docs/adr');
  const errors = lintAdrs(adrPath);

  if (errors.length > 0) {
    console.error('✗ ADR Lint Failed:');
    for (const e of errors) {
      console.error(`  [${e.file}] ${e.error}`);
    }
    process.exit(1);
  } else {
    console.log('✓ All ADRs satisfy Staff-Engineer standards.');
    process.exit(0);
  }
}
