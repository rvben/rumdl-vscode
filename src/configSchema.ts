/**
 * Auto-generated from rumdl JSON schema
 * DO NOT EDIT MANUALLY - Run 'npm run sync-schema' to regenerate
 *
 * Generated: 2026-02-06T19:12:02.387Z
 */

export interface GlobalConfig {
  /** Enabled rules */
  enable?: string[];
  /** Disabled rules */
  disable?: string[];
  /** Files to exclude */
  exclude?: string[];
  /** Files to include */
  include?: string[];
  /** Respect .gitignore files when scanning directories */
  'respect-gitignore'?: boolean;
  /** Global line length setting (used by MD013 and other rules if not overridden) */
  'line-length'?: string;
  /** Output format for linting results (e.g., "text", "json", "pylint", etc.) */
  'output-format'?: string | null;
  /** Rules that are allowed to be fixed when --fix is used
If specified, only these rules will be fixed */
  fixable?: string[];
  /** Rules that should never be fixed, even when --fix is used
Takes precedence over fixable */
  unfixable?: string[];
  /** Markdown flavor/dialect to use (mkdocs, gfm, commonmark, etc.)
When set, adjusts parsing and validation rules for that specific Markdown variant */
  flavor?: string;
  /** \[DEPRECATED\] Whether to enforce exclude patterns for explicitly passed paths.
This option is deprecated as of v0.0.156 and has no effect.
Exclude patterns are now always respected, even for explicitly provided files.
This prevents duplication between rumdl config and tool configs like pre-commit. */
  'force-exclude'?: boolean;
  /** Directory to store cache files (default: .rumdl_cache)
Can also be set via --cache-dir CLI flag or RUMDL_CACHE_DIR environment variable */
  'cache-dir'?: string | null;
  /** Whether caching is enabled (default: true)
Can also be disabled via --no-cache CLI flag */
  cache?: boolean;
}

export const RULE_SCHEMAS: Record<string, any> = {};

export const GLOBAL_PROPERTIES = [
  'enable',
  'disable',
  'exclude',
  'include',
  'respect-gitignore',
  'line-length',
  'output-format',
  'fixable',
  'unfixable',
  'flavor',
  'force-exclude',
  'cache-dir',
  'cache',
];

export const RULE_NAMES = [
  'MD001',
  'MD003',
  'MD004',
  'MD005',
  'MD007',
  'MD009',
  'MD010',
  'MD011',
  'MD012',
  'MD013',
  'MD014',
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
  'MD057',
  'MD058',
  'MD059',
  'MD060',
  'MD061',
  'MD062',
  'MD063',
  'MD064',
  'MD065',
  'MD066',
  'MD067',
  'MD068',
  'MD069',
  'MD070',
  'MD071',
  'MD072',
  'MD073',
  'MD074',
];
