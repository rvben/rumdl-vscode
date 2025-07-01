/**
 * Schema definition for rumdl configuration files
 */

export interface RumdlConfig {
  rules?: RulesConfig;
  files?: FilesConfig;
  global?: GlobalConfig;
}

export interface RulesConfig {
  select?: string[];
  ignore?: string[];
  [ruleName: string]: unknown; // Rule-specific configuration
}

export interface FilesConfig {
  include?: string[];
  exclude?: string[];
}

export interface GlobalConfig {
  enable?: string[];
  disable?: string[];
  exclude?: string[];
  include?: string[];
  respect_gitignore?: boolean;
}

// Individual rule configurations
export interface MD003Config {
  style?: 'atx' | 'atx_closed' | 'setext' | 'setext_with_atx' | 'setext_with_atx_closed';
}

export interface MD004Config {
  style?: 'asterisk' | 'dash' | 'plus' | 'consistent' | 'sublist';
}

export interface MD007Config {
  indent?: number;
  start_indented?: boolean;
  start_indent?: number;
}

export interface MD009Config {
  br_spaces?: number;
  list_item_empty_lines?: boolean;
  strict?: boolean;
}

export interface MD010Config {
  code_blocks?: boolean;
  spaces_per_tab?: number;
}

export interface MD012Config {
  maximum?: number;
}

export interface MD013Config {
  line_length?: number;
  code_blocks?: boolean;
  tables?: boolean;
  headings?: boolean;
  strict?: boolean;
  stern?: boolean;
}

export interface MD022Config {
  lines_above?: number;
  lines_below?: number;
}

export interface MD024Config {
  siblings_only?: boolean;
}

export interface MD025Config {
  level?: number;
  front_matter_title?: string;
}

export interface MD026Config {
  punctuation?: string;
}

export interface MD029Config {
  style?: 'one' | 'ordered' | 'one_or_ordered' | 'zero';
}

export interface MD030Config {
  ul_single?: number;
  ol_single?: number;
  ul_multi?: number;
  ol_multi?: number;
}

export interface MD033Config {
  allowed_elements?: string[];
}

export interface MD035Config {
  style?: string;
}

export interface MD036Config {
  punctuation?: string;
}

export interface MD044Config {
  names?: string[];
  code_blocks?: boolean;
  html_elements?: boolean;
}

export interface MD046Config {
  style?: 'consistent' | 'fenced' | 'indented';
}

export interface MD048Config {
  style?: 'consistent' | 'backtick' | 'tilde';
}

export interface MD049Config {
  style?: 'consistent' | 'asterisk' | 'underscore';
}

export interface MD050Config {
  style?: 'consistent' | 'asterisk' | 'underscore';
}

// Complete schema with all rules
export const RULE_SCHEMAS: Record<string, object> = {
  MD001: { type: 'object', properties: {} },
  MD002: {
    type: 'object',
    properties: {
      level: { type: 'number', minimum: 1, maximum: 6 },
    },
  },
  MD003: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['atx', 'atx_closed', 'setext', 'setext_with_atx', 'setext_with_atx_closed'],
      },
    },
  },
  MD004: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['asterisk', 'dash', 'plus', 'consistent', 'sublist'],
      },
    },
  },
  MD005: { type: 'object', properties: {} },
  MD006: { type: 'object', properties: {} },
  MD007: {
    type: 'object',
    properties: {
      indent: { type: 'number', minimum: 1 },
      start_indented: { type: 'boolean' },
      start_indent: { type: 'number', minimum: 0 },
    },
  },
  MD009: {
    type: 'object',
    properties: {
      br_spaces: { type: 'number', minimum: 0 },
      list_item_empty_lines: { type: 'boolean' },
      strict: { type: 'boolean' },
    },
  },
  MD010: {
    type: 'object',
    properties: {
      code_blocks: { type: 'boolean' },
      spaces_per_tab: { type: 'number', minimum: 1 },
    },
  },
  MD011: { type: 'object', properties: {} },
  MD012: {
    type: 'object',
    properties: {
      maximum: { type: 'number', minimum: 1 },
    },
  },
  MD013: {
    type: 'object',
    properties: {
      line_length: { type: 'number', minimum: 1 },
      code_blocks: { type: 'boolean' },
      tables: { type: 'boolean' },
      headings: { type: 'boolean' },
      strict: { type: 'boolean' },
      stern: { type: 'boolean' },
    },
  },
  MD014: { type: 'object', properties: {} },
  MD018: { type: 'object', properties: {} },
  MD019: { type: 'object', properties: {} },
  MD020: { type: 'object', properties: {} },
  MD021: { type: 'object', properties: {} },
  MD022: {
    type: 'object',
    properties: {
      lines_above: { type: 'number', minimum: 0 },
      lines_below: { type: 'number', minimum: 0 },
    },
  },
  MD023: { type: 'object', properties: {} },
  MD024: {
    type: 'object',
    properties: {
      siblings_only: { type: 'boolean' },
    },
  },
  MD025: {
    type: 'object',
    properties: {
      level: { type: 'number', minimum: 1, maximum: 6 },
      front_matter_title: { type: 'string' },
    },
  },
  MD026: {
    type: 'object',
    properties: {
      punctuation: { type: 'string' },
    },
  },
  MD027: { type: 'object', properties: {} },
  MD028: { type: 'object', properties: {} },
  MD029: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['one', 'ordered', 'one_or_ordered', 'zero'],
      },
    },
  },
  MD030: {
    type: 'object',
    properties: {
      ul_single: { type: 'number', minimum: 0 },
      ol_single: { type: 'number', minimum: 0 },
      ul_multi: { type: 'number', minimum: 0 },
      ol_multi: { type: 'number', minimum: 0 },
    },
  },
  MD031: { type: 'object', properties: {} },
  MD032: { type: 'object', properties: {} },
  MD033: {
    type: 'object',
    properties: {
      allowed_elements: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  MD034: { type: 'object', properties: {} },
  MD035: {
    type: 'object',
    properties: {
      style: { type: 'string' },
    },
  },
  MD036: {
    type: 'object',
    properties: {
      punctuation: { type: 'string' },
    },
  },
  MD037: { type: 'object', properties: {} },
  MD038: { type: 'object', properties: {} },
  MD039: { type: 'object', properties: {} },
  MD040: { type: 'object', properties: {} },
  MD041: { type: 'object', properties: {} },
  MD042: { type: 'object', properties: {} },
  MD043: { type: 'object', properties: {} },
  MD044: {
    type: 'object',
    properties: {
      names: {
        type: 'array',
        items: { type: 'string' },
      },
      code_blocks: { type: 'boolean' },
      html_elements: { type: 'boolean' },
    },
  },
  MD045: { type: 'object', properties: {} },
  MD046: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['consistent', 'fenced', 'indented'],
      },
    },
  },
  MD047: { type: 'object', properties: {} },
  MD048: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['consistent', 'backtick', 'tilde'],
      },
    },
  },
  MD049: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['consistent', 'asterisk', 'underscore'],
      },
    },
  },
  MD050: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        enum: ['consistent', 'asterisk', 'underscore'],
      },
    },
  },
  MD051: { type: 'object', properties: {} },
  MD052: { type: 'object', properties: {} },
  MD053: { type: 'object', properties: {} },
  MD054: { type: 'object', properties: {} },
  MD055: { type: 'object', properties: {} },
  MD056: { type: 'object', properties: {} },
  MD057: { type: 'object', properties: {} },
  MD058: { type: 'object', properties: {} },
};

