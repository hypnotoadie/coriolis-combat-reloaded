// Coriolis Combat Reloaded - Simplified and Stable Approach
// This module adds Armor Penetration to weapons and Damage Reduction to armor

const MODULE_ID = "coriolis-combat-reloaded";

// Initialize the module
Hooks.once("init", () => {
  console.log("Coriolis Combat Reloaded | Initializing");
  
  // Register module settings
  game.settings.register(MODULE_ID, "enableCombatReloaded", {
    name: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.name"),
    hint: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => window.location.reload()
  });
});

Hooks.once("ready", function() {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  console.log("Coriolis Combat Reloaded | Module Ready");
  
  // Initialize existing items
  initializeItemFields();
  
  // Hook into form submission to preserve values
  hookItemSheetSubmission();
  
  // Show activation message
  ui.notifications.info(game.i18n.localize("coriolis-combat-reloaded.messages.moduleActive"));
});

// Initialize AP/DR fields for existing items
function initializeItemFields() {
  // Initialize weapons with AP field
  game.items.filter(i => i.type === "weapon").forEach(item => {
    if (item.system.armorPenetration === undefined) {
      item.update({"system.armorPenetration": 0});
    }
  });
  
  // Initialize armor with DR field
  game.items.filter(i => i.type === "armor").forEach(item => {
    if (item.system.damageReduction === undefined) {
      const arValue = item.system.armorRating || 0;
      item.update({"system.damageReduction": arValue});
    }
  });
}

// Hook: When new items are created, initialize custom fields
Hooks.on("createItem", (item, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  if (game.user.id !== userId) return;
  
  if (item.type === "weapon" && item.system.armorPenetration === undefined) {
    item.update({"system.armorPenetration": 0});
  }
  
  if (item.type === "armor" && item.system.damageReduction === undefined) {
    const armorRating = item.system.armorRating || 0;
    item.update({"system.damageReduction": armorRating});
  }
});

// Hook: Modify weapon item sheets to include AP field
Hooks.on("renderyzecoriolisItemSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  if (app.item.type === "weapon") {
    addAPFieldToWeaponSheet(app, html);
  }
  
  if (app.item.type === "armor") {
    replaceARWithDROnArmorSheet(app, html);
  }
});

// Hook: Modify actor sheets to show DR and AP values
Hooks.on("renderyzecoriolisActorSheet", (app, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // Update armor display to show DR instead of AR
  modifyArmorDisplayOnActorSheet(app, html);
  
  // Update weapon display to show AP
  modifyWeaponDisplayOnActorSheet(app, html);
});

// Hook: Add AP to weapon roll chat messages
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  addAPToChatMessage(message, html);
});

// Hook into form submission to preserve values
function hookItemSheetSubmission() {
  // Check if we've already hooked this
  if (window.coriolisCombatReloadedHooked) return;
  
  console.log("Combat Reloaded: Setting up form submission hooks");
  
  // Hook into item updates to ensure our fields are preserved
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
    if (game.user.id !== userId) return;
    
    console.log("Combat Reloaded: Item updated:", item.name, "Changes:", changes);
    
    // Ensure AP field exists on weapons
    if (item.type === "weapon" && changes.system && !("armorPenetration" in changes.system)) {
      if (item.system.armorPenetration === undefined || item.system.armorPenetration === null) {
        console.log("Combat Reloaded: Adding missing AP field to weapon");
        item.update({"system.armorPenetration": 0}, {render: false});
      }
    }
    
    // Ensure DR field exists on armor and sync with AR
    if (item.type === "armor") {
      if (changes.system?.damageReduction !== undefined) {
        const drValue = changes.system.damageReduction;
        if (item.system.armorRating !== drValue) {
          console.log("Combat Reloaded: Syncing AR to match DR:", drValue);
          item.update({"system.armorRating": drValue}, {render: false});
        }
      } else if (changes.system && !("damageReduction" in changes.system)) {
        if (item.system.damageReduction === undefined || item.system.damageReduction === null) {
          console.log("Combat Reloaded: Adding missing DR field to armor");
          const arValue = item.system.armorRating || 0;
          item.update({"system.damageReduction": arValue}, {render: false});
        }
      }
    }
  });
  
  window.coriolisCombatReloadedHooked = true;
}


