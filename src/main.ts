import { Plugin, parseFrontMatterAliases, Notice, TFile, TFolder, addIcon } from "obsidian";
import { oBridgeSettings, oBridgeSettingTab, DEFAULT_SETTINGS } from "./settings";
import { OBRIDGE_ICON } from "./icon";

export default class oBridge extends Plugin {
    settings: oBridgeSettings;

    async onload() {
        // oBridge Icon
        addIcon('oBridge', OBRIDGE_ICON)

        await this.loadSettings();

        // Add Ribbon Icon
        this.addRibbonIcon("oBridge", "oBridge vault", async () => {
            try {
                const tree = await this.scanVault();
                console.log(tree);
                await this.createLinksFromScan();
            } catch (err) {
                console.error("Error scanning vault:", err);
            }
        });    

        this.addCommand({
            id: "scan-files",
            name: "Bridge Files in Vault",
            callback: async () => {
                try {
                    const tree = await this.scanVault();
                    console.log(tree);
                    await this.createLinksFromScan();
                } catch (err) {
                    console.error("Error scanning vault:", err);
                }
            },
        });


        this.addSettingTab(new oBridgeSettingTab(this.app, this));

        this.registerDomEvent(document, "click", (evt: MouseEvent) => {
            console.log("click", evt);
        });

        this.registerInterval(window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000));
    }

    async scanVault(): Promise<Bridge[]> {
        const results: Bridge[] = [];

        const files = this.app.vault.getMarkdownFiles();

        for (const entity of files) {
            if (entity instanceof TFile) {
                const excludedFile = this.settings.excludedFiles.find(excludedFile => excludedFile.name === entity.basename);
                if (excludedFile && !excludedFile.canBeLinked) {
                    continue;
                }
            }

            if (entity instanceof TFolder) {
                const excludedDir = this.settings.excludedDirs.find(excludedDir => entity.path.startsWith(excludedDir.name));
                if (excludedDir && !excludedDir.canBeLinked) {
                    continue;
                }
            }

            const cache = this.app.metadataCache.getFileCache(entity);

            if (cache && cache.frontmatter) {
                const aliases = parseFrontMatterAliases(cache.frontmatter) || [];

                results.push({
                    fileName: entity.basename,
                    fullFilePath: entity.path,
                    data: {
                        aliases
                    }
                });
            }
        }

        new Notice("Scan complete!");

        await this.saveData(results);

        return results;
    }

    async createLinksFromScan() {
        // Load the data from the results file
        const results: Bridge[] = await this.loadData();

        // Create an alias map for all files
        const aliasMap = new Map<string, string>();
        for (const result of results) {
            const fileName = result.fileName;
            const fullFilePath = result.fullFilePath;
            const aliases = result.data.aliases;

            const excludedFile = this.settings.excludedFiles.find(excludedFile => excludedFile.name === fileName);
            if (excludedFile && !excludedFile.canLinkFromOutside) {
                continue;
            }

            const excludedDir = this.settings.excludedDirs.find(excludedDir => fullFilePath.startsWith(excludedDir.name));
            if (excludedDir && !excludedDir.canLinkFromOutside) {
                continue;
            }

            aliases.forEach(alias => aliasMap.set(alias, fileName));
            aliasMap.set(fileName, fileName);
        }

        const allFiles = this.app.vault.getMarkdownFiles();

        let bridgesAdded = 0; 

        for (const file of allFiles) {
            if (!(file instanceof TFile)) {
                continue;
            }

            const excludedFile = this.settings.excludedFiles.find(excludedFile => excludedFile.name === file.basename);
            if (excludedFile && !excludedFile.canBeLinked) {
                continue;
            }

            let fileContent = await this.app.vault.read(file);
            let frontMatterEndIndex = fileContent.indexOf("---", 3);
            let contentWithoutFrontMatter = frontMatterEndIndex >= 0 ? fileContent.slice(frontMatterEndIndex + 3) : fileContent;

            // Replace occurrences of each alias in the file content (excluding the front matter)
            for (const [alias, originName] of aliasMap.entries()) {
                if (!this.settings.addAliasToSelf && file.basename === originName) {
                    // Don't replace the alias if it's the same as the file name
                    continue;
                }

                const regex = new RegExp(`(?<!\\[|\\|)\\b${alias}\\b(?!\\[|\\|)`, 'g')

                // If the alias is the same as the filename, don't use the alias in the replacement
                const replacement = alias === originName ? `[[${originName}]]` : `[[${originName}|${alias}]]`;
                const newContentWithoutFrontMatter = contentWithoutFrontMatter.replace(regex, replacement);

                if (newContentWithoutFrontMatter !== contentWithoutFrontMatter) {
                    bridgesAdded++; 
                    fileContent = frontMatterEndIndex >= 0 ? fileContent.slice(0, frontMatterEndIndex + 3) + newContentWithoutFrontMatter : newContentWithoutFrontMatter;
                    await this.app.vault.modify(file, fileContent);

                    fileContent = await this.app.vault.read(file);
                    frontMatterEndIndex = fileContent.indexOf("---", 3);
                    contentWithoutFrontMatter = frontMatterEndIndex >= 0 ? fileContent.slice(frontMatterEndIndex + 3) : fileContent;
                }
            }
        }

        new Notice(`Bridging complete! ${bridgesAdded} links added.`);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}


interface Bridge {
    fileName: string;
    fullFilePath: string;
    data: {
        aliases: string[];
    }
}