#!/usr/bin/env node
// Checks that every marketplace entry resolves to a plugin that actually exists,
// and that each plugin carries a manifest for every client we support.
// No dependencies. Run: node scripts/validate-plugins.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
const check = (ok, msg) => {
    if (!ok) {
        console.error(`  FAIL  ${msg}`);
        failed++;
    }
};
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

// Every plugin directory carries one manifest per client.
const MANIFESTS = [
    'plugin.json', // Agent Plugins 1.0
    '.claude-plugin/plugin.json', // Claude Code
    '.cursor-plugin/plugin.json', // Cursor
    '.codex-plugin/plugin.json' // Codex / ChatGPT
];

const pluginDirs = isDir('plugins')
    ? readdirSync('plugins').filter((d) => isDir(join('plugins', d)))
    : [];
check(pluginDirs.length > 0, 'no plugins found under plugins/');

console.log(`plugins (${pluginDirs.length}):`);
for (const name of pluginDirs) {
    const dir = join('plugins', name);
    console.log(`  ${dir}`);
    for (const m of MANIFESTS) {
        const p = join(dir, m);
        check(existsSync(p), `${p} is missing`);
        if (!existsSync(p)) continue;
        const j = read(p);
        check(j.name === name, `${p}: name "${j.name}" should match directory "${name}"`);
    }
    const ap = join(dir, 'plugin.json');
    if (existsSync(ap)) {
        const j = read(ap);
        check(
            j.$schema === 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
            `${ap}: $schema must be the Agent Plugins 1.0 schema`
        );
        check(
            /^(?!.*(--|\.\.))[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(j.name) && j.name.length <= 64,
            `${ap}: name "${j.name}" breaks the Agent Plugins naming rule`
        );
    }
    // A plugin contributes skills, MCP servers, or both.
    const hasSkills = isDir(join(dir, 'skills'));
    const hasMcp = existsSync(join(dir, 'mcp.json')) || existsSync(join(dir, '.mcp.json'));
    check(hasSkills || hasMcp, `${dir}: contributes neither skills/ nor an MCP config`);
    if (hasSkills) {
        for (const s of readdirSync(join(dir, 'skills'))) {
            const sk = join(dir, 'skills', s, 'SKILL.md');
            check(existsSync(sk), `${sk} is missing`);
        }
    }
    // Asset paths declared in any manifest must exist on disk.
    const assetFields = [
        ['plugin.json', ['logo']],
        ['.cursor-plugin/plugin.json', ['logo']],
        ['.codex-plugin/plugin.json', ['logo', 'composerIcon', 'screenshots']]
    ];
    for (const [manifest, fields] of assetFields) {
        const mp = join(dir, manifest);
        if (!existsSync(mp)) continue;
        const j = read(mp);
        const src = { ...j, ...(j.interface ?? {}) };
        for (const f of fields) {
            for (const v of [src[f]].flat().filter((x) => typeof x === 'string')) {
                if (/^https?:/.test(v)) continue;
                check(existsSync(join(dir, v)), `${mp}: ${f} points at ${v}, which does not exist`);
            }
        }
    }

    // Cursor rules: .mdc with description + (globs or alwaysApply).
    const rulesDir = join(dir, 'rules');
    if (isDir(rulesDir)) {
        const cursor = join(dir, '.cursor-plugin/plugin.json');
        if (existsSync(cursor)) {
            check(
                read(cursor).rules !== undefined,
                `${cursor}: has rules/ on disk but no "rules" field`
            );
        }
        for (const f of readdirSync(rulesDir)) {
            const rp = join(rulesDir, f);
            check(f.endsWith('.mdc'), `${rp}: Cursor rules must be .mdc`);
            const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(rp, 'utf8'));
            check(fm !== null, `${rp}: missing YAML frontmatter`);
            if (!fm) continue;
            check(/^description:/m.test(fm[1]), `${rp}: frontmatter needs a description`);
            check(
                /^globs:/m.test(fm[1]) || /^alwaysApply:\s*true/m.test(fm[1]),
                `${rp}: needs globs, or alwaysApply: true`
            );
        }
    }

    // Codex reads .mcp.json, Agent Plugins and Cursor read mcp.json - ship both.
    if (hasMcp) {
        check(
            existsSync(join(dir, 'mcp.json')) && existsSync(join(dir, '.mcp.json')),
            `${dir}: ship both mcp.json (Agent Plugins, Cursor) and .mcp.json (Codex)`
        );
    }
}

// Marketplace entries must point at a real plugin directory.
const marketplaces = [
    ['.claude-plugin/marketplace.json', (e) => e.source, '.claude-plugin/plugin.json'],
    [
        '.cursor-plugin/marketplace.json',
        (e, m) => join(m.metadata?.pluginRoot ?? '', e.source),
        '.cursor-plugin/plugin.json'
    ],
    ['.agents/plugins/marketplace.json', (e) => e.source.path, '.codex-plugin/plugin.json']
];

console.log('marketplaces:');
for (const [file, resolve, manifest] of marketplaces) {
    check(existsSync(file), `${file} is missing`);
    if (!existsSync(file)) continue;
    const m = read(file);
    console.log(`  ${file} (${m.plugins.length} entries)`);
    for (const e of m.plugins) {
        const dir = resolve(e, m);
        check(isDir(dir), `${file}: entry "${e.name}" points at ${dir}, which does not exist`);
        check(
            existsSync(join(dir, manifest)),
            `${file}: entry "${e.name}" needs ${join(dir, manifest)}`
        );
        check(
            pluginDirs.includes(e.name),
            `${file}: entry "${e.name}" has no matching directory under plugins/`
        );
    }
    for (const name of pluginDirs) {
        check(
            m.plugins.some((e) => e.name === name),
            `${file}: plugin "${name}" is not listed`
        );
    }
}

console.log(failed === 0 ? '\nOK' : `\n${failed} problem(s)`);
process.exit(failed === 0 ? 0 : 1);