// Function to add AP field to weapon item sheets
function addAPFieldToWeaponSheet(app, html) {
  console.log("Combat Reloaded: Adding AP field to weapon:", app.item.name);
  console.log("Combat Reloaded: Item type:", app.item.type);
  
  // Prevent duplicate processing
  if (html.data('ap-processed')) {
    console.log("Combat Reloaded: Already processed, skipping");
    return;
  }
  html.data('ap-processed', true);
  
  // Remove any existing AP fields first
  html.find('.ap-field').remove();
  
  // Get current AP value with extensive logging
  let apValue = app.item.system.armorPenetration;
  console.log("Combat Reloaded: Raw AP value:", apValue, "Type:", typeof apValue);
  
  // Only initialize if truly undefined or null
  if (apValue === undefined || apValue === null) {
    console.log("Combat Reloaded: AP value is undefined/null, initializing to 0");
    apValue = 0;
    // Initialize the field in the item data
    app.item.update({"system.armorPenetration": 0});
  } else {
    console.log("Combat Reloaded: Using existing AP value:", apValue);
    apValue = Number(apValue) || 0;
  }
  
  // Try multiple ways to find where to insert the AP field
  let insertionPoint = null;
  
  // First try: look for damage field
  const damageField = html.find('input[name="system.damage"]').closest('.resource');
  if (damageField.length) {
    insertionPoint = damageField;
    console.log("Combat Reloaded: Found damage field via input name");
  }
  
  // Second try: look for label containing "Damage"
  if (!insertionPoint) {
    const damageLabel = html.find('.resource-label:contains("Damage")').closest('.resource');
    if (damageLabel.length) {
      insertionPoint = damageLabel;
      console.log("Combat Reloaded: Found damage field via label");
    }
  }
  
  // Third try: look for any field in the form
  if (!insertionPoint) {
    const firstResource = html.find('.resource').first();
    if (firstResource.length) {
      insertionPoint = firstResource;
      console.log("Combat Reloaded: Using first resource field as insertion point");
    }
  }
  
  if (insertionPoint && insertionPoint.length) {
    console.log("Combat Reloaded: Inserting AP field");
    
    const apFieldHTML = `
      <div class="resource numeric-input flexrow ap-field" id="ap-field-${app.item.id}">
        <label class="resource-label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}</label>
        <input type="number" name="system.armorPenetration" value="${apValue}" data-dtype="Number" min="0" class="ap-input">
      </div>
    `;
    
    $(apFieldHTML).insertAfter(insertionPoint);
    
    // Verify the field was added
    const addedField = html.find('.ap-field');
    console.log("Combat Reloaded: AP field added successfully:", addedField.length > 0);
    
    // Add event handlers
    const apInput = html.find(`#ap-field-${app.item.id} .ap-input`);
    apInput.off('change.combat-reloaded blur.combat-reloaded');
    
    apInput.on('change.combat-reloaded blur.combat-reloaded', function(event) {
      const inputVal = $(this).val();
      console.log("Combat Reloaded: AP input changed to:", inputVal);
      
      if (inputVal === "") {
        $(this).val(0);
        app.item.update({"system.armorPenetration": 0});
        return;
      }
      
      const numVal = Number(inputVal);
      if (isNaN(numVal)) {
        console.log("Combat Reloaded: Invalid AP number, reverting");
        $(this).val(app.item.system.armorPenetration || 0);
        return;
      }
      
      const finalValue = Math.max(0, Math.floor(numVal));
      console.log("Combat Reloaded: Updating AP to:", finalValue);
      $(this).val(finalValue);
      app.item.update({"system.armorPenetration": finalValue});
    });
    
  } else {
    console.log("Combat Reloaded: Could not find insertion point for AP field");
    console.log("Combat Reloaded: Available resources:", html.find('.resource').length);
    console.log("Combat Reloaded: HTML structure:", html.find('.sheet-body').html());
  }
}

// Function to replace AR with DR on armor item sheets
function replaceARWithDROnArmorSheet(app, html) {
  console.log("Combat Reloaded: Processing armor sheet:", app.item.name);
  console.log("Combat Reloaded: Item type:", app.item.type);
  
  // Prevent duplicate processing
  if (html.data('dr-processed')) {
    console.log("Combat Reloaded: Already processed DR, skipping");
    return;
  }
  html.data('dr-processed', true);
  
  // Get current values
  const armorRating = app.item.system.armorRating || 0;
  let damageReduction = app.item.system.damageReduction;
  
  console.log("Combat Reloaded: AR:", armorRating, "DR:", damageReduction);
  
  // Initialize DR if needed
  if (damageReduction === undefined || damageReduction === null) {
    console.log("Combat Reloaded: Initializing DR from AR");
    damageReduction = armorRating;
    app.item.update({"system.damageReduction": damageReduction});
  }
  
  // Try multiple ways to find the armor rating field
  let armorField = null;
  
  // First try: input name
  armorField = html.find('input[name="system.armorRating"]').closest('.resource');
  if (armorField.length) {
    console.log("Combat Reloaded: Found AR field via input name");
  }
  
  // Second try: label text
  if (!armorField || !armorField.length) {
    armorField = html.find('.resource-label:contains("Armor Rating")').closest('.resource');
    if (armorField.length) {
      console.log("Combat Reloaded: Found AR field via label");
    }
  }
  
  // Third try: any label containing "Armor"
  if (!armorField || !armorField.length) {
    armorField = html.find('.resource-label:contains("Armor")').closest('.resource');
    if (armorField.length) {
      console.log("Combat Reloaded: Found armor field via partial label");
    }
  }
  
  if (armorField && armorField.length) {
    console.log("Combat Reloaded: Converting AR field to DR field");
    
    // Change the label
    armorField.find('.resource-label').text(
      game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction")
    );
    
    // Update the input
    const input = armorField.find('input');
    input.attr('name', 'system.damageReduction');
    input.val(damageReduction);
    
    console.log("Combat Reloaded: DR field conversion completed");
    
    // Add change handler for syncing
    input.off('change.combat-reloaded blur.combat-reloaded');
    input.on('change.combat-reloaded blur.combat-reloaded', function() {
      const val = $(this).val();
      const numVal = Number(val) || 0;
      const finalVal = Math.max(0, numVal);
      
      console.log("Combat Reloaded: DR changed to:", finalVal);
      
      // Update both DR and AR
      app.item.update({
        "system.damageReduction": finalVal,
        "system.armorRating": finalVal
      });
    });
    
  } else {
    console.log("Combat Reloaded: Could not find AR field to convert");
    console.log("Combat Reloaded: Available resources:", html.find('.resource').length);
    console.log("Combat Reloaded: Available labels:", html.find('.resource-label').map((i, el) => $(el).text()).get());
  }
}

