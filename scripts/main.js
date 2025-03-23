// Coriolis Combat Reloaded - main.js

// Constants and Settings
const MODULE_ID = "coriolis-combat-reloaded";

// Register module settings
Hooks.once("init", () => {
    console.log("coriolis-combat-reloaded | Initializing Coriolis Combat Reloaded");
  
  // Register module settings
  game.settings.register("coriolis-combat-reloaded", "enableCombatReloaded", {
    name: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.name"),
    hint: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: _ => window.location.reload()
  });

  // Extend or modify core Coriolis functionality
  if (game.settings.get(MODULE_ID, "enableCombatReloaded")) {
    // Patch the core system's evaluateCoriolisRoll function if necessary
    patchCoriolisRollEvaluation();
    
    // Extend item classes for weapons to handle AP
    extendWeaponClass();
    
    // Extend item classes for armor to handle DR
    extendArmorClass();
  }
});

// Actor Sheet Changes for DR
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Extend the actor sheet vertically to accommodate the new DR bar
  const existingHeight = app.position.height;
  app.setPosition({ height: existingHeight + 30 }); // Add 30px to account for the DR bar
  
  // Modify the armor section in character sheets
  modifyArmorSection(app, html, data);
  
  // Modify the weapon section to include AP
  modifyWeaponSection(app, html, data);
  
  // Add DR bar to the character attributes section
  addManualDRToActorSheet(app, html, data);
  
  // After adding the DR bar, add event listeners for hover effects
  addDRBarEventListeners(html);
  
  // Remove the entire attribute list items for DR attributes
  // Find and remove damageReduction attribute items
  html.find('.attr-block.bg-damageReduction').each(function() {
    // Get the parent flexcol.attr-item
    const attrItem = $(this).closest('.flexcol.attr-item');
    if (attrItem.length) {
      attrItem.remove();
    }
  });
  
  // Find and remove manualDROverride attribute items
  html.find('.attr-block.bg-manualDROverride').each(function() {
    // Get the parent flexcol.attr-item
    const attrItem = $(this).closest('.flexcol.attr-item');
    if (attrItem.length) {
      attrItem.remove();
    }
  });
  
  // Remove any empty li elements in the attribute rows
  html.find('.attribute-list li').each(function() {
    if ($(this).children().length === 0 || $(this).html().trim() === '') {
      $(this).remove();
    }
  });
});

// Add hover event listeners to the DR bar
function addDRBarEventListeners(html) {
  html.find(".dr-bar .bar-segment").mouseenter(function(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const barClass = ".bar";
    const segmentClass = ".bar-segment";
    const currentValue = Number(header.dataset.current);
    // Get the type of item to create.
    const hoverIndex = Number(header.dataset.index);
    let increase = hoverIndex >= currentValue;
    let barElement = $(header).parents(barClass);
    barElement.find(segmentClass).each((i, div) => {
      let bar = $(div);
      const increaseClass = "hover-to-increase";
      const decreaseClass = "hover-to-decrease";
      bar.removeClass(increaseClass);
      bar.removeClass(decreaseClass);
      // only alter the bars that are empty between the end of our 'filled' bars
      // and our hover index
      if (increase && i <= hoverIndex && i >= currentValue) {
        bar.addClass(increaseClass);
      }

      // only alter bars that are filled between the end of our 'filled bars'
      // and our hover index
      if (!increase && i >= hoverIndex && i < currentValue) {
        bar.addClass(decreaseClass);
      }
    });
  });

  html.find(".dr-bar").mouseleave(function(event) {
    event.preventDefault();
    $(event.currentTarget)
      .find(".bar-segment")
      .each((i, div) => {
        let bar = $(div);
        bar.removeClass("hover-to-increase");
        bar.removeClass("hover-to-decrease");
      });
  });
}

// Hook into the item sheet rendering
Hooks.on("renderyzecoriolisItemSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // If this is an armor sheet, modify it to show DR instead of Armor Rating
  if (app.item.type === "armor") {
    modifyArmorSheetDisplay(app, html, data);
  }
  
  // If this is a weapon sheet, add AP field
  if (app.item.type === "weapon") {
    modifyWeaponSheetDisplay(app, html, data);
  }
});

// Combined renderChatMessage hook
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Combat Roll Messages
  modifyCombatRollMessage(message, html, data);
  
  // Check if this is an item card
  const itemId = html.find(".item-card").data("itemId");
  if (itemId) {
    // Find the related actor and item
    const actor = game.actors.get(html.find(".item-card").data("actorId"));
    if (!actor) return;
    
    const item = actor.items.get(itemId);
    if (!item) return;
    
    // Modify weapon cards to display AP
    if (item.type === "weapon") {
      modifyWeaponChatCard(item, html);
    }
    
    // Modify armor cards to display DR
    if (item.type === "armor") {
      modifyArmorChatCard(item, html);
    }
  }
});

