    import { TFile, parseFrontMatterAliases } from 'obsidian';
import {  DEFAULT_EXCLUDED_ENTITY } from './settings';

    // Create a helper for isExcludedFile
    export function isExcludedFile(file: string): boolean {
        return this.settings.excludedFiles.some((excludedFile: { name: string; }) => excludedFile.name === file);
    }

    export function excludeFile(file: string): boolean {
        if (this.isExcludedFile(file)) {
            return false;
        }
        this.settings.excludedFiles.push({...DEFAULT_EXCLUDED_ENTITY, name: file});
        this.saveSettings();

        return true;
    }

    export function unexcludeFile(file: string): boolean {
        if (!this.isExcludedFile(file)) {
            return false;
        }

        this.settings.excludedFiles = this.settings.excludedFiles.filter((excludedFile: { name: string; }) => excludedFile.name !== file);
        this.saveSettings();

        return true;
    }

    // Create a helper for isExcludedDir
    export function isExcludedDir(path: string): boolean {
        return this.settings.excludedDirs.some((excludedDir: { name: string; }) => path.startsWith(excludedDir.name));
    }

    export function excludeDir(path: string): boolean {
        if (this.isExcludedDir(path)) {
            return false;
        }

        this.settings.excludedDirs.push({...DEFAULT_EXCLUDED_ENTITY, name: path});
        this.saveSettings();

        return true;
    }

    export function unexcludeDir(path: string): boolean {
        if (!this.isExcludedDir(path)) {
            return false;
        }

        this.settings.excludedDirs = this.settings.excludedDirs.filter((excludedDir: { name: string; }) => excludedDir.name !== path);
        this.saveSettings();

        return true;
    }

    export function getAliasesForFile(file: TFile): string[] {
        // First 'Alias' is always the file name
        const filename = [file.basename];
        const cache = this.app.metadataCache.getFileCache(file) || {};
        const frontmatter = cache.frontmatter || {};
        const aliases = parseFrontMatterAliases(frontmatter) || [];
        return filename.concat(aliases);
    }

    export function getAliasesForDirectory(path: string): string[] {
        const aliases: string[] = [];
        const files = this.app.vault.getFiles();
        for (const file of files) {
            if (file.path.startsWith(path)) {
                aliases.push(...getAliasesForFile(file));
            }
        }
        return aliases;
    }