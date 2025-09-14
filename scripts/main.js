import campaigncodexSettings, { MODULE_NAME } from "./settings.js";
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
    localize,
    format,
    handleCampaignCodexClick,
    ensureCampaignCodexFolders,
    getFolderColor,
    getCampaignCodexFolder,
    showAddToGroupDialog,
    addJournalDirectoryUI,
    mergeDuplicateCodexFolders,
} from "./helper.js";

Hooks.once("init", async function () {
    console.log("Campaign Codex | Initializing");
    console.log("Campaign Codex | Pausing relationship updates for until ready.");

    game.campaignCodexImporting = true;
    await campaigncodexSettings();

    Handlebars.registerHelper("getIcon", function (entityType) {
        return TemplateComponents.getAsset("icon", entityType);
    });

    Handlebars.registerHelper("if_system", function (systemId, options) {
        if (game.system.id === systemId) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

});

Hooks.once("i18nInit", async function () {
    await campaigncodexSettings();
   DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", LocationSheet, {
        canBeDefault: false, 
        makeDefault: false,
        label: `Campaign Codex: ${game.i18n.localize('CAMPAIGN_CODEX.names.location')}`,
    });

   DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", ShopSheet, {
        canBeDefault: false, 
        makeDefault: false,
        label: `Campaign Codex: ${game.i18n.localize('CAMPAIGN_CODEX.names.shop')}`,
    });

    DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", NPCSheet, {
        canBeDefault: false, 
        makeDefault: false,
        label: `Campaign Codex: ${game.i18n.localize('CAMPAIGN_CODEX.names.npc')}`,
    });

    DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", RegionSheet, {
        canBeDefault: false, 
        makeDefault: false,
        label: `Campaign Codex: ${game.i18n.localize('CAMPAIGN_CODEX.names.region')}`,
    });
    DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", GroupSheet, {
        canBeDefault: false, 
        makeDefault: false,
        label: `Campaign Codex: ${game.i18n.localize('CAMPAIGN_CODEX.names.group')}`,
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
                    content: localize("welcomePageHTML"),
                },
                {},
            );
            await game.settings.set(MODULE_NAME, "runonlyonce", true);
        }
    }
    console.log("Campaign Codex | Resuming relationship updates");
    delete game.campaignCodexImporting;
});

Hooks.on("preDeleteScene", async (scene, options, userId) => {
    try {
        const allCCDocuments = game.journal.filter((j) => j.getFlag("campaign-codex", "type"));
        const updatePromises = await game.campaignCodexCleanup.cleanupSceneRelationships(scene.uuid, allCCDocuments);
        if (updatePromises.length > 0) {
            await Promise.allSettled(updatePromises);
            console.log(`Campaign Codex | Scene cleanup completed for: ${scene.name}`);
        }
    } catch (error) {
        console.warn(`Campaign Codex | Scene cleanup failed for ${scene.name}:`, error);
    }
});

Hooks.on("preDeleteJournalEntry", async (journal, options, userId) => {
    if (journal.getFlag("campaign-codex", "type")) return;

    try {
        const allCCDocuments = game.journal.filter((j) => j.getFlag("campaign-codex", "type"));
        const updatePromises = await game.campaignCodexCleanup.cleanupStandardJournalRelationships(journal.uuid, allCCDocuments);

        if (updatePromises.length > 0) {
            await Promise.allSettled(updatePromises);
            console.log(`Campaign Codex | Standard journal link cleanup completed for: ${journal.name}`);
        }
    } catch (error) {
        console.warn(`Campaign Codex | Standard journal link cleanup failed for ${journal.name}:`, error);
    }
});

Hooks.on("getJournalEntryContextOptions", (application, menuItems) => {
    if (!game.user.isGM) return;

    menuItems.push(
        {
            name: localize("context.export"),
            icon: '<i class="fas fa-book"></i>',
            condition: (element) => {
                const journalId = element.dataset.entryId;
                const journal = game.journal.get(journalId);
                return journal && journal.getFlag("campaign-codex", "type");
            },
            callback: async (element) => {
                const journalId = element.dataset.entryId;
                const journal = game.journal.get(journalId);
                if (journal) {
                    await CampaignCodexJournalConverter.showExportDialog(journal);
                }
            },
        },
        {
            name: format("context.group", { type: localize("names.group") }),
            icon: '<i class="fas fa-plus-circle"></i>',
            condition: (element) => {
                const journalId = element.dataset.entryId;
                const journal = game.journal.get(journalId);
                const journalType = journal?.getFlag("campaign-codex", "type");
                return journalType && ["region", "location", "shop", "npc"].includes(journalType) && game.user.isGM;
            },
            callback: async (element) => {
                const journalId = element.dataset.entryId;
                const journal = game.journal.get(journalId);
                if (journal) {
                    await showAddToGroupDialog(journal);
                }
            },
        },
    );
});