// Actor Prep
Hooks.on("preUpdateActor", (actor, updateData, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // We're removing the automatic attribute creation
  // DR will be calculated and displayed in the bar only
});

// Function to modify how armor works in combat rolls
function patchCoriolisRollEvaluation() {
  // Store the original function for later calling
  const originalCoriolisRoll = game.yzecoriolis.coriolisRoll;
  
  // Replace with our modified version
  game.yzecoriolis.coriolisRoll = function(chatOptions, rollData) {
    // Add AP handling to rollData if it's a weapon roll
    if (rollData.rollType === "weapon" && !rollData.armorPenetration) {
      rollData.armorPenetration = 0;
    }
    
    // Call the original function with our modified data
    return originalCoriolisRoll(chatOptions, rollData);
  };
}

// Function to extend weapon class with AP property
function extendWeaponClass() {
  // Make sure required classes exist
  if (!game.yzecoriolis.yzecoriolisItem) return;
  
  // Create a preparation hook for weapon items
  Hooks.on("preCreateItem", (document, data, options, userId) => {
    if (data.type === "weapon" && !data.system.armorPenetration) {
      document.updateSource({"system.armorPenetration": 0});
    }
  });
}

// Function to extend armor class with DR property
function extendArmorClass() {
  // Make sure required classes exist
  if (!game.yzecoriolis.yzecoriolisItem) return;
  
  // Create a preparation hook for armor items
  Hooks.on("preCreateItem", (document, data, options, userId) => {
    if (data.type === "armor" && !data.system.damageReduction) {
      // Convert old armorRating to damageReduction if present
      const armorRating = data.system?.armorRating || 0;
      document.updateSource({
        "system.damageReduction": armorRating,
        "system.-=armorRating": null  // Remove the old property
      });
    }
  });
}

// Function to modify armor section to show DR instead of Armor Rating
function modifyArmorSection(app, html, data) {
    // Change the Armor Rating header to Damage Reduction
    const armorHeader = html.find('.gear-category-header:contains("Armor")');
    if (armorHeader.length) {
      const armorRatingHeader = armorHeader.find('.gear-category-name:contains("Armor Rating")');
      if (armorRatingHeader.length) {
        armorRatingHeader.text(game.i18n.localize("coriolis-combat-reloaded.labels.dr"));
      }
    }
    
    // Update each armor item to show DR instead of Armor Rating
    html.find('.gear.item').each((i, el) => {
      const itemId = el.dataset.itemId;
      if (!itemId) return;
      
      const item = app.actor.items.get(itemId);
      if (item?.type === "armor") {
        // Find where the armor rating is displayed
        const rowData = $(el).find('.gear-row-data:first');
        if (rowData.length) {
          const drValue = item.system.damageReduction || 0;
          rowData.html(`<span class="dr-value">${drValue}</span>`);
        }
      }
    });
}

// Function to modify weapons section to include AP
function modifyWeaponSection(app, html, data) {
  // Not implemented yet, but will be needed for completeness
  // This would add AP values to weapon listings
}

// Function to modify the weapon item sheet
function modifyWeaponSheetDisplay(app, html, data) {
    // Only proceed if this is a weapon
    if (app.item.type !== "weapon") return;
    
    // Find the damage input field
    const damageField = html.find('.resource-label:contains("Damage")').closest('.resource');
    
    // Add AP field after damage if it doesn't exist
    if (damageField.length && !html.find('.resource-label:contains("Armor Penetration")').length) {
      const apValue = app.item.system.armorPenetration || 0;
      const apField = `
        <div class="resource numeric-input flexrow ap-field">
          <label class="resource-label">${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}</label>
          <input type="number" min="0" name="system.armorPenetration" value="${apValue}" data-dtype="Number" />
        </div>
      `;
      $(apField).insertAfter(damageField);
    }
}

// Function to modify the armor item sheet
function modifyArmorSheetDisplay(app, html, data) {
  // Only proceed if this is armor
  if (app.item.type !== "armor") return;
  
  // Find the armor rating field if it exists
  const armorRatingField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
  
  if (armorRatingField.length) {
    // Replace armor rating with damage reduction
    const drValue = app.item.system.damageReduction || app.item.system.armorRating || 0;
    armorRatingField.find('.resource-label').text(game.i18n.localize("YZECORIOLIS.DamageReduction"));
    armorRatingField.find('input').attr('name', 'system.damageReduction').val(drValue);
  } else {
    // If there's no armor rating field yet, add a damage reduction field
    const inputSection = html.find('.header-fields .flexcol').first();
    if (inputSection.length) {
      const drValue = app.item.system.damageReduction || 0;
      const drField = `
        <div class="resource numeric-input flexrow dr-field">
          <label class="resource-label">${game.i18n.localize("YZECORIOLIS.DamageReduction")}</label>
          <input type="number" min="0" name="system.damageReduction" value="${drValue}" data-dtype="Number" />
        </div>
      `;
      inputSection.append(drField);
    }
  }
}

