import campaigncodexSettings, { MODULE_NAME } from "./settings.js";
import { contentCard } from "./welcome-message.js";
import { CampaignManager } from "./campaign-manager.js";
import { LocationSheet } from "./sheets/location-sheet.js";
import { ShopSheet } from "./sheets/shop-sheet.js";
import { NPCSheet } from "./sheets/npc-sheet.js";
import { RegionSheet } from "./sheets/region-sheet.js";
import { CleanUp } from "./cleanup.js";
import { CampaignCodexJournalConverter } from "./campaign-codex-convertor.js";
import { NPCDropper } from "./npc-dropper.js";
import { CampaignCodexTokenPlacement } from "./token-placement.js";
import { GroupSheet } from "./sheets/group-sheet.js";
import { TemplateComponents } from "./sheets/template-components.js";
import { GroupLinkers } from "./sheets/group-linkers.js";
import {
    handleCampaignCodexClick,
    ensureCampaignCodexFolders,
    getFolderColor,
    getCampaignCodexFolder,
    showAddToGroupDialog,
    addJournalDirectoryUI,
    mergeDuplicateCodexFolders
} from "./helper.js";

Hooks.once("init", async function () {
    console.log("Campaign Codex | Initializing");
    await campaigncodexSettings();
    DocumentSheetConfig.registerSheet(
        JournalEntry,
        "campaign-codex",
        LocationSheet,
        {
            makeDefault: false,
            label: "Campaign Codex: Location",
        },
    );

    DocumentSheetConfig.registerSheet(
        JournalEntry,
        "campaign-codex",
        ShopSheet,
        {
            makeDefault: false,
            label: "Campaign Codex: Entry",
        },
    );

    DocumentSheetConfig.registerSheet(
        JournalEntry,
        "campaign-codex",
        NPCSheet,
        {
            makeDefault: false,
            label: "Campaign Codex: NPC",
        },
    );

    DocumentSheetConfig.registerSheet(
        JournalEntry,
        "campaign-codex",
        RegionSheet,
        {
            makeDefault: false,
            label: "Campaign Codex: Region",
        },
    );
    DocumentSheetConfig.registerSheet(
        JournalEntry,
        "campaign-codex",
        GroupSheet,
        {
            makeDefault: false,
            label: "Campaign Codex: Group Overview",
        },
    );

    Handlebars.registerHelper("getIcon", function (entityType) {
        return TemplateComponents.getAsset("icon", entityType);
    });

    Handlebars.registerHelper("if_system", function (systemId, options) {
        if (game.system.id === systemId) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

    console.log("Campaign Codex | Sheets registered");
});

Hooks.once("ready", async function () {
    console.log("Campaign Codex | Ready");

    game.campaignCodex = new CampaignManager();
    game.campaignCodexCleanup = new CleanUp();
    game.campaignCodexNPCDropper = NPCDropper;
    game.campaignCodexTokenPlacement = CampaignCodexTokenPlacement;
    window.CampaignCodexTokenPlacement = CampaignCodexTokenPlacement;

    if (game.settings.get("campaign-codex", "useOrganizedFolders")) {
        await ensureCampaignCodexFolders();
    }

    if (game.user.isGM) {
        if (game.settings.get(MODULE_NAME, "runonlyonce") === false) {
            await ChatMessage.create(
                {
                    user: game.user.id,
                    speaker: ChatMessage.getSpeaker(),
                    content: contentCard,
                },
                {},
            );
            await game.settings.set(MODULE_NAME, "runonlyonce", true);
        }
    }
});

Hooks.on("preDeleteScene", async (scene, options, userId) => {
    try {
        const allCCDocuments = game.journal.filter((j) =>
            j.getFlag("campaign-codex", "type"),
        );
        const updatePromises =
            await game.campaignCodexCleanup.cleanupSceneRelationships(
                scene.uuid,
                allCCDocuments,
            );
        if (updatePromises.length > 0) {
            await Promise.allSettled(updatePromises);
            console.log(
                `Campaign Codex | Scene cleanup completed for: ${scene.name}`,
            );
        }
    } catch (error) {
        console.warn(
            `Campaign Codex | Scene cleanup failed for ${scene.name}:`,
            error,
        );
    }
});

Hooks.on("preDeleteJournalEntry", async (journal, options, userId) => {
    // Exit if this is a Campaign Codex journal, as it has its own cleanup.
    if (journal.getFlag("campaign-codex", "type")) return;

    try {
        const allCCDocuments = game.journal.filter((j) =>
            j.getFlag("campaign-codex", "type"),
        );
        const updatePromises =
            await game.campaignCodexCleanup.cleanupStandardJournalRelationships(
                journal.uuid,
                allCCDocuments,
            );

        if (updatePromises.length > 0) {
            await Promise.allSettled(updatePromises);
            console.log(
                `Campaign Codex | Standard journal link cleanup completed for: ${journal.name}`,
            );
        }
    } catch (error) {
        console.warn(
            `Campaign Codex | Standard journal link cleanup failed for ${journal.name}:`,
            error,
        );
    }
});

// v12
Hooks.on("getJournalDirectoryEntryContext", (html, options) => {
    options.push({
        name: "Export to Standard Journal",
        icon: '<i class="fas fa-book"></i>',
        condition: (li) => {
            const journalUuid =
                li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
            const journal = fromUuidSync(journalUuid);
            return journal && journal.getFlag("campaign-codex", "type");
        },
        callback: async (li) => {
            const journalUuid =
                li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
            const journal = await fromUuid(journalUuid);
            if (journal) {
                await CampaignCodexJournalConverter.showExportDialog(journal);
            }
        },
    });
    options.push({
        name: "Add to Group",
        icon: '<i class="fas fa-plus-circle"></i>',
        condition: (li) => {
            const journalUuid =
                li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
            const journal = fromUuidSync(journalUuid);
            const journalType = journal?.getFlag("campaign-codex", "type");
            return (
                journalType &&
                ["region", "location", "shop", "npc"].includes(journalType) &&
                game.user.isGM
            );
        },
        callback: async (li) => {
            const journalUuid =
                li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
            const journal = await fromUuid(journalUuid);
            if (journal) {
                await showAddToGroupDialog(journal); // Call the imported function
            }
        },
    });
});

Hooks.on("renderJournalDirectory", (app, html, data) => {
    addJournalDirectoryUI(html);
});

Hooks.on("createJournalEntry", async (document, options, userId) => {
    if (
        game.user.id !== userId ||
        document.pack ||
        options.skipRelationshipUpdates ||
        options.campaignCodexImport ||
        options.campaignCodexImport
    )
        return;

    const journalType = document.getFlag("campaign-codex", "type");
    if (!journalType) return;

    // The only remaining job is to move it to the correct folder.
    const folder = getCampaignCodexFolder(journalType);
    if (folder) {
        await document.update({ folder: folder.id });
    }
});

// Add to the Create Dialog Button on Journal Directory
Hooks.on("renderDialog", (dialog, html, data) => {
    if (dialog.title !== "Create New Journal Entry") return;

    const form = html[0].querySelector("form");
    if (!form) return;

    // --- NEW: Add a hidden input for the sheetClass ---
    form.insertAdjacentHTML(
        "beforeend",
        '<input type="hidden" name="flags.core.sheetClass" value="">',
    );
    const hiddenSheetInput = form.querySelector(
        'input[name="flags.core.sheetClass"]',
    );

    const campaignCodexTypes = {
        region: "Campaign Codex: Region",
        location: "Campaign Codex: Location",
        shop: "Campaign Codex: Entry",
        npc: "Campaign Codex: NPC",
        group: "Campaign Codex: Group Overview",
    };

    const nameInput = form.querySelector('input[name="name"]');
    if (!nameInput) return;

    const selectHTML = `
        <div class="form-group">
            <label>Type</label>
            <div class="form-fields">
                <select name="flags.campaign-codex.type">
                    <option value="">Standard Journal</option>
                    <optgroup label="Campaign Codex">
                        ${Object.entries(campaignCodexTypes)
                            .map(
                                ([key, label]) => `
                            <option value="${key}">${label}</option>
                        `,
                            )
                            .join("")}
                    </optgroup>
                </select>
            </div>
        </div>
    `;

    nameInput.closest(".form-group").insertAdjacentHTML("afterend", selectHTML);
    dialog.setPosition({ height: "auto" });

    // --- NEW: Add an event listener to the new dropdown ---
    const typeSelect = form.querySelector(
        'select[name="flags.campaign-codex.type"]',
    );
    if (typeSelect) {
        typeSelect.addEventListener("change", (event) => {
            const type = event.target.value;
            let sheetClass = ""; // Default sheet
            if (type) {
                // Map the type to its corresponding sheet class name
                sheetClass = `campaign-codex.${type.charAt(0).toUpperCase() + type.slice(1)}Sheet`;
            }
            hiddenSheetInput.value = sheetClass;
        });
    }
});

Hooks.on("createScene", async (scene, options, userId) => {
    if (options.campaignCodexImport) {
        return;
    }
});

Hooks.on("renderJournalEntry", async (journal, html, data) => {
    const journalType = journal.getFlag("campaign-codex", "type");
    if (!journalType) return;

    const currentSheetName = journal.sheet.constructor.name;
    let targetSheet = null;

    switch (journalType) {
        case "location":
            if (currentSheetName !== "LocationSheet")
                targetSheet = LocationSheet;
            break;
        case "shop":
            if (currentSheetName !== "ShopSheet") targetSheet = ShopSheet;
            break;
        case "npc":
            if (currentSheetName !== "NPCSheet") targetSheet = NPCSheet;
            break;
        case "region":
            if (currentSheetName !== "RegionSheet") targetSheet = RegionSheet;
            break;
        case "group":
            if (currentSheetName !== "GroupSheet") targetSheet = GroupSheet;
            break;
    }

    if (targetSheet) {
        await Promise.resolve();

        journal.sheet.close();
        const sheet = new targetSheet(journal);
        sheet.render(true);
        journal._campaignCodexSheet = sheet;
    }
});

Hooks.on("updateJournalEntry", async (document, changes, options, userId) => {
    if (changes.name) {
        for (const app of Object.values(ui.windows)) {
            if (
                app.document?.getFlag("campaign-codex", "type") &&
                app.document.uuid !== document.uuid
            ) {
                if (
                    app._isRelatedDocument &&
                    (await app._isRelatedDocument(document.uuid))
                ) {
                    console.log(
                        `Campaign Codex | Refreshing ${app.document.name} due to name update in ${document.name}`,
                    );
                    app.render(false);
                }
            }
        }
    }

    if (changes.permission) {
        for (const app of Object.values(ui.windows)) {
            if (
                app.document?.getFlag("campaign-codex", "type") &&
                app.document.uuid !== document.uuid
            ) {
                if (
                    app._isRelatedDocument &&
                    (await app._isRelatedDocument(document.uuid))
                ) {
                    console.log(
                        `Campaign Codex | Refreshing ${app.document.name} due to permission update in ${document.name}`,
                    );
                    app.render(false);
                }
            }
        }
    }

    if (
        document._skipRelationshipUpdates ||
        options.skipRelationshipUpdates ||
        game.campaignCodexImporting ||
        game.user.id !== userId
    )
        return;

    const type = document.getFlag("campaign-codex", "type");
    if (!type) return;

    try {
        await game.campaignCodex.handleRelationshipUpdates(
            document,
            changes,
            type,
        );
    } catch (error) {
        console.error(
            "Campaign Codex | Error in updateJournalEntry hook:",
            error,
        );
    }
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (game.user.id !== userId || !changes.img) return;

    const linkedNPCs = game.journal.filter(
        (j) => j.getFlag("campaign-codex", "data")?.linkedActor === actor.uuid,
    );
    if (linkedNPCs.length === 0) return;

    const linkedNpcUuids = new Set(linkedNPCs.map((j) => j.uuid));
    console.log(
        `Campaign Codex | Actor image updated for ${actor.name}. Found ${linkedNPCs.length} linked NPC journals.`,
    );

    const sheetsToRefresh = new Set();

    for (const app of Object.values(ui.windows)) {
        if (!app.document?.getFlag) continue;
        const docType = app.document.getFlag("campaign-codex", "type");
        if (!docType) continue;

        if (docType === "npc" && linkedNpcUuids.has(app.document.uuid)) {
            sheetsToRefresh.add(app);
            continue;
        }

        if (docType === "group" && app.constructor.name === "GroupSheet") {
            const groupData =
                app.document.getFlag("campaign-codex", "data") || {};
            const groupMembers = await GroupLinkers.getGroupMembers(
                groupData.members || [],
            );
            const nestedData = await GroupLinkers.getNestedData(groupMembers);

            const containsNpc = nestedData.allNPCs.some((npc) =>
                linkedNpcUuids.has(npc.uuid),
            );
            if (containsNpc) {
                sheetsToRefresh.add(app);
            }
            continue;
        }

        if (app._isRelatedDocument) {
            for (const npcUuid of linkedNpcUuids) {
                if (await app._isRelatedDocument(npcUuid)) {
                    sheetsToRefresh.add(app);
                    break;
                }
            }
        }
    }

    if (sheetsToRefresh.size > 0) {
        console.log(
            `Campaign Codex | Refreshing ${sheetsToRefresh.size} sheets.`,
        );
        for (const app of sheetsToRefresh) {
            app.render(false);
        }
    }
});

Hooks.on("renderChatMessage", (app, html, data) => {
    const nativeHtml = html instanceof jQuery ? html[0] : html;
    const handlers = nativeHtml.querySelectorAll(
        `[data-campaign-codex-handler^="${MODULE_NAME}|"]`,
    );
    handlers.forEach((element) => {
        element.addEventListener("click", handleCampaignCodexClick);
    });
});

/**
 * Sets a global flag to pause Campaign Codex operations when a standard
 * Foundry adventure import begins.
 */
Hooks.on('preImportAdventure', (adventure, formData, toCreate, toUpdate) => {
    console.log("Campaign Codex | Pausing relationship updates for adventure import.");
    game.campaignCodexImporting = true;
});

/**
 * Unsets the global flag to resume Campaign Codex operations after a standard
 * Foundry adventure import has finished.
 */
Hooks.on('importAdventure', async (adventure, formData, created, updated) => {
    try {
        console.log("Campaign Codex | Adventure import complete. Resuming relationship updates.");
        await mergeDuplicateCodexFolders();
    } finally {
        delete game.campaignCodexImporting;
    }
});