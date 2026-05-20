import { describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
    VariantResolutionError,
    parseVariantsValue,
    resolveSelectedVariants,
    stitchFileWithVariants,
    validatePluginMetadataV2,
} from '../lib/plugin-runtime.js';

describe('plugin runtime helpers', () => {
    test('parseVariantsValue supports comma-separated strings', () => {
        expect(parseVariantsValue('primary, secondary ,danger')).toEqual(['primary', 'secondary', 'danger']);
    });

    test('validatePluginMetadataV2 catches missing exports', () => {
        const errors = validatePluginMetadataV2({
            name: 'X',
            version: '1.0.0',
            slug: 'x',
            category: 'atom',
        });

        expect(errors.length).toBeGreaterThan(0);
    });

    test('resolveSelectedVariants strict policy rejects conflicts', () => {
        const metadata = {
            variants: {
                groups: {
                    emphasis: ['primary', 'secondary', 'danger'],
                },
            },
        };

        expect(() => resolveSelectedVariants(metadata, ['primary', 'secondary'], { variantPolicy: 'strict' }))
            .toThrow(VariantResolutionError);
    });

    test('resolveSelectedVariants resolver policy uses plugin order', () => {
        const metadata = {
            variants: {
                groups: {
                    emphasis: ['primary', 'secondary', 'danger'],
                },
                resolver: {
                    order: ['secondary', 'primary', 'danger'],
                },
            },
        };

        const selected = resolveSelectedVariants(metadata, ['danger', 'primary', 'secondary'], {
            variantPolicy: 'resolver',
        });

        expect(selected).toEqual(['secondary']);
    });

    test('stitchFileWithVariants appends existing variant file content once', async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'superhub-test-'));
        const baseDir = path.join(tempRoot, 'Button');
        const variantsDir = path.join(baseDir, 'Variants');

        await fs.mkdir(variantsDir, { recursive: true });
        await fs.writeFile(path.join(baseDir, 'Button.css'), '.btn { color: black; }', 'utf-8');
        await fs.writeFile(path.join(variantsDir, 'primary.css'), '.btn-primary { color: blue; }', 'utf-8');

        const stitched = await stitchFileWithVariants(
            path.join(baseDir, 'Button.css'),
            baseDir,
            '.css',
            ['primary', 'primary']
        );

        expect(stitched.includes('.btn { color: black; }')).toBeTrue();
        expect(stitched.includes('.btn-primary { color: blue; }')).toBeTrue();
        expect(stitched.match(/Variant: primary/g)?.length || 0).toBe(1);
    });
});
