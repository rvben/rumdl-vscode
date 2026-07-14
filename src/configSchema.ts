/**
 * Auto-generated from rumdl JSON schema
 * DO NOT EDIT MANUALLY - Run 'npm run sync-schema' to regenerate
 *
 * Generated: 2026-07-14T20:30:25.418Z
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
  /** Additional rules to enable on top of the base set (additive) */
  'extend-enable'?: string[];
  /** Additional rules to disable on top of the base set (additive) */
  'extend-disable'?: string[];
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
  'extend-enable',
  'extend-disable',
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
  'MD075',
  'MD076',
  'MD077',
  'MD078',
  'MD079',
  'MD080',
  'MD081',
  'MD082',
];

// Maps a rule's canonical kebab-case name or extra alias (lowercased) to its
// MD### code. The CLI accepts any of these as a TOML section name in place
// of the code, e.g. [line-length] / [rules.line-length] / [tool.rumdl.line-length]
// are all equivalent to [MD013] / [rules.MD013] / [tool.rumdl.MD013].
export const RULE_ALIASES: Record<string, string> = {
  'heading-increment': 'MD001',
  'heading-style': 'MD003',
  'ul-style': 'MD004',
  'list-indent': 'MD005',
  'ul-indent': 'MD007',
  'no-trailing-spaces': 'MD009',
  'no-hard-tabs': 'MD010',
  'no-reversed-links': 'MD011',
  'no-multiple-blanks': 'MD012',
  'line-length': 'MD013',
  'commands-show-output': 'MD014',
  'no-missing-space-atx': 'MD018',
  'no-multiple-space-atx': 'MD019',
  'no-missing-space-closed-atx': 'MD020',
  'no-multiple-space-closed-atx': 'MD021',
  'blanks-around-headings': 'MD022',
  'heading-start-left': 'MD023',
  'no-duplicate-heading': 'MD024',
  'single-h1': 'MD025',
  'single-title': 'MD025',
  'no-trailing-punctuation': 'MD026',
  'no-multiple-space-blockquote': 'MD027',
  'no-blanks-blockquote': 'MD028',
  'ol-prefix': 'MD029',
  'list-marker-space': 'MD030',
  'blanks-around-fences': 'MD031',
  'blanks-around-lists': 'MD032',
  'no-inline-html': 'MD033',
  'no-bare-urls': 'MD034',
  'hr-style': 'MD035',
  'no-emphasis-as-heading': 'MD036',
  'no-space-in-emphasis': 'MD037',
  'no-space-in-code': 'MD038',
  'no-space-in-links': 'MD039',
  'fenced-code-language': 'MD040',
  'first-line-h1': 'MD041',
  'first-line-heading': 'MD041',
  'no-empty-links': 'MD042',
  'required-headings': 'MD043',
  'proper-names': 'MD044',
  'no-alt-text': 'MD045',
  'code-block-style': 'MD046',
  'single-trailing-newline': 'MD047',
  'code-fence-style': 'MD048',
  'emphasis-style': 'MD049',
  'strong-style': 'MD050',
  'link-fragments': 'MD051',
  'reference-links-images': 'MD052',
  'link-image-reference-definitions': 'MD053',
  'link-image-style': 'MD054',
  'table-pipe-style': 'MD055',
  'table-column-count': 'MD056',
  'existing-relative-links': 'MD057',
  'blanks-around-tables': 'MD058',
  'descriptive-link-text': 'MD059',
  'table-cell-alignment': 'MD060',
  'table-format': 'MD060',
  'forbidden-terms': 'MD061',
  'link-destination-whitespace': 'MD062',
  'heading-capitalization': 'MD063',
  'no-multiple-consecutive-spaces': 'MD064',
  'blanks-around-horizontal-rules': 'MD065',
  'footnote-validation': 'MD066',
  'footnote-definition-order': 'MD067',
  'empty-footnote-definition': 'MD068',
  'no-duplicate-list-markers': 'MD069',
  'nested-code-fence': 'MD070',
  'blank-line-after-frontmatter': 'MD071',
  'frontmatter-key-sort': 'MD072',
  'toc-validation': 'MD073',
  'mkdocs-nav': 'MD074',
  'orphaned-table-rows': 'MD075',
  'list-item-spacing': 'MD076',
  'list-continuation-indent': 'MD077',
  'missing-chunk-labels': 'MD078',
  'chunk-label-spaces': 'MD079',
  'heading-anchor-collision': 'MD080',
  'no-excessive-emphasis': 'MD081',
  'no-empty-sections': 'MD082',
};