// Function to add DR bar display to character sheet
function addManualDRToActorSheet(app, html, data) {
  // Get current values
  const actor = app.actor;
  const calculatedDR = calculateActorDR(actor);
  const finalDR = calculatedDR;
  
  // Find the always-visible-stats section
  const statsSection = html.find('.always-visible-stats .perma-stats-list');
  if (!statsSection.length) return;
  
  // Create the DR entry with bar display (similar to radiation bar)
  const maxDR = 10; // Maximum value for the DR bar
  
  // Prepare the bar segments HTML
  let barSegmentsHTML = '';
  for (let i = 0; i < maxDR; i++) {
    const isOn = i < finalDR;
    barSegmentsHTML += `
      <div class="bar-segment bar-rounded ${isOn ? 'on' : 'off'}" 
           data-name="system.attributes.damageReduction" 
           data-index="${i}" 
           data-current="${finalDR}" 
           data-min="0" 
           data-max="${maxDR}">
      </div>
    `;
  }
  
  const drEntry = `
    <li class="entry flexrow">
      <div class="stat-label">${game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")}</div>
      <div class="bar dr-bar radiation-bar fr-basic">
        ${barSegmentsHTML}
        <span class="bar-value">${finalDR}</span>
      </div>
    </li>
  `;
  
  // Insert the DR entry - position it after Radiation but before Experience
  const radiationEntry = statsSection.find('.stat-label:contains("Radiation")').closest('.entry');
  if (radiationEntry.length) {
    $(drEntry).insertAfter(radiationEntry);
  } else {
    // If can't find Radiation, just append to the end
    statsSection.append(drEntry);
  }
}

// Function to calculate DR from equipped armor
function calculateActorDR(actor) {
  let totalDR = 0;
  
  // Find all equipped armor items
  const equippedArmor = actor.items.filter(item => 
    item.type === "armor" && 
    item.system.equipped === true
  );
  
  // Sum up all DR values from equipped armor
  for (const armor of equippedArmor) {
    const armorDR = armor.system.damageReduction || 0;
    totalDR += armorDR;
  }
  
  // Cap the DR at 10 for the bar display
  return Math.min(totalDR, 10);
}

// Extend actor preparation to include DR calculations
Hooks.on("preCreateActor", (document, data, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // We no longer need to initialize these properties since we're not using them directly
  // The dr bar will use calculated values instead
});

// Function to modify chat messages for combat rolls
function modifyCombatRollMessage(message, html, data) {
    // Check if this is a weapon roll
    const isWeaponRoll = html.find('h2:contains("Weapon")').length > 0 || 
                          html.find('td:contains("Damage:")').length > 0;
    
    if (!isWeaponRoll) return;
    
    // Get roll data from message flags
    const rollResults = message.getFlag("yzecoriolis", "results");
    if (!rollResults || !rollResults.rollData) return;
    
    const rollData = rollResults.rollData;
    
    // Find a good place to insert AP info
    const damageRow = html.find('td:contains("Damage:")').closest('tr');
    if (!damageRow.length) return;
    
    // Get AP value from roll data
    const apValue = rollData.armorPenetration || 0;
    
    // Insert AP row after damage
    const apRow = $(`
      <tr>
        <td colspan="2">
          ${game.i18n.localize("YZECORIOLIS.ArmorPenetration")}: 
          <span class="ap-value">${apValue}</span>
        </td>
      </tr>
    `);
    apRow.insertAfter(damageRow);
}

// Functions for item cards
function modifyWeaponChatCard(weapon, html) {
  // Add AP after damage
  const damageElement = html.find(".card-damage");
  if (!damageElement.length) return;
  
  // Get the AP value
  const armorPenetration = weapon.system.armorPenetration || 0;
  
  // Create AP element
  const apElement = `
    <div class="card-ap">
      <span class="label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}:</span>
      <span class="value">${armorPenetration}</span>
    </div>
  `;
  
  // Insert after damage
  damageElement.after(apElement);
}

function modifyArmorChatCard(armor, html) {
  // Find where to add the DR info - typically in the card-attributes section
  const attributesElement = html.find(".card-attributes");
  if (!attributesElement.length) return;
  
  // Get the DR value
  const damageReduction = armor.system.damageReduction || 0;
  
  // Create DR element
  const drElement = `
    <div class="card-dr">
      <span class="label">${game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")}:</span>
      <span class="value">${damageReduction}</span>
    </div>
  `;
  
  // Insert into attributes
  attributesElement.append(drElement);
  
  // Remove the original Armor Rating if it exists
  html.find(".card-armor-rating").remove();
}