// Function to modify armor display on actor sheets
function modifyArmorDisplayOnActorSheet(app, html) {
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;
    
    const item = app.actor.items.get(itemId);
    if (item?.type === "armor") {
      // Replace armor rating display with DR
      const armorRatingDisplay = $(el).find('.gear-row-data').first();
      if (armorRatingDisplay.length) {
        const drValue = item.system.damageReduction || item.system.armorRating || 0;
        armorRatingDisplay.html(`<span class="dr-value">${drValue}</span>`);
      }
    }
  });
}

// Debug version to understand the actor sheet structure
function modifyWeaponDisplayOnActorSheet(app, html) {
  console.log("Combat Reloaded: === DEBUGGING ACTOR SHEET STRUCTURE ===");

  // Find the weapons and explosives section headers
  const headersToModify = html.find('.gear-category-name:contains("Weapons"), .gear-category-name:contains("Explosives")').closest('.gear-category-header');

  headersToModify.each(function() {
    const header = $(this);
    const categoryName = header.find('.gear-category-name').text().trim();
    console.log(`Combat Reloaded: Found ${categoryName} header`);

    // Replace Initiative with AP in the header
    const initiativeHeader = header.find('.gear-category-name:contains("Initiative")');
    if (initiativeHeader.length) {
      console.log(`Combat Reloaded: Replacing Initiative header with AP for ${categoryName}`);
      initiativeHeader.text("AP");
    }
  });


  // Find and analyze weapon and explosive rows
  html.find('.gear.item').each((i, el) => {
    const itemId = el.dataset.itemId;
    if (!itemId) return;

    const item = app.actor.items.get(itemId);
    if (item?.type === "weapon" || item?.type === "explosive") {
      console.log("Combat Reloaded: === WEAPON/EXPLOSIVE ROW DEBUG ===");
      console.log("Combat Reloaded: Item:", item.name);
      console.log("Combat Reloaded: AP Value:", item.system.armorPenetration || 0);

      // Log the structure of this weapon row
      const gearBg = $(el).find('.gear-bg');
      const rowData = gearBg.find('.gear-row-data');
      
      console.log("Combat Reloaded: Row data elements:", rowData.length);


      // Try to replace the initiative column (assuming it's index 1)
      if (rowData.length > 1) {
        const apValue = item.system.armorPenetration || 0;
        const targetColumn = $(rowData[1]); // 2nd column (0-indexed)
        
        console.log("Combat Reloaded: Setting column 1 to AP value:", apValue);
        targetColumn.html(`<span class="ap-value-display">${apValue}</span>`);
        targetColumn.addClass('ap-column');
      }

      console.log("Combat Reloaded: === END WEAPON/EXPLOSIVE ROW DEBUG ===");
    }
  });

  console.log("Combat Reloaded: === END ACTOR SHEET STRUCTURE DEBUG ===");
}

// Function to add AP to chat messages
function addAPToChatMessage(message, html) {
  // Check if this is a weapon roll
  const isWeaponRoll = message.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon";
  
  if (!isWeaponRoll) return;
  
  // Check if AP is already displayed
  if (html.find('.ap-chat-value').length > 0) return;
  
  // Get AP value from roll data or actor
  let apValue = 0;
  const rollData = message.flags.yzecoriolis.results.rollData;
  
  if (rollData.armorPenetration !== undefined) {
    apValue = rollData.armorPenetration;
  } else if (message.speaker.actor) {
    // Try to get from actor's weapon
    const actor = game.actors.get(message.speaker.actor);
    if (actor) {
      const weaponName = rollData.rollTitle;
      const weapon = actor.items.find(i => i.type === "weapon" && i.name === weaponName);
      if (weapon) {
        apValue = weapon.system.armorPenetration || 0;
      }
    }
  }
  
  // Find where to insert AP (after damage row)
  const damageRow = html.find('tr:contains("Damage:")');
  if (damageRow.length) {
    const apRow = `
      <tr>
        <td colspan="2">
          ${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}: 
          <span class="ap-chat-value">${apValue}</span>
        </td>
      </tr>
    `;
    $(apRow).insertAfter(damageRow);
  }
}