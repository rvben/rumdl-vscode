/**
 * Auto-generated from rumdl JSON schema
 * DO NOT EDIT MANUALLY - Run 'npm run sync-schema' to regenerate
 *
 * Generated: 2025-10-25T08:35:08.247Z
 */

export interface GlobalConfig {
  /** Disabled rules */
  disable?: string[];
  /** Enabled rules */
  enable?: string[];
  /** Files to exclude */
  exclude?: string[];
  /** Rules that are allowed to be fixed when --fix is used If specified, only these rules will be fixed */
  fixable?: string[];
  /** Markdown flavor/dialect to use (mkdocs, gfm, commonmark, etc.) When set, adjusts parsing and validation rules for that specific Markdown variant */
  flavor?: any;
  /** [DEPRECATED] Whether to enforce exclude patterns for explicitly passed paths. This option is deprecated as of v0.0.156 and has no effect. Exclude patterns are now always respected, even for explicitly provided files. This prevents duplication between rumdl config and tool configs like pre-commit. */
  force_exclude?: boolean;
  /** Files to include */
  include?: string[];
  /** Global line length setting (used by MD013 and other rules if not overridden) */
  line_length?: number;
  /** Output format for linting results (e.g., "text", "json", "pylint", etc.) */
  output_format?: string | null;
  /** Respect .gitignore files when scanning directories */
  respect_gitignore?: boolean;
  /** Rules that should never be fixed, even when --fix is used Takes precedence over fixable */
  unfixable?: string[];
}

export const RULE_SCHEMAS: Record<string, any> = {};

export const GLOBAL_PROPERTIES = [
  'disable',
  'enable',
  'exclude',
  'fixable',
  'flavor',
  'force_exclude',
  'include',
  'line_length',
  'output_format',
  'respect_gitignore',
  'unfixable',
];

export const RULE_NAMES = [
  'MD001',
  'MD002',
  'MD003',
  'MD004',
  'MD005',
  'MD006',
  'MD007',
  'MD009',
  'MD010',
  'MD011',
  'MD012',
  'MD013',
  'MD018',
  'MD019',
  'MD020',
  'MD021',
  'MD022',
  'MD023',
  'MD024',
  'MD025',
  'MD026',
  'MD027',
  'MD028',
  'MD029',
  'MD030',
  'MD031',
  'MD032',
  'MD033',
  'MD034',
  'MD035',
  'MD036',
  'MD037',
  'MD038',
  'MD039',
  'MD040',
  'MD041',
  'MD042',
  'MD043',
  'MD044',
  'MD045',
  'MD046',
  'MD047',
  'MD048',
  'MD049',
  'MD050',
  'MD051',
  'MD052',
  'MD053',
  'MD054',
  'MD055',
  'MD056',
  'MD058',
];
