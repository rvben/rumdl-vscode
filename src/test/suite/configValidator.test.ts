import { 
  expect, 
  beforeEachTest, 
  afterEachTest,
  createTestDocument 
} from '../helper';
import { ConfigValidator } from '../../configValidator';

describe('ConfigValidator', () => {
  let vscodeContext: ReturnType<typeof beforeEachTest>;
  
  beforeEach(() => {
    vscodeContext = beforeEachTest();
  });
  
  afterEach(() => {
    afterEachTest();
  });
  
  describe('validateToml', () => {
    it('should validate valid TOML configuration', () => {
      const validToml = `
[rules]
select = ["MD001", "MD002"]
ignore = ["MD003"]

[rules.MD013]
line_length = 100
code_blocks = false
      `;
      
      const result = ConfigValidator.validateToml(validToml);
      
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should detect TOML syntax errors', () => {
      const invalidToml = `
[rules
select = ["MD001"]
      `;
      
      const result = ConfigValidator.validateToml(invalidToml);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0].message).to.include('TOML syntax error');
      expect(result.errors[0].line).to.equal(2);
    });
    
    it('should validate rule names', () => {
      const invalidRules = `
[rules]
select = ["MD001", "INVALID_RULE", "MD999"]
      `;
      
      const result = ConfigValidator.validateToml(invalidRules);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(2);
      expect(result.errors[0].message).to.include('Unknown rule: INVALID_RULE');
      expect(result.errors[1].message).to.include('Unknown rule: MD999');
    });
    
    it('should validate rule configuration types', () => {
      const invalidTypes = `
[rules.MD013]
line_length = "not a number"
code_blocks = "not a boolean"
      `;
      
      const result = ConfigValidator.validateToml(invalidTypes);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(2);
      expect(result.errors[0].message).to.include('Expected number');
      expect(result.errors[1].message).to.include('Expected boolean');
    });
    
    it('should validate required fields', () => {
      const missingRequired = `
[rules.MD043]
# missing required 'headings' field
      `;
      
      const result = ConfigValidator.validateToml(missingRequired);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0].message).to.include('Missing required field: headings');
    });
    
    it('should validate enum values', () => {
      const invalidEnum = `
[rules.MD003]
style = "invalid_style"
      `;
      
      const result = ConfigValidator.validateToml(invalidEnum);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0].message).to.include('Invalid value');
      expect(result.errors[0].message).to.include('consistent, atx, atx_closed, setext, setext_with_atx, setext_with_atx_closed');
    });
    
    it('should handle empty configuration', () => {
      const result = ConfigValidator.validateToml('');
      
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should handle comments and whitespace', () => {
      const configWithComments = `
# This is a comment
[rules]
select = ["MD001"] # inline comment

  # Another comment
  [rules.MD013]
  line_length = 80
      `;
      
      const result = ConfigValidator.validateToml(configWithComments);
      
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should validate array types', () => {
      const invalidArray = `
[rules]
select = "MD001"  # should be an array
      `;
      
      const result = ConfigValidator.validateToml(invalidArray);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0].message).to.include('Expected array');
    });
    
    it('should validate nested configurations', () => {
      const nestedConfig = `
[rules.MD024]
siblings_only = true
allow_different_nesting = false

[rules.MD026]
punctuation = ".,;:!?"

[rules.MD044]
names = ["JavaScript", "GitHub"]
code_blocks = false
html_elements = true
      `;
      
      const result = ConfigValidator.validateToml(nestedConfig);
      
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });
    
    it('should detect unknown configuration keys', () => {
      const unknownKeys = `
[rules.MD013]
line_length = 80
unknown_key = true
another_unknown = "value"
      `;
      
      const result = ConfigValidator.validateToml(unknownKeys);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(2);
      expect(result.errors[0].message).to.include('Unknown configuration: unknown_key');
      expect(result.errors[1].message).to.include('Unknown configuration: another_unknown');
    });
    
    it('should validate number ranges', () => {
      const outOfRange = `
[rules.MD013]
line_length = -1

[rules.MD007]
indent = 0
      `;
      
      const result = ConfigValidator.validateToml(outOfRange);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(2);
      expect(result.errors[0].message).to.include('Value must be positive');
      expect(result.errors[1].message).to.include('Value must be greater than 0');
    });
  });
  
  describe('getQuickFixes', () => {
    it('should provide quick fixes for unknown rules', () => {
      const doc = createTestDocument(`
[rules]
select = ["MD0001"]
      `, 'rumdl.toml');
      
      const diagnostic = new vscodeContext.vscode.Diagnostic(
        new vscodeContext.vscode.Range(
          new vscodeContext.vscode.Position(2, 11),
          new vscodeContext.vscode.Position(2, 17)
        ),
        "Unknown rule 'MD0001'. Did you mean 'MD001'?",
        vscodeContext.vscode.DiagnosticSeverity.Error
      );
      
      const fixes = ConfigValidator.getQuickFixes(doc as any, diagnostic);
      
      expect(fixes).to.have.lengthOf(1);
      expect(fixes[0].title).to.equal("Change to 'MD001'");
      expect(fixes[0].edit).to.exist;
    });
    
    it('should provide type conversion fixes', () => {
      const doc = createTestDocument(`
[rules.MD013]
code_blocks = "false"
      `, 'rumdl.toml');
      
      const diagnostic = new vscodeContext.vscode.Diagnostic(
        new vscodeContext.vscode.Range(
          new vscodeContext.vscode.Position(2, 14),
          new vscodeContext.vscode.Position(2, 21)
        ),
        "Expected boolean value, got string",
        vscodeContext.vscode.DiagnosticSeverity.Error
      );
      
      const fixes = ConfigValidator.getQuickFixes(doc as any, diagnostic);
      
      expect(fixes).to.have.lengthOf(2);
      expect(fixes[0].title).to.equal('Change to: true');
      expect(fixes[1].title).to.equal('Change to: false');
    });
    
    it('should provide enum value suggestions', () => {
      const doc = createTestDocument(`
[rules.MD003]
style = "invalid"
      `, 'rumdl.toml');
      
      const diagnostic = new vscodeContext.vscode.Diagnostic(
        new vscodeContext.vscode.Range(
          new vscodeContext.vscode.Position(2, 8),
          new vscodeContext.vscode.Position(2, 17)
        ),
        "Invalid value. Expected one of: consistent, atx, atx_closed, setext, setext_with_atx, setext_with_atx_closed",
        vscodeContext.vscode.DiagnosticSeverity.Error
      );
      
      const fixes = ConfigValidator.getQuickFixes(doc as any, diagnostic);
      
      expect(fixes).to.have.lengthOf.at.least(3);
      expect(fixes[0].title).to.include('consistent');
    });
    
    it('should not provide fixes for generic errors', () => {
      const doc = createTestDocument(`invalid toml`, 'rumdl.toml');
      
      const diagnostic = new vscodeContext.vscode.Diagnostic(
        new vscodeContext.vscode.Range(
          new vscodeContext.vscode.Position(0, 0),
          new vscodeContext.vscode.Position(0, 12)
        ),
        "TOML syntax error",
        vscodeContext.vscode.DiagnosticSeverity.Error
      );
      
      const fixes = ConfigValidator.getQuickFixes(doc as any, diagnostic);
      
      expect(fixes).to.be.empty;
    });
  });
});