// List of all available rule names
export const RULE_NAMES = Object.keys(RULE_SCHEMAS);

// Rule descriptions for error messages
export const RULE_DESCRIPTIONS: Record<string, string> = {
  MD001: 'Heading levels should only increment by one level at a time',
  MD002: 'First heading should be a top level heading',
  MD003: 'Heading style',
  MD004: 'Unordered list style',
  MD005: 'Inconsistent indentation for list items at the same level',
  MD006: 'Consider starting bulleted lists at the beginning of the line',
  MD007: 'Unordered list indentation',
  MD009: 'Trailing spaces',
  MD010: 'Hard tabs',
  MD011: 'Reversed link syntax',
  MD012: 'Multiple consecutive blank lines',
  MD013: 'Line length',
  MD014: 'Dollar signs used before commands without showing output',
  MD018: 'No space after hash on atx style heading',
  MD019: 'Multiple spaces after hash on atx style heading',
  MD020: 'No space inside hashes on closed atx style heading',
  MD021: 'Multiple spaces inside hashes on closed atx style heading',
  MD022: 'Headings should be surrounded by blank lines',
  MD023: 'Headings must start at the beginning of the line',
  MD024: 'Multiple headings with the same content',
  MD025: 'Multiple top level headings in the same document',
  MD026: 'Trailing punctuation in heading',
  MD027: 'Multiple spaces after blockquote symbol',
  MD028: 'Blank line inside blockquote',
  MD029: 'Ordered list item prefix',
  MD030: 'Spaces after list markers',
  MD031: 'Fenced code blocks should be surrounded by blank lines',
  MD032: 'Lists should be surrounded by blank lines',
  MD033: 'Inline HTML',
  MD034: 'Bare URL used',
  MD035: 'Horizontal rule style',
  MD036: 'Emphasis used instead of a heading',
  MD037: 'Spaces inside emphasis markers',
  MD038: 'Spaces inside code span elements',
  MD039: 'Spaces inside link text',
  MD040: 'Fenced code blocks should have a language specified',
  MD041: 'First line in file should be a top level heading',
  MD042: 'No empty links',
  MD043: 'Required heading structure',
  MD044: 'Proper names should have the correct capitalization',
  MD045: 'Images should have alternate text (alt text)',
  MD046: 'Code block style',
  MD047: 'Files should end with a single newline character',
  MD048: 'Code fence style',
  MD049: 'Emphasis style',
  MD050: 'Strong style',
  MD051: 'Link fragments should be valid',
  MD052: 'Reference links and images should use a label that is defined',
  MD053: 'Link and image reference definitions should be needed',
  MD054: 'Link and image style',
  MD055: 'Table pipe style',
  MD056: 'Table column count',
  MD057: 'Relative links should be valid',
  MD058: 'Tables should be surrounded by blank lines',
};