// Add to the Create Dialog Button on Journal Directory
Hooks.on("renderDialogV2", (dialog, html, data) => {
    if (dialog.title !== "Create Journal Entry") return;

    const form = html.querySelector("form");
    if (!form) return;

    form.insertAdjacentHTML("beforeend", '<input type="hidden" name="flags.core.sheetClass" value="">');
    const hiddenSheetInput = form.querySelector('input[name="flags.core.sheetClass"]');
   
    const sheetClassMap = {
        region: "campaign-codex.RegionSheet",
        location: "campaign-codex.LocationSheet",
        shop: "campaign-codex.ShopSheet",
        npc: "campaign-codex.NPCSheet", // Correctly capitalized
        group: "campaign-codex.GroupSheet",
    };
    const campaignCodexTypes = {
        region: `Campaign Codex: ${localize("names.region")}`,
        location: `Campaign Codex: ${localize("names.location")}`,
        shop: `Campaign Codex: ${localize("names.shop")}`,
        npc: `Campaign Codex: ${localize("names.npc")}`,
        group: `Campaign Codex: ${localize("names.group")}`,
    };

    const nameInput = form.querySelector('input[name="name"]');
    if (!nameInput) return;

    const selectHTML = `
        <div class="form-group">
            <label>Type</label>
            <div class="form-fields">
                <select name="flags.campaign-codex.type">
                    <option value="">${format("sheet.journal", { type: localize("names.standard") })}</option>
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

    const typeSelect = form.querySelector('select[name="flags.campaign-codex.type"]');
    if (typeSelect) {
        typeSelect.addEventListener("change", (event) => {
            const type = event.target.value;
            hiddenSheetInput.value = sheetClassMap[type] || "";
        });
    }
});

Hooks.on("renderJournalDirectory", (app, html, data) => {
    addJournalDirectoryUI(html);
});

Hooks.on("createJournalEntry", async (document, options, userId) => {
    if (game.user.id !== userId || document.pack || options.skipRelationshipUpdates || options.campaignCodexImport || game.campaignCodexImporting) return;

    const journalType = document.getFlag("campaign-codex", "type");
    if (!journalType) return;

    const folder = getCampaignCodexFolder(journalType);
    if (folder) {
        await document.update({ folder: folder.id });
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
            if (currentSheetName !== "LocationSheet") targetSheet = LocationSheet;
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
        await journal.sheet.close();

        const sheet = new targetSheet(journal);
        sheet.render(true);
    }
});



Hooks.on("updateJournalEntry", async (document, changes, options, userId) => {
  if (
    !document._skipRelationshipUpdates &&
    !options.skipRelationshipUpdates &&
    !game.campaignCodexImporting &&
    game.user.id === userId
  ) {
    const type = document.getFlag("campaign-codex", "type");
    if (type) {
      try {
        await game.campaignCodex.handleRelationshipUpdates(
          document,
          changes,
          type,
        );
      } catch (error) {
        console.error(
          "Campaign Codex | Error handling relationship updates:",
          error,
        );
      }
    }
  }

  await game.campaignCodex._scheduleSheetRefresh(document.uuid);
});


Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (game.user.id !== userId) return;

  const linkedNPC = game.journal.find(
    (j) => j.getFlag("campaign-codex", "data")?.linkedActor === actor.uuid,
  );

  if (linkedNPC) {
    await game.campaignCodex._scheduleSheetRefresh(linkedNPC.uuid);
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
Hooks.on("preImportAdventure", (adventure, formData, toCreate, toUpdate) => {
    console.log("Campaign Codex | Pausing relationship updates for adventure import.");
    game.campaignCodexImporting = true;
});

/**
 * Unsets the global flag to resume Campaign Codex operations after a standard
 * Foundry adventure import has finished.
 */
Hooks.on("importAdventure", async (adventure, formData, created, updated) => {
    try {
        console.log("Campaign Codex | Adventure import complete. Resuming relationship updates.");
        await mergeDuplicateCodexFolders();
    } finally {
        delete game.campaignCodexImporting;
    }
});
