import { TFile, parseFrontMatterAliases } from 'obsidian';
import {  DEFAULT_EXCLUDED_ENTITY, excludedEntity } from './settings';

    // Create a helper for isExcludedFile
    export function isExcludedFile(file: string, excludedFiles: excludedEntity[]): boolean {
        return excludedFiles.some((excludedFile: { name: string; }) => excludedFile.name === file);
    }

    export function excludeFile(file: string, excludedFiles: excludedEntity[]): excludedEntity[] {
        if (this.isExcludedFile(file)) {
            return excludedFiles;
        }
        excludedFiles.push({...DEFAULT_EXCLUDED_ENTITY, name: file});
        this.saveSettings();

        return excludedFiles;
    }

    export function unexcludeFile(file: string, excludedFiles: excludedEntity[]): excludedEntity[]  {
        if (!this.isExcludedFile(file)) {
            return excludedFiles;
        }

        excludedFiles = excludedFiles.filter((excludedFile: { name: string; }) => excludedFile.name !== file);
        this.saveSettings();

        return excludedFiles;
    }

    // Create a helper for isExcludedDir
    export function isExcludedDir(path: string, excludedDirs: excludedEntity[]): boolean {
        return excludedDirs.some((excludedDir: { name: string; }) => path.startsWith(excludedDir.name));
    }

    export function excludeDir(path: string, excludedDirs: excludedEntity[]): excludedEntity[] {
        if (this.isExcludedDir(path)) {
            return excludedDirs;
        }

        excludedDirs.push({...DEFAULT_EXCLUDED_ENTITY, name: path});
        this.saveSettings();

        return excludedDirs;
    }

    export function unexcludeDir(path: string, excludedDirs: excludedEntity[]): excludedEntity[] {
        if (!this.isExcludedDir(path)) {
            return excludedDirs;
        }

        excludedDirs = excludedDirs.filter((excludedDir: { name: string; }) => excludedDir.name !== path);
        this.saveSettings();

        return excludedDirs;
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