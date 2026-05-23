import { isErrorMessage, Cell as Cell$1, initWasm, Workbook } from 'logisheets-web';
export * from 'logisheets-web';

var WorkerUpdate = /* @__PURE__ */ ((WorkerUpdate2) => {
  WorkerUpdate2[WorkerUpdate2["Cell"] = 0] = "Cell";
  WorkerUpdate2[WorkerUpdate2["Sheet"] = 1] = "Sheet";
  WorkerUpdate2[WorkerUpdate2["CellAndSheet"] = 2] = "CellAndSheet";
  WorkerUpdate2[WorkerUpdate2["Ready"] = 3] = "Ready";
  WorkerUpdate2[WorkerUpdate2["CellValueChanged"] = 4] = "CellValueChanged";
  WorkerUpdate2[WorkerUpdate2["CellRemoved"] = 5] = "CellRemoved";
  WorkerUpdate2[WorkerUpdate2["HeaderUpdated"] = 6] = "HeaderUpdated";
  return WorkerUpdate2;
})(WorkerUpdate || {});
var MethodName = /* @__PURE__ */ ((MethodName2) => {
  MethodName2["GetSheetDimension"] = "getSheetDimension";
  MethodName2["GetAllSheetInfo"] = "getAllSheetInfo";
  MethodName2["GetDisplayWindow"] = "getDisplayWindow";
  MethodName2["GetBlockDisplayWindow"] = "getBlockDisplayWindow";
  MethodName2["GetCell"] = "getCell";
  MethodName2["GetCells"] = "getCells";
  MethodName2["GetCellsExceptWindow"] = "getCellsExceptWindow";
  MethodName2["GetBlockInfo"] = "getBlockInfo";
  MethodName2["GetCellPosition"] = "getCellPosition";
  MethodName2["Undo"] = "undo";
  MethodName2["Redo"] = "redo";
  MethodName2["HandleTransaction"] = "handleTransaction";
  MethodName2["HandleTransactionWithoutEvents"] = "handleTransactionWithoutEvents";
  MethodName2["LoadWorkbook"] = "loadWorkbook";
  MethodName2["IsReady"] = "isReady";
  MethodName2["GetMergedCells"] = "getMergedCells";
  MethodName2["CalcCondition"] = "calcCondition";
  MethodName2["CheckFormula"] = "checkFormula";
  MethodName2["Save"] = "save";
  MethodName2["CleanupTempStatus"] = "cleanupTempStatus";
  MethodName2["ToggleStatus"] = "toggleStatus";
  MethodName2["CommitTempStatus"] = "commitTempStatus";
  MethodName2["BatchGetCellInfoById"] = "batchGetCellInfoById";
  MethodName2["BatchGetCellCoordinateWithSheetById"] = "batchGetCellCoordinateWithSheetById";
  MethodName2["GetSheetNameByIdx"] = "getSheetNameByIdx";
  MethodName2["LookupAppendixUpward"] = "lookupAppendixUpward";
  MethodName2["GetBlockRowId"] = "getBlockRowId";
  MethodName2["GetBlockColId"] = "getBlockColId";
  MethodName2["GetSheetIdx"] = "getSheetIdx";
  MethodName2["GetSheetId"] = "getSheetId";
  MethodName2["GetBlockValues"] = "getBlockValues";
  MethodName2["GetAvailableBlockId"] = "getAvailableBlockId";
  MethodName2["GetDiyCellIdWithBlockId"] = "getDiyCellIdWithBlockId";
  MethodName2["GetReproducibleCell"] = "getReproducibleCell";
  MethodName2["GetReproducibleCells"] = "getReproducibleCells";
  MethodName2["GetCellValue"] = "getCellValue";
  MethodName2["GetShadowCellId"] = "getShadowCellId";
  MethodName2["GetShadowCellIds"] = "getShadowCellIds";
  MethodName2["GetShadowInfoById"] = "getShadowInfoById";
  MethodName2["GetCellId"] = "getCellId";
  MethodName2["GetDisplayUnitsOfFormula"] = "getDisplayUnitsOfFormula";
  MethodName2["GetNextVisibleCell"] = "getNextVisibleCell";
  MethodName2["GetAllBlockFields"] = "getAllBlockFields";
  MethodName2["GetAppData"] = "getAppData";
  return MethodName2;
})(MethodName || {});
var OffscreenRenderName = /* @__PURE__ */ ((OffscreenRenderName2) => {
  OffscreenRenderName2["Render"] = "render";
  OffscreenRenderName2["Resize"] = "resize";
  OffscreenRenderName2["Init"] = "init";
  OffscreenRenderName2["GetAppropriateHeights"] = "getAppropriateHeights";
  OffscreenRenderName2["SetLicense"] = "setLicense";
  OffscreenRenderName2["ClearLicense"] = "clearLicense";
  return OffscreenRenderName2;
})(OffscreenRenderName || {});

function sheetCellIdToString(id) {
  if (typeof id === "number") return String(id);
  return `${id.sheetId}-${JSON.stringify(id.cellId)}`;
}
class WorkbookClient {
  _worker;
  _resolvers = /* @__PURE__ */ new Map();
  _id = 100;
  _ready = false;
  _cellUpdatedCallbacks = [];
  _sheetUpdatedCallbacks = [];
  _headerUpdatedCallbacks = [];
  _cellValueChangedCallbacks = /* @__PURE__ */ new Map();
  _cellRemovedCallbacks = /* @__PURE__ */ new Map();
  constructor(worker) {
    this._worker = worker;
    this._worker.onmessage = (e) => {
      const data = e.data;
      const { result, id } = data;
      if (id === WorkerUpdate.Cell) {
        this._cellUpdatedCallbacks.forEach((f) => f());
      } else if (id === WorkerUpdate.Sheet) {
        this._sheetUpdatedCallbacks.forEach((f) => f());
      } else if (id === WorkerUpdate.CellAndSheet) {
        this._sheetUpdatedCallbacks.forEach((f) => f());
        this._cellUpdatedCallbacks.forEach((f) => f());
      } else if (id === WorkerUpdate.HeaderUpdated) {
        const sheetIdxes = result ?? [];
        this._headerUpdatedCallbacks.forEach((f) => f(sheetIdxes));
      } else if (id === WorkerUpdate.Ready) {
        if (!this._ready) {
          this._ready = true;
          const r = this._resolvers.get(id);
          if (r) r(result);
        }
      } else if (id === WorkerUpdate.CellValueChanged) {
        const cellIdStr = sheetCellIdToString(result);
        this._cellValueChangedCallbacks.get(cellIdStr)?.forEach((f) => {
          f(result);
        });
      } else if (id === WorkerUpdate.CellRemoved) {
        const cellIdStr = sheetCellIdToString(result);
        this._cellRemovedCallbacks.get(cellIdStr)?.forEach((f) => {
          f(result);
        });
      }
      const resolver = this._resolvers.get(id);
      if (resolver) {
        resolver(result);
      }
      this._resolvers.delete(id);
    };
  }
  // ========================================================================
  // Sheet Operations
  // ========================================================================
  getAllSheetInfo() {
    return this._call(MethodName.GetAllSheetInfo);
  }
  getSheetDimension(sheetIdx) {
    return this._call(
      MethodName.GetSheetDimension,
      sheetIdx
    );
  }
  getSheetIdx(params) {
    return this._call(MethodName.GetSheetIdx, params);
  }
  getSheetId(params) {
    return this._call(MethodName.GetSheetId, params);
  }
  getSheetNameByIdx(idx) {
    return this._call(MethodName.GetSheetNameByIdx, idx);
  }
  // ========================================================================
  // Cell Operations
  // ========================================================================
  getCell(params) {
    return this._call(MethodName.GetCell, params);
  }
  getCells(params) {
    return this._call(MethodName.GetCells, params);
  }
  getCellPosition(params) {
    return this._call(MethodName.GetCellPosition, params);
  }
  getCellId(params) {
    return this._call(MethodName.GetCellId, params);
  }
  getNextVisibleCell(params) {
    return this._call(
      MethodName.GetNextVisibleCell,
      params
    );
  }
  // ========================================================================
  // Block Operations
  // ========================================================================
  getBlockInfo(params) {
    return this._call(MethodName.GetBlockInfo, params);
  }
  getAvailableBlockId(params) {
    return this._call(MethodName.GetAvailableBlockId, params);
  }
  // ========================================================================
  // Merged Cells
  // ========================================================================
  getMergedCells(params) {
    return this._call(MethodName.GetMergedCells, params);
  }
  // ========================================================================
  // Transaction Operations
  // ========================================================================
  handleTransaction(params) {
    return this._call(MethodName.HandleTransaction, params);
  }
  handleTransactionWithoutEvents(params) {
    return this._call(
      MethodName.HandleTransactionWithoutEvents,
      params
    );
  }
  undo() {
    return this._call(MethodName.Undo);
  }
  redo() {
    return this._call(MethodName.Redo);
  }
  commitTempStatus() {
    return this._call(MethodName.CommitTempStatus);
  }
  cleanTempStatus() {
    return this._call(MethodName.CleanupTempStatus);
  }
  // ========================================================================
  // File Operations
  // ========================================================================
  loadWorkbook(params) {
    return this._call(MethodName.LoadWorkbook, params);
  }
  save(params) {
    return this._call(MethodName.Save, params);
  }
  // ========================================================================
  // Formula Operations
  // ========================================================================
  getDisplayUnitsOfFormula(f) {
    return this._call(
      MethodName.GetDisplayUnitsOfFormula,
      f
    );
  }
  checkFormula(params) {
    return this._call(MethodName.CheckFormula, params);
  }
  // ========================================================================
  // App Data & Block Fields
  // ========================================================================
  getAppData() {
    return this._call(MethodName.GetAppData);
  }
  getAllBlockFields() {
    return this._call(MethodName.GetAllBlockFields);
  }
  getShadowCellId(params) {
    return this._call(MethodName.GetShadowCellId, params);
  }
  // ========================================================================
  // Callbacks
  // ========================================================================
  registerCellUpdatedCallback(f, _callbackId) {
    this._cellUpdatedCallbacks.push(f);
  }
  registerSheetUpdatedCallback(f) {
    this._sheetUpdatedCallbacks.push(f);
  }
  registerHeaderUpdatedCallback(f) {
    this._headerUpdatedCallbacks.push(f);
  }
  registerCellValueChangedCallback(sheetIdx, rowIdx, colIdx, callback) {
    return this.getCellId({ sheetIdx, rowIdx, colIdx }).then((cellId) => {
      if (isErrorMessage(cellId)) {
        return cellId;
      }
      const cellIdStr = sheetCellIdToString(cellId);
      if (!this._cellValueChangedCallbacks.has(cellIdStr)) {
        this._cellValueChangedCallbacks.set(cellIdStr, [callback]);
      } else {
        this._cellValueChangedCallbacks.get(cellIdStr)?.push(callback);
      }
      return;
    });
  }
  // ========================================================================
  // Internal
  // ========================================================================
  _call(method, params) {
    const id = this._id++;
    this._worker.postMessage({ m: method, args: params, id });
    return new Promise((resolve) => {
      this._resolvers.set(id, resolve);
    });
  }
}

class OffscreenClient {
  _worker;
  _resolvers = /* @__PURE__ */ new Map();
  _rid = 10;
  constructor(worker) {
    this._worker = worker;
    this._worker.addEventListener("message", (e) => {
      const data = e.data;
      const rid = data?.rid;
      if (typeof rid !== "number") return;
      const resolver = this._resolvers.get(rid);
      if (resolver) {
        resolver(data.error ?? data.result);
        this._resolvers.delete(rid);
      }
    });
  }
  init(canvas, dpr) {
    return this._call(OffscreenRenderName.Init, { canvas, dpr }, [
      canvas
    ]);
  }
  render(sheetId, anchorX, anchorY) {
    return this._call(OffscreenRenderName.Render, {
      sheetId,
      anchorX,
      anchorY
    });
  }
  getAppropriateHeights(sheetId, anchorX, anchorY) {
    return this._call(OffscreenRenderName.GetAppropriateHeights, {
      sheetId,
      anchorX,
      anchorY
    });
  }
  resize(width, height, dpr) {
    return this._call(OffscreenRenderName.Resize, {
      width,
      height,
      dpr
    });
  }
  setLicense(apiKey, domain) {
    return this._call(OffscreenRenderName.SetLicense, {
      apiKey,
      domain
    });
  }
  clearLicense() {
    this._call(OffscreenRenderName.ClearLicense, {});
  }
  _call(method, params, transfer) {
    const rid = this._rid++;
    if (transfer) {
      this._worker.postMessage({ m: method, args: params, rid }, transfer);
    } else {
      this._worker.postMessage({ m: method, args: params, rid });
    }
    return new Promise((resolve) => {
      this._resolvers.set(rid, resolve);
    });
  }
}

class DataService {
  _workbook;
  _offscreen;
  _sheetInfos = [];
  _sheetIdx = 0;
  _sheetId = 0;
  _sheetUpdateCallback = [];
  _lastRender = {
    sheetId: 0,
    anchorX: 0,
    anchorY: 0,
    grid: void 0
  };
  constructor(worker) {
    this._workbook = new WorkbookClient(worker);
    this._offscreen = new OffscreenClient(worker);
    this._init();
  }
  // ========================================================================
  // Initialization
  // ========================================================================
  _init() {
    this._workbook.getAllSheetInfo().then((v) => {
      if (!isErrorMessage(v)) this._sheetInfos = v;
    });
    this._workbook.registerSheetUpdatedCallback(() => {
      this._workbook.getAllSheetInfo().then((v) => {
        if (!isErrorMessage(v)) this._sheetInfos = v;
        this._sheetUpdateCallback.forEach((f) => f());
      });
    });
  }
  // ========================================================================
  // Rendering
  // ========================================================================
  async render(sheetId, anchorX, anchorY) {
    return this._offscreen.render(sheetId, anchorX, anchorY).then((v) => {
      if (isErrorMessage(v)) return v;
      this._lastRender = { sheetId, anchorX, anchorY, grid: v };
      return v;
    });
  }
  async resize(width, height, dpr) {
    return this._offscreen.resize(width, height, dpr);
  }
  initOffscreen(canvas) {
    return this._offscreen.init(canvas, window.devicePixelRatio);
  }
  setLicense(apiKey) {
    const domain = typeof location !== "undefined" ? location.hostname : "";
    return this._offscreen.setLicense(apiKey, domain);
  }
  clearLicense() {
    this._offscreen.clearLicense();
  }
  // ========================================================================
  // File Operations
  // ========================================================================
  async loadWorkbook(buf, name) {
    await this._workbook.loadWorkbook({ content: buf, name });
    this._sheetIdx = 0;
    return this._offscreen.render(this._sheetId, 0, 0);
  }
  // ========================================================================
  // Sheet Operations
  // ========================================================================
  setCurrentSheetIdx(idx) {
    if (idx >= this._sheetInfos.length) return;
    this._sheetIdx = idx;
    this._sheetId = this._sheetInfos[idx].id;
    this._offscreen.render(this._sheetId, 0, 0);
  }
  getCurrentSheetIdx() {
    return this._sheetIdx;
  }
  getCurrentSheetId() {
    return this._sheetId;
  }
  getCurrentSheetName() {
    return this._sheetInfos[this._sheetIdx]?.name ?? "";
  }
  getCacheAllSheetInfo() {
    return this._sheetInfos;
  }
  getSheetDimension(sheetIdx) {
    return this._workbook.getSheetDimension(sheetIdx);
  }
  // ========================================================================
  // Cell Operations
  // ========================================================================
  getCellInfo(sheetIdx, row, col) {
    return this._workbook.getCell({ sheetIdx, row, col }).then((v) => {
      if (!isErrorMessage(v)) return new Cell$1(v);
      return v;
    });
  }
  getMergedCells(sheetIdx, targetStartRow, targetStartCol, targetEndRow, targetEndCol) {
    return this._workbook.getMergedCells({
      startRow: targetStartRow,
      endRow: targetEndRow,
      startCol: targetStartCol,
      endCol: targetEndCol,
      sheetIdx
    });
  }
  // ========================================================================
  // Block Operations
  // ========================================================================
  getAvailableBlockId(sheetIdx) {
    return this._workbook.getAvailableBlockId({ sheetIdx });
  }
  // ========================================================================
  // Formula Operations
  // ========================================================================
  async checkFormula(formula) {
    const result = await this._workbook.checkFormula({ formula });
    if (typeof result === "boolean") {
      return result;
    }
    return false;
  }
  // ========================================================================
  // Transaction Operations
  // ========================================================================
  async handleTransaction(transaction, temp = false) {
    return this._workbook.handleTransaction({ transaction, temp });
  }
  async handleTransactionAndAdjustRowHeights(transaction, onlyIncrease = false, fromRowIdx, toRowIdx) {
    const { sheetId, anchorX, anchorY } = this._lastRender;
    const affectResult = await this._workbook.handleTransactionWithoutEvents({
      transaction,
      temp: false
    });
    if (isErrorMessage(affectResult)) {
      await this._offscreen.render(sheetId, anchorX, anchorY);
      return;
    }
    const heights = await this._offscreen.getAppropriateHeights(
      sheetId,
      anchorX,
      anchorY
    );
    if (isErrorMessage(heights)) {
      await this._offscreen.render(sheetId, anchorX, anchorY);
      return;
    }
    return;
  }
  undo() {
    return this._workbook.undo();
  }
  redo() {
    return this._workbook.redo();
  }
  // ========================================================================
  // Workbook Access
  // ========================================================================
  getWorkbook() {
    return this._workbook;
  }
  // ========================================================================
  // Callbacks
  // ========================================================================
  registerSheetUpdatedCallback(f) {
    this._sheetUpdateCallback.push(f);
  }
  registerCellUpdatedCallback(f, callbackId) {
    this._workbook.registerCellUpdatedCallback(f, callbackId);
  }
  registerHeaderUpdatedCallback(f) {
    this._workbook.registerHeaderUpdatedCallback(f);
  }
}

class EnumSetManager {
  constructor() {
    this.enums.set("_logisheets_builtin01", {
      id: "_logisheets_builtin01",
      name: "Gender",
      description: "",
      variants: [
        { id: "male", value: "Male", color: "#22c55e" },
        { id: "female", value: "Female", color: "#f59e0b" }
      ]
    });
  }
  enums = /* @__PURE__ */ new Map();
  /**
   * Get an enum by its ID
   * @param id The unique identifier of the enum
   * @returns The EnumInfo if found, undefined otherwise
   */
  get(id) {
    return this.enums.get(id);
  }
  /**
   * Get all registered enums
   * @returns Array of all EnumInfo objects
   */
  getAll() {
    return Array.from(this.enums.values());
  }
  /**
   * Check if an enum exists
   * @param id The unique identifier of the enum
   * @returns true if the enum exists, false otherwise
   */
  has(id) {
    return this.enums.has(id);
  }
  /**
   * Register a new enum or update an existing one
   * @param id The unique identifier for this enum
   * @param name The name of the enum
   * @param variants The list of variants
   * @param description Optional description
   * @throws Error if variant values are not unique within the enum
   * @returns The created/updated EnumInfo
   */
  set(id, name, variants, description) {
    this.validateVariantUniqueness(variants);
    const enumInfo = {
      id,
      name,
      description,
      variants: [...variants]
      // Create a copy to avoid external mutations
    };
    this.enums.set(id, enumInfo);
    return enumInfo;
  }
  /**
   * Update an existing enum
   * @param id The unique identifier of the enum
   */
  update(id, info) {
    if (!this.enums.has(id)) {
      throw new Error(`Enum with id '${id}' does not exist`);
    }
    this.enums.set(id, info);
    return info;
  }
  /**
   * Add a variant to an existing enum
   * @param enumId The ID of the enum
   * @param variant The variant to add
   * @throws Error if enum doesn't exist or variant value already exists
   * @returns The updated EnumInfo
   */
  addVariant(enumId, variant) {
    const enumInfo = this.enums.get(enumId);
    if (!enumInfo) {
      throw new Error(`Enum with id '${enumId}' does not exist`);
    }
    if (enumInfo.variants.some(
      (v) => v.value === variant.value || v.id === variant.id
    )) {
      throw new Error(
        `Variant with value '${variant.value}' or id '${variant.id}' already exists in enum '${enumId}'`
      );
    }
    const updatedVariants = [...enumInfo.variants, variant];
    const updatedInfo = {
      ...enumInfo,
      variants: updatedVariants
    };
    return this.update(enumId, updatedInfo);
  }
  /**
   * Remove a variant from an enum
   * @param enumId The ID of the enum
   * @param variantId The ID of the variant to remove
   * @throws Error if enum doesn't exist
   * @returns The updated EnumInfo
   */
  removeVariant(enumId, variantId) {
    const enumInfo = this.enums.get(enumId);
    if (!enumInfo) {
      throw new Error(`Enum with id '${enumId}' does not exist`);
    }
    const updatedVariants = enumInfo.variants.filter((v) => v.id !== variantId);
    const updatedInfo = {
      ...enumInfo,
      variants: updatedVariants
    };
    return this.update(enumId, updatedInfo);
  }
  /**
   * Delete an enum
   * @param id The unique identifier of the enum to delete
   * @returns true if the enum was deleted, false if it didn't exist
   */
  delete(id) {
    return this.enums.delete(id);
  }
  /**
   * Clear all enums
   */
  clear() {
    this.enums.clear();
  }
  /**
   * Get the number of registered enums
   * @returns The count of enums
   */
  count() {
    return this.enums.size;
  }
  /**
   * Find enums by name (case-insensitive partial match)
   * @param query The search query
   * @returns Array of matching EnumInfo objects
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.enums.values()).filter(
      (enumInfo) => enumInfo.name.toLowerCase().includes(lowerQuery)
    );
  }
  /**
   * Validate that all variant values are unique within the list
   * @param variants The list of variants to validate
   * @throws Error if duplicate values are found
   */
  validateVariantUniqueness(variants) {
    const values = /* @__PURE__ */ new Set();
    const ids = /* @__PURE__ */ new Set();
    for (const variant of variants) {
      if (values.has(variant.value)) {
        throw new Error(
          `Duplicate variant value '${variant.value}' found. All variant values must be unique within an enum.`
        );
      }
      if (ids.has(variant.id)) {
        throw new Error(
          `Duplicate variant id '${variant.id}' found. All variant ids must be unique within an enum.`
        );
      }
      values.add(variant.value);
      ids.add(variant.id);
    }
  }
  /**
   * Export all enums as JSON
   * @returns JSON string representation of all enums
   */
  toJSON() {
    return JSON.stringify(Array.from(this.enums.entries()));
  }
  /**
   * Import enums from JSON
   * @param json JSON string representation of enums
   * @throws Error if JSON is invalid
   */
  fromJSON(json) {
    try {
      const entries = JSON.parse(json);
      this.enums = new Map(entries);
    } catch (error) {
      throw new Error(`Failed to import enums from JSON: ${error}`);
    }
  }
}

class FieldManager {
  fields = /* @__PURE__ */ new Map();
  _counter = 0;
  /**
   * Generate a unique field ID
   * @returns A unique field ID that will never be reused
   */
  generateFieldId() {
    const id = `field_${Date.now()}_${++this._counter}`;
    return id;
  }
  /**
   * Create a new field
   * @param sheetId The sheet ID
   * @param blockId The block ID
   * @param fieldData Field configuration (without id)
   * @returns The created FieldInfo with generated ID
   */
  create(sheetId, blockId, fieldData) {
    const fieldId = this.generateFieldId();
    const fieldInfo = {
      ...fieldData,
      id: fieldId,
      sheetId,
      blockId
    };
    this.fields.set(fieldId, fieldInfo);
    return fieldInfo;
  }
  /**
   * Get a field by its composite key
   * @param fieldId The field ID
   * @returns The FieldInfo if found, undefined otherwise
   */
  get(fieldId) {
    return this.fields.get(fieldId);
  }
  /**
   * Get all fields for a specific sheet and block
   * @param sheetId The sheet ID
   * @param blockId The block ID
   * @returns Array of all FieldInfo objects for the block
   */
  getByBlock(sheetId, blockId) {
    return Array.from(this.fields.values()).filter(
      (field) => field.sheetId === sheetId && field.blockId === blockId
    );
  }
  /**
   * Get all fields for a specific sheet
   * @param sheetId The sheet ID
   * @returns Array of all FieldInfo objects for the sheet
   */
  getBySheet(sheetId) {
    return Array.from(this.fields.values()).filter(
      (field) => field.sheetId === sheetId
    );
  }
  /**
   * Get all fields
   * @returns Array of all FieldInfo objects
   */
  getAll() {
    return Array.from(this.fields.values());
  }
  /**
   * Check if a field exists
   * @param fieldId The field ID
   * @returns true if the field exists, false otherwise
   */
  has(fieldId) {
    return this.fields.has(fieldId);
  }
  /**
   * Update a field (ID cannot be changed)
   * @param fieldId The field ID
   * @param updates Partial field updates
   * @returns The updated FieldInfo, or undefined if field not found
   * @throws Error if attempting to change the field ID
   */
  update(fieldId, updates) {
    const field = this.fields.get(fieldId);
    if (!field) {
      return void 0;
    }
    const updatedField = {
      ...field,
      ...updates,
      // Ensure these cannot be changed
      id: field.id,
      sheetId: field.sheetId,
      blockId: field.blockId
    };
    this.fields.set(fieldId, updatedField);
    return updatedField;
  }
  /**
   * Delete a field
   * @param fieldId The field ID
   * @returns true if the field was deleted, false if it didn't exist
   * @note The field ID will never be reused even after deletion
   */
  delete(fieldId) {
    return this.fields.delete(fieldId);
  }
  /**
   * Delete all fields for a specific block
   * @param sheetId The sheet ID
   * @param blockId The block ID
   * @returns Number of fields deleted
   */
  deleteBlock(sheetId, blockId) {
    const fieldsToDelete = this.getByBlock(sheetId, blockId);
    fieldsToDelete.forEach((field) => {
      this.delete(field.id);
    });
    return fieldsToDelete.length;
  }
  /**
   * Delete all fields for a specific sheet
   * @param sheetId The sheet ID
   * @returns Number of fields deleted
   */
  deleteSheet(sheetId) {
    const fieldsToDelete = this.getBySheet(sheetId);
    fieldsToDelete.forEach((field) => {
      this.delete(field.id);
    });
    return fieldsToDelete.length;
  }
  /**
   * Clear all fields
   * @note Field IDs remain reserved to prevent reuse
   */
  clear() {
    this.fields.clear();
  }
  /**
   * Get the total number of fields
   * @returns The count of fields
   */
  count() {
    return this.fields.size;
  }
  /**
   * Search fields by name (case-insensitive partial match)
   * @param query The search query
   * @returns Array of matching FieldInfo objects
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.fields.values()).filter(
      (field) => field.name.toLowerCase().includes(lowerQuery)
    );
  }
  /**
   * Import fields from JSON
   * @param json JSON string representation of fields
   * @throws Error if JSON is invalid
   */
  fromJSON(json) {
    try {
      const data = JSON.parse(json);
      this.fields = new Map(data.map((f) => [f.id, f]));
    } catch (error) {
      throw new Error(`Failed to import fields from JSON: ${error}`);
    }
  }
}

const LOGISHEETS_BUILTIN_CRAFT_ID = "logisheets";
const FIELD_AND_VALIDATION_TAG = 80;
class BlockManager {
  constructor(_workbookClient) {
    this._workbookClient = _workbookClient;
  }
  enumSetManager = new EnumSetManager();
  fieldManager = new FieldManager();
  getPersistentData(blockFields) {
    const fieldInfos = [];
    blockFields.forEach((f) => {
      const info = this.fieldManager.get(f.fieldId);
      if (info === void 0) return;
      fieldInfos.push(info);
    });
    const fieldInfosJson = JSON.stringify(fieldInfos);
    const enumSetJson = this.enumSetManager.toJSON();
    return JSON.stringify({ fields: fieldInfosJson, enumSets: enumSetJson });
  }
  parseAppData(data) {
    const { fields, enumSets } = JSON.parse(data);
    this.enumSetManager.fromJSON(enumSets);
    this.fieldManager.fromJSON(fields);
  }
}

let Range$1 = class Range {
  static fromMergeCell(mergeCell) {
    return new Range().setEndCol(mergeCell.endCol).setStartCol(mergeCell.startCol).setEndRow(mergeCell.endRow).setStartRow(mergeCell.startRow);
  }
  get width() {
    return this._endCol - this._startCol;
  }
  get height() {
    return this._endRow - this._startRow;
  }
  get startRow() {
    return this._startRow;
  }
  get startCol() {
    return this._startCol;
  }
  get endRow() {
    return this._endRow;
  }
  get endCol() {
    return this._endCol;
  }
  setStartRow(startRow) {
    this._startRow = startRow;
    return this;
  }
  setStartCol(startCol) {
    this._startCol = startCol;
    return this;
  }
  setEndRow(endRow) {
    this._endRow = endRow;
    return this;
  }
  setEndCol(endCol) {
    this._endCol = endCol;
    return this;
  }
  setStartEndRow(row) {
    this._startRow = row;
    this._endRow = row;
    return this;
  }
  setStartEndCol(col) {
    this._startCol = col;
    this._endCol = col;
    return this;
  }
  reset() {
    this.setEndCol(0).setEndRow(0).setStartCol(0).setStartRow(0);
  }
  cover(range) {
    return this._startRow <= range._startRow && this._startCol <= range._startCol && this._endRow >= range._endRow && this._endCol >= range._endCol;
  }
  equals(other) {
    return other._startRow === this._startRow && other._startCol === this._startCol && other._endCol === this._endCol && other._endRow === this._endRow;
  }
  _startRow = 0;
  _startCol = 0;
  _endRow = 0;
  _endCol = 0;
};
class Cell {
  constructor(type) {
    this.type = type;
  }
  get width() {
    return this.position.width;
  }
  get height() {
    return this.position.height;
  }
  setCoordinate(coordinate) {
    this.coordinate = coordinate;
    return this;
  }
  setPosition(position) {
    this.position = position;
    return this;
  }
  equals(cell) {
    return cell.type === this.type && this.position.equals(cell.position);
  }
  coordinate = new Range$1();
  position = new Range$1();
  info;
}
const DEFAULT_ENGINE_CONFIG = {
  leftTopWidth: 32,
  leftTopHeight: 24,
  showHorizontalGridLines: true,
  showVerticalGridLines: true,
  defaultCellWidth: 6,
  defaultCellHeight: 25,
  scrollbarSize: 16
};

const node_env = globalThis.process?.env?.NODE_ENV;
const DEV = node_env && !node_env.toLowerCase().startsWith('prod');

// Store the references to globals in case someone tries to monkey patch these, causing the below
// to de-opt (this occurs often when using popular extensions).
var is_array = Array.isArray;
var index_of = Array.prototype.indexOf;
var includes = Array.prototype.includes;
var array_from = Array.from;
var define_property = Object.defineProperty;
var get_descriptor = Object.getOwnPropertyDescriptor;
var get_descriptors = Object.getOwnPropertyDescriptors;
var object_prototype = Object.prototype;
var array_prototype = Array.prototype;
var get_prototype_of = Object.getPrototypeOf;
var is_extensible = Object.isExtensible;

/**
 * @param {any} thing
 * @returns {thing is Function}
 */
function is_function(thing) {
	return typeof thing === 'function';
}

/** @param {Array<() => void>} arr */
function run_all(arr) {
	for (var i = 0; i < arr.length; i++) {
		arr[i]();
	}
}

/**
 * TODO replace with Promise.withResolvers once supported widely enough
 * @template [T=void]
 */
function deferred() {
	/** @type {(value: T) => void} */
	var resolve;

	/** @type {(reason: any) => void} */
	var reject;

	/** @type {Promise<T>} */
	var promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});

	// @ts-expect-error
	return { promise, resolve, reject };
}

// General flags
const DERIVED = 1 << 1;
const EFFECT = 1 << 2;
const RENDER_EFFECT = 1 << 3;
/**
 * An effect that does not destroy its child effects when it reruns.
 * Runs as part of render effects, i.e. not eagerly as part of tree traversal or effect flushing.
 */
const MANAGED_EFFECT = 1 << 24;
/**
 * An effect that does not destroy its child effects when it reruns (like MANAGED_EFFECT).
 * Runs eagerly as part of tree traversal or effect flushing.
 */
const BLOCK_EFFECT = 1 << 4;
const BRANCH_EFFECT = 1 << 5;
const ROOT_EFFECT = 1 << 6;
const BOUNDARY_EFFECT = 1 << 7;
/**
 * Indicates that a reaction is connected to an effect root — either it is an effect,
 * or it is a derived that is depended on by at least one effect. If a derived has
 * no dependents, we can disconnect it from the graph, allowing it to either be
 * GC'd or reconnected later if an effect comes to depend on it again
 */
const CONNECTED = 1 << 9;
const CLEAN = 1 << 10;
const DIRTY = 1 << 11;
const MAYBE_DIRTY = 1 << 12;
const INERT = 1 << 13;
const DESTROYED = 1 << 14;

// Flags exclusive to effects
/** Set once an effect that should run synchronously has run */
const EFFECT_RAN = 1 << 15;
/**
 * 'Transparent' effects do not create a transition boundary.
 * This is on a block effect 99% of the time but may also be on a branch effect if its parent block effect was pruned
 */
const EFFECT_TRANSPARENT = 1 << 16;
const EAGER_EFFECT = 1 << 17;
const HEAD_EFFECT = 1 << 18;
const EFFECT_PRESERVED = 1 << 19;
const USER_EFFECT = 1 << 20;
const EFFECT_OFFSCREEN = 1 << 25;

// Flags exclusive to deriveds
/**
 * Tells that we marked this derived and its reactions as visited during the "mark as (maybe) dirty"-phase.
 * Will be lifted during execution of the derived and during checking its dirty state (both are necessary
 * because a derived might be checked but not executed).
 */
const WAS_MARKED = 1 << 15;

// Flags used for async
const REACTION_IS_UPDATING = 1 << 21;
const ASYNC = 1 << 22;

const ERROR_VALUE = 1 << 23;

const STATE_SYMBOL = Symbol('$state');
const LEGACY_PROPS = Symbol('legacy props');
const LOADING_ATTR_SYMBOL = Symbol('');
const PROXY_PATH_SYMBOL = Symbol('proxy path');

/** allow users to ignore aborted signal errors if `reason.name === 'StaleReactionError` */
const STALE_REACTION = new (class StaleReactionError extends Error {
	name = 'StaleReactionError';
	message = 'The reaction that called `getAbortSignal()` was re-run or destroyed';
})();

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * `%name%(...)` can only be used during component initialisation
 * @param {string} name
 * @returns {never}
 */
function lifecycle_outside_component(name) {
	if (DEV) {
		const error = new Error(`lifecycle_outside_component\n\`${name}(...)\` can only be used during component initialisation\nhttps://svelte.dev/e/lifecycle_outside_component`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/lifecycle_outside_component`);
	}
}

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


/**
 * Cannot create a `$derived(...)` with an `await` expression outside of an effect tree
 * @returns {never}
 */
function async_derived_orphan() {
	if (DEV) {
		const error = new Error(`async_derived_orphan\nCannot create a \`$derived(...)\` with an \`await\` expression outside of an effect tree\nhttps://svelte.dev/e/async_derived_orphan`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/async_derived_orphan`);
	}
}

/**
 * Using `bind:value` together with a checkbox input is not allowed. Use `bind:checked` instead
 * @returns {never}
 */
function bind_invalid_checkbox_value() {
	if (DEV) {
		const error = new Error(`bind_invalid_checkbox_value\nUsing \`bind:value\` together with a checkbox input is not allowed. Use \`bind:checked\` instead\nhttps://svelte.dev/e/bind_invalid_checkbox_value`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/bind_invalid_checkbox_value`);
	}
}

/**
 * A derived value cannot reference itself recursively
 * @returns {never}
 */
function derived_references_self() {
	if (DEV) {
		const error = new Error(`derived_references_self\nA derived value cannot reference itself recursively\nhttps://svelte.dev/e/derived_references_self`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/derived_references_self`);
	}
}

/**
 * `%rune%` cannot be used inside an effect cleanup function
 * @param {string} rune
 * @returns {never}
 */
function effect_in_teardown(rune) {
	if (DEV) {
		const error = new Error(`effect_in_teardown\n\`${rune}\` cannot be used inside an effect cleanup function\nhttps://svelte.dev/e/effect_in_teardown`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_in_teardown`);
	}
}

/**
 * Effect cannot be created inside a `$derived` value that was not itself created inside an effect
 * @returns {never}
 */
function effect_in_unowned_derived() {
	if (DEV) {
		const error = new Error(`effect_in_unowned_derived\nEffect cannot be created inside a \`$derived\` value that was not itself created inside an effect\nhttps://svelte.dev/e/effect_in_unowned_derived`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_in_unowned_derived`);
	}
}

/**
 * `%rune%` can only be used inside an effect (e.g. during component initialisation)
 * @param {string} rune
 * @returns {never}
 */
function effect_orphan(rune) {
	if (DEV) {
		const error = new Error(`effect_orphan\n\`${rune}\` can only be used inside an effect (e.g. during component initialisation)\nhttps://svelte.dev/e/effect_orphan`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_orphan`);
	}
}

/**
 * Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state
 * @returns {never}
 */
function effect_update_depth_exceeded() {
	if (DEV) {
		const error = new Error(`effect_update_depth_exceeded\nMaximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state\nhttps://svelte.dev/e/effect_update_depth_exceeded`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
	}
}

/**
 * Cannot do `bind:%key%={undefined}` when `%key%` has a fallback value
 * @param {string} key
 * @returns {never}
 */
function props_invalid_value(key) {
	if (DEV) {
		const error = new Error(`props_invalid_value\nCannot do \`bind:${key}={undefined}\` when \`${key}\` has a fallback value\nhttps://svelte.dev/e/props_invalid_value`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/props_invalid_value`);
	}
}

/**
 * The `%rune%` rune is only available inside `.svelte` and `.svelte.js/ts` files
 * @param {string} rune
 * @returns {never}
 */
function rune_outside_svelte(rune) {
	if (DEV) {
		const error = new Error(`rune_outside_svelte\nThe \`${rune}\` rune is only available inside \`.svelte\` and \`.svelte.js/ts\` files\nhttps://svelte.dev/e/rune_outside_svelte`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/rune_outside_svelte`);
	}
}

/**
 * Property descriptors defined on `$state` objects must contain `value` and always be `enumerable`, `configurable` and `writable`.
 * @returns {never}
 */
function state_descriptors_fixed() {
	if (DEV) {
		const error = new Error(`state_descriptors_fixed\nProperty descriptors defined on \`$state\` objects must contain \`value\` and always be \`enumerable\`, \`configurable\` and \`writable\`.\nhttps://svelte.dev/e/state_descriptors_fixed`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
	}
}

/**
 * Cannot set prototype of `$state` object
 * @returns {never}
 */
function state_prototype_fixed() {
	if (DEV) {
		const error = new Error(`state_prototype_fixed\nCannot set prototype of \`$state\` object\nhttps://svelte.dev/e/state_prototype_fixed`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
	}
}

/**
 * Updating state inside `$derived(...)`, `$inspect(...)` or a template expression is forbidden. If the value should not be reactive, declare it without `$state`
 * @returns {never}
 */
function state_unsafe_mutation() {
	if (DEV) {
		const error = new Error(`state_unsafe_mutation\nUpdating state inside \`$derived(...)\`, \`$inspect(...)\` or a template expression is forbidden. If the value should not be reactive, declare it without \`$state\`\nhttps://svelte.dev/e/state_unsafe_mutation`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
	}
}

/**
 * A `<svelte:boundary>` `reset` function cannot be called while an error is still being handled
 * @returns {never}
 */
function svelte_boundary_reset_onerror() {
	if (DEV) {
		const error = new Error(`svelte_boundary_reset_onerror\nA \`<svelte:boundary>\` \`reset\` function cannot be called while an error is still being handled\nhttps://svelte.dev/e/svelte_boundary_reset_onerror`);

		error.name = 'Svelte error';

		throw error;
	} else {
		throw new Error(`https://svelte.dev/e/svelte_boundary_reset_onerror`);
	}
}

const EACH_ITEM_REACTIVE = 1;
const EACH_INDEX_REACTIVE = 1 << 1;
/** See EachBlock interface metadata.is_controlled for an explanation what this is */
const EACH_IS_CONTROLLED = 1 << 2;
const EACH_IS_ANIMATED = 1 << 3;
const EACH_ITEM_IMMUTABLE = 1 << 4;

const PROPS_IS_IMMUTABLE = 1;
const PROPS_IS_UPDATED = 1 << 2;
const PROPS_IS_BINDABLE = 1 << 3;
const PROPS_IS_LAZY_INITIAL = 1 << 4;

const TEMPLATE_FRAGMENT = 1;
const TEMPLATE_USE_IMPORT_NODE = 1 << 1;

const UNINITIALIZED = Symbol();

// Dev-time component properties
const FILENAME = Symbol('filename');

const NAMESPACE_HTML = 'http://www.w3.org/1999/xhtml';

/* This file is generated by scripts/process-messages/index.js. Do not edit! */


var bold = 'font-weight: bold';
var normal = 'font-weight: normal';

/**
 * Tried to unmount a component that was not mounted
 */
function lifecycle_double_unmount() {
	if (DEV) {
		console.warn(`%c[svelte] lifecycle_double_unmount\n%cTried to unmount a component that was not mounted\nhttps://svelte.dev/e/lifecycle_double_unmount`, bold, normal);
	} else {
		console.warn(`https://svelte.dev/e/lifecycle_double_unmount`);
	}
}

/**
 * Reactive `$state(...)` proxies and the values they proxy have different identities. Because of this, comparisons with `%operator%` will produce unexpected results
 * @param {string} operator
 */
function state_proxy_equality_mismatch(operator) {
	if (DEV) {
		console.warn(`%c[svelte] state_proxy_equality_mismatch\n%cReactive \`$state(...)\` proxies and the values they proxy have different identities. Because of this, comparisons with \`${operator}\` will produce unexpected results\nhttps://svelte.dev/e/state_proxy_equality_mismatch`, bold, normal);
	} else {
		console.warn(`https://svelte.dev/e/state_proxy_equality_mismatch`);
	}
}

/**
 * Tried to unmount a state proxy, rather than a component
 */
function state_proxy_unmount() {
	if (DEV) {
		console.warn(`%c[svelte] state_proxy_unmount\n%cTried to unmount a state proxy, rather than a component\nhttps://svelte.dev/e/state_proxy_unmount`, bold, normal);
	} else {
		console.warn(`https://svelte.dev/e/state_proxy_unmount`);
	}
}

/**
 * A `<svelte:boundary>` `reset` function only resets the boundary the first time it is called
 */
function svelte_boundary_reset_noop() {
	if (DEV) {
		console.warn(`%c[svelte] svelte_boundary_reset_noop\n%cA \`<svelte:boundary>\` \`reset\` function only resets the boundary the first time it is called\nhttps://svelte.dev/e/svelte_boundary_reset_noop`, bold, normal);
	} else {
		console.warn(`https://svelte.dev/e/svelte_boundary_reset_noop`);
	}
}

/** @import { Equals } from '#client' */

/** @type {Equals} */
function equals(value) {
	return value === this.v;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function safe_not_equal(a, b) {
	return a != a
		? b == b
		: a !== b || (a !== null && typeof a === 'object') || typeof a === 'function';
}

/** @type {Equals} */
function safe_equals(value) {
	return !safe_not_equal(value, this.v);
}

/** True if experimental.async=true */
/** True if $inspect.trace is used */
let tracing_mode_flag = false;

/** @import { Derived, Reaction, Value } from '#client' */

/**
 * @param {Value} source
 * @param {string} label
 */
function tag(source, label) {
	source.label = label;
	tag_proxy(source.v, label);

	return source;
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function tag_proxy(value, label) {
	// @ts-expect-error
	value?.[PROXY_PATH_SYMBOL]?.(label);
	return value;
}

/**
 * @param {string} label
 * @returns {Error & { stack: string } | null}
 */
function get_error(label) {
	const error = new Error();
	const stack = get_stack();

	if (stack.length === 0) {
		return null;
	}

	stack.unshift('\n');

	define_property(error, 'stack', {
		value: stack.join('\n')
	});

	define_property(error, 'name', {
		value: label
	});

	return /** @type {Error & { stack: string }} */ (error);
}

/**
 * @returns {string[]}
 */
function get_stack() {
	// @ts-ignore - doesn't exist everywhere
	const limit = Error.stackTraceLimit;
	// @ts-ignore - doesn't exist everywhere
	Error.stackTraceLimit = Infinity;
	const stack = new Error().stack;
	// @ts-ignore - doesn't exist everywhere
	Error.stackTraceLimit = limit;

	if (!stack) return [];

	const lines = stack.split('\n');
	const new_lines = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const posixified = line.replaceAll('\\', '/');

		if (line.trim() === 'Error') {
			continue;
		}

		if (line.includes('validate_each_keys')) {
			return [];
		}

		if (posixified.includes('svelte/src/internal') || posixified.includes('node_modules/.vite')) {
			continue;
		}

		new_lines.push(line);
	}

	return new_lines;
}

/** @import { ComponentContext, DevStackEntry, Effect } from '#client' */

/** @type {ComponentContext | null} */
let component_context = null;

/** @param {ComponentContext | null} context */
function set_component_context(context) {
	component_context = context;
}

/** @type {DevStackEntry | null} */
let dev_stack = null;

/** @param {DevStackEntry | null} stack */
function set_dev_stack(stack) {
	dev_stack = stack;
}

/**
 * The current component function. Different from current component context:
 * ```html
 * <!-- App.svelte -->
 * <Foo>
 *   <Bar /> <!-- context == Foo.svelte, function == App.svelte -->
 * </Foo>
 * ```
 * @type {ComponentContext['function']}
 */
let dev_current_component_function = null;

/** @param {ComponentContext['function']} fn */
function set_dev_current_component_function(fn) {
	dev_current_component_function = fn;
}

/**
 * @param {Record<string, unknown>} props
 * @param {any} runes
 * @param {Function} [fn]
 * @returns {void}
 */
function push(props, runes = false, fn) {
	component_context = {
		p: component_context,
		i: false,
		c: null,
		e: null,
		s: props,
		x: null,
		l: null
	};

	if (DEV) {
		// component function
		component_context.function = fn;
		dev_current_component_function = fn;
	}
}

/**
 * @template {Record<string, any>} T
 * @param {T} [component]
 * @returns {T}
 */
function pop(component) {
	var context = /** @type {ComponentContext} */ (component_context);
	var effects = context.e;

	if (effects !== null) {
		context.e = null;

		for (var fn of effects) {
			create_user_effect(fn);
		}
	}

	if (component !== undefined) {
		context.x = component;
	}

	context.i = true;

	component_context = context.p;

	if (DEV) {
		dev_current_component_function = component_context?.function ?? null;
	}

	return component ?? /** @type {T} */ ({});
}

/** @returns {boolean} */
function is_runes() {
	return true;
}

/** @type {Array<() => void>} */
let micro_tasks = [];

function run_micro_tasks() {
	var tasks = micro_tasks;
	micro_tasks = [];
	run_all(tasks);
}

/**
 * @param {() => void} fn
 */
function queue_micro_task(fn) {
	if (micro_tasks.length === 0 && !is_flushing_sync) {
		var tasks = micro_tasks;
		queueMicrotask(() => {
			// If this is false, a flushSync happened in the meantime. Do _not_ run new scheduled microtasks in that case
			// as the ordering of microtasks would be broken at that point - consider this case:
			// - queue_micro_task schedules microtask A to flush task X
			// - synchronously after, flushSync runs, processing task X
			// - synchronously after, some other microtask B is scheduled, but not through queue_micro_task but for example a Promise.resolve() in user code
			// - synchronously after, queue_micro_task schedules microtask C to flush task Y
			// - one tick later, microtask A now resolves, flushing task Y before microtask B, which is incorrect
			// This if check prevents that race condition (that realistically will only happen in tests)
			if (tasks === micro_tasks) run_micro_tasks();
		});
	}

	micro_tasks.push(fn);
}

/**
 * Synchronously run any queued tasks.
 */
function flush_tasks() {
	while (micro_tasks.length > 0) {
		run_micro_tasks();
	}
}

/** @import { Derived, Effect } from '#client' */
/** @import { Boundary } from './dom/blocks/boundary.js' */

const adjustments = new WeakMap();

/**
 * @param {unknown} error
 */
function handle_error(error) {
	var effect = active_effect;

	// for unowned deriveds, don't throw until we read the value
	if (effect === null) {
		/** @type {Derived} */ (active_reaction).f |= ERROR_VALUE;
		return error;
	}

	if (DEV && error instanceof Error && !adjustments.has(error)) {
		adjustments.set(error, get_adjustments(error, effect));
	}

	if ((effect.f & EFFECT_RAN) === 0) {
		// if the error occurred while creating this subtree, we let it
		// bubble up until it hits a boundary that can handle it
		if ((effect.f & BOUNDARY_EFFECT) === 0) {
			if (DEV && !effect.parent && error instanceof Error) {
				apply_adjustments(error);
			}

			throw error;
		}

		/** @type {Boundary} */ (effect.b).error(error);
	} else {
		// otherwise we bubble up the effect tree ourselves
		invoke_error_boundary(error, effect);
	}
}

/**
 * @param {unknown} error
 * @param {Effect | null} effect
 */
function invoke_error_boundary(error, effect) {
	while (effect !== null) {
		if ((effect.f & BOUNDARY_EFFECT) !== 0) {
			try {
				/** @type {Boundary} */ (effect.b).error(error);
				return;
			} catch (e) {
				error = e;
			}
		}

		effect = effect.parent;
	}

	if (DEV && error instanceof Error) {
		apply_adjustments(error);
	}

	throw error;
}

/**
 * Add useful information to the error message/stack in development
 * @param {Error} error
 * @param {Effect} effect
 */
function get_adjustments(error, effect) {
	const message_descriptor = get_descriptor(error, 'message');

	// if the message was already changed and it's not configurable we can't change it
	// or it will throw a different error swallowing the original error
	if (message_descriptor && !message_descriptor.configurable) return;

	var indent = is_firefox ? '  ' : '\t';
	var component_stack = `\n${indent}in ${effect.fn?.name || '<unknown>'}`;
	var context = effect.ctx;

	while (context !== null) {
		component_stack += `\n${indent}in ${context.function?.[FILENAME].split('/').pop()}`;
		context = context.p;
	}

	return {
		message: error.message + `\n${component_stack}\n`,
		stack: error.stack
			?.split('\n')
			.filter((line) => !line.includes('svelte/src/internal'))
			.join('\n')
	};
}

/**
 * @param {Error} error
 */
function apply_adjustments(error) {
	const adjusted = adjustments.get(error);

	if (adjusted) {
		define_property(error, 'message', {
			value: adjusted.message
		});

		define_property(error, 'stack', {
			value: adjusted.stack
		});
	}
}

/** @import { Derived, Signal } from '#client' */

const STATUS_MASK = -7169;

/**
 * @param {Signal} signal
 * @param {number} status
 */
function set_signal_status(signal, status) {
	signal.f = (signal.f & STATUS_MASK) | status;
}

/**
 * Set a derived's status to CLEAN or MAYBE_DIRTY based on its connection state.
 * @param {Derived} derived
 */
function update_derived_status(derived) {
	// Only mark as MAYBE_DIRTY if disconnected and has dependencies.
	if ((derived.f & CONNECTED) !== 0 || derived.deps === null) {
		set_signal_status(derived, CLEAN);
	} else {
		set_signal_status(derived, MAYBE_DIRTY);
	}
}

/** @import { Derived, Effect, Value } from '#client' */

/**
 * @param {Value[] | null} deps
 */
function clear_marked(deps) {
	if (deps === null) return;

	for (const dep of deps) {
		if ((dep.f & DERIVED) === 0 || (dep.f & WAS_MARKED) === 0) {
			continue;
		}

		dep.f ^= WAS_MARKED;

		clear_marked(/** @type {Derived} */ (dep).deps);
	}
}

/**
 * @param {Effect} effect
 * @param {Set<Effect>} dirty_effects
 * @param {Set<Effect>} maybe_dirty_effects
 */
function defer_effect(effect, dirty_effects, maybe_dirty_effects) {
	if ((effect.f & DIRTY) !== 0) {
		dirty_effects.add(effect);
	} else if ((effect.f & MAYBE_DIRTY) !== 0) {
		maybe_dirty_effects.add(effect);
	}

	// Since we're not executing these effects now, we need to clear any WAS_MARKED flags
	// so that other batches can correctly reach these effects during their own traversal
	clear_marked(effect.deps);

	// mark as clean so they get scheduled if they depend on pending async state
	set_signal_status(effect, CLEAN);
}

/** @import { Fork } from 'svelte' */
/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */
/** @import { Boundary } from '../dom/blocks/boundary' */

/** @type {Set<Batch>} */
const batches = new Set();

/** @type {Batch | null} */
let current_batch = null;

/**
 * This is needed to avoid overwriting inputs in non-async mode
 * TODO 6.0 remove this, as non-async mode will go away
 * @type {Batch | null}
 */
let previous_batch = null;

/**
 * When time travelling (i.e. working in one batch, while other batches
 * still have ongoing work), we ignore the real values of affected
 * signals in favour of their values within the batch
 * @type {Map<Value, any> | null}
 */
let batch_values = null;

// TODO this should really be a property of `batch`
/** @type {Effect[]} */
let queued_root_effects = [];

/** @type {Effect | null} */
let last_scheduled_effect = null;

let is_flushing = false;
let is_flushing_sync = false;

class Batch {
	committed = false;

	/**
	 * The current values of any sources that are updated in this batch
	 * They keys of this map are identical to `this.#previous`
	 * @type {Map<Source, any>}
	 */
	current = new Map();

	/**
	 * The values of any sources that are updated in this batch _before_ those updates took place.
	 * They keys of this map are identical to `this.#current`
	 * @type {Map<Source, any>}
	 */
	previous = new Map();

	/**
	 * When the batch is committed (and the DOM is updated), we need to remove old branches
	 * and append new ones by calling the functions added inside (if/each/key/etc) blocks
	 * @type {Set<() => void>}
	 */
	#commit_callbacks = new Set();

	/**
	 * If a fork is discarded, we need to destroy any effects that are no longer needed
	 * @type {Set<(batch: Batch) => void>}
	 */
	#discard_callbacks = new Set();

	/**
	 * The number of async effects that are currently in flight
	 */
	#pending = 0;

	/**
	 * The number of async effects that are currently in flight, _not_ inside a pending boundary
	 */
	#blocking_pending = 0;

	/**
	 * A deferred that resolves when the batch is committed, used with `settled()`
	 * TODO replace with Promise.withResolvers once supported widely enough
	 * @type {{ promise: Promise<void>, resolve: (value?: any) => void, reject: (reason: unknown) => void } | null}
	 */
	#deferred = null;

	/**
	 * Deferred effects (which run after async work has completed) that are DIRTY
	 * @type {Set<Effect>}
	 */
	#dirty_effects = new Set();

	/**
	 * Deferred effects that are MAYBE_DIRTY
	 * @type {Set<Effect>}
	 */
	#maybe_dirty_effects = new Set();

	/**
	 * A set of branches that still exist, but will be destroyed when this batch
	 * is committed — we skip over these during `process`
	 * @type {Set<Effect>}
	 */
	skipped_effects = new Set();

	is_fork = false;

	#decrement_queued = false;

	is_deferred() {
		return this.is_fork || this.#blocking_pending > 0;
	}

	/**
	 *
	 * @param {Effect[]} root_effects
	 */
	process(root_effects) {
		queued_root_effects = [];

		this.apply();

		/** @type {Effect[]} */
		var effects = [];

		/** @type {Effect[]} */
		var render_effects = [];

		for (const root of root_effects) {
			this.#traverse_effect_tree(root, effects, render_effects);
			// Note: #traverse_effect_tree runs block effects eagerly, which can schedule effects,
			// which means queued_root_effects now may be filled again.

			// Helpful for debugging reactivity loss that has to do with branches being skipped:
			// log_inconsistent_branches(root);
		}

		if (this.is_deferred()) {
			this.#defer_effects(render_effects);
			this.#defer_effects(effects);

			for (const e of this.skipped_effects) {
				reset_branch(e);
			}
		} else {
			// append/remove branches
			for (const fn of this.#commit_callbacks) fn();
			this.#commit_callbacks.clear();

			if (this.#pending === 0) {
				this.#commit();
			}

			// If sources are written to, then work needs to happen in a separate batch, else prior sources would be mixed with
			// newly updated sources, which could lead to infinite loops when effects run over and over again.
			previous_batch = this;
			current_batch = null;

			flush_queued_effects(render_effects);
			flush_queued_effects(effects);

			previous_batch = null;

			this.#deferred?.resolve();
		}

		batch_values = null;
	}

	/**
	 * Traverse the effect tree, executing effects or stashing
	 * them for later execution as appropriate
	 * @param {Effect} root
	 * @param {Effect[]} effects
	 * @param {Effect[]} render_effects
	 */
	#traverse_effect_tree(root, effects, render_effects) {
		root.f ^= CLEAN;

		var effect = root.first;

		/** @type {Effect | null} */
		var pending_boundary = null;

		while (effect !== null) {
			var flags = effect.f;
			var is_branch = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) !== 0;
			var is_skippable_branch = is_branch && (flags & CLEAN) !== 0;

			var skip = is_skippable_branch || (flags & INERT) !== 0 || this.skipped_effects.has(effect);

			if (!skip && effect.fn !== null) {
				if (is_branch) {
					effect.f ^= CLEAN;
				} else if (
					pending_boundary !== null &&
					(flags & (EFFECT | RENDER_EFFECT | MANAGED_EFFECT)) !== 0
				) {
					/** @type {Boundary} */ (pending_boundary.b).defer_effect(effect);
				} else if ((flags & EFFECT) !== 0) {
					effects.push(effect);
				} else if (is_dirty(effect)) {
					if ((flags & BLOCK_EFFECT) !== 0) this.#maybe_dirty_effects.add(effect);
					update_effect(effect);
				}

				var child = effect.first;

				if (child !== null) {
					effect = child;
					continue;
				}
			}

			var parent = effect.parent;
			effect = effect.next;

			while (effect === null && parent !== null) {
				if (parent === pending_boundary) {
					pending_boundary = null;
				}

				effect = parent.next;
				parent = parent.parent;
			}
		}
	}

	/**
	 * @param {Effect[]} effects
	 */
	#defer_effects(effects) {
		for (var i = 0; i < effects.length; i += 1) {
			defer_effect(effects[i], this.#dirty_effects, this.#maybe_dirty_effects);
		}
	}

	/**
	 * Associate a change to a given source with the current
	 * batch, noting its previous and current values
	 * @param {Source} source
	 * @param {any} value
	 */
	capture(source, value) {
		if (value !== UNINITIALIZED && !this.previous.has(source)) {
			this.previous.set(source, value);
		}

		// Don't save errors in `batch_values`, or they won't be thrown in `runtime.js#get`
		if ((source.f & ERROR_VALUE) === 0) {
			this.current.set(source, source.v);
			batch_values?.set(source, source.v);
		}
	}

	activate() {
		current_batch = this;
		this.apply();
	}

	deactivate() {
		// If we're not the current batch, don't deactivate,
		// else we could create zombie batches that are never flushed
		if (current_batch !== this) return;

		current_batch = null;
		batch_values = null;
	}

	flush() {
		this.activate();

		if (queued_root_effects.length > 0) {
			flush_effects();

			if (current_batch !== null && current_batch !== this) {
				// this can happen if a new batch was created during `flush_effects()`
				return;
			}
		} else if (this.#pending === 0) {
			this.process([]); // TODO this feels awkward
		}

		this.deactivate();
	}

	discard() {
		for (const fn of this.#discard_callbacks) fn(this);
		this.#discard_callbacks.clear();
	}

	#commit() {
		// If there are other pending batches, they now need to be 'rebased' —
		// in other words, we re-run block/async effects with the newly
		// committed state, unless the batch in question has a more
		// recent value for a given source
		if (batches.size > 1) {
			this.previous.clear();

			var previous_batch_values = batch_values;
			var is_earlier = true;

			for (const batch of batches) {
				if (batch === this) {
					is_earlier = false;
					continue;
				}

				/** @type {Source[]} */
				const sources = [];

				for (const [source, value] of this.current) {
					if (batch.current.has(source)) {
						if (is_earlier && value !== batch.current.get(source)) {
							// bring the value up to date
							batch.current.set(source, value);
						} else {
							// same value or later batch has more recent value,
							// no need to re-run these effects
							continue;
						}
					}

					sources.push(source);
				}

				if (sources.length === 0) {
					continue;
				}

				// Re-run async/block effects that depend on distinct values changed in both batches
				const others = [...batch.current.keys()].filter((s) => !this.current.has(s));
				if (others.length > 0) {
					// Avoid running queued root effects on the wrong branch
					var prev_queued_root_effects = queued_root_effects;
					queued_root_effects = [];

					/** @type {Set<Value>} */
					const marked = new Set();
					/** @type {Map<Reaction, boolean>} */
					const checked = new Map();
					for (const source of sources) {
						mark_effects(source, others, marked, checked);
					}

					if (queued_root_effects.length > 0) {
						current_batch = batch;
						batch.apply();

						for (const root of queued_root_effects) {
							batch.#traverse_effect_tree(root, [], []);
						}

						// TODO do we need to do anything with the dummy effect arrays?

						batch.deactivate();
					}

					queued_root_effects = prev_queued_root_effects;
				}
			}

			current_batch = null;
			batch_values = previous_batch_values;
		}

		this.committed = true;
		batches.delete(this);
	}

	/**
	 *
	 * @param {boolean} blocking
	 */
	increment(blocking) {
		this.#pending += 1;
		if (blocking) this.#blocking_pending += 1;
	}

	/**
	 *
	 * @param {boolean} blocking
	 */
	decrement(blocking) {
		this.#pending -= 1;
		if (blocking) this.#blocking_pending -= 1;

		if (this.#decrement_queued) return;
		this.#decrement_queued = true;

		queue_micro_task(() => {
			this.#decrement_queued = false;

			if (!this.is_deferred()) {
				// we only reschedule previously-deferred effects if we expect
				// to be able to run them after processing the batch
				this.revive();
			} else if (queued_root_effects.length > 0) {
				// if other effects are scheduled, process the batch _without_
				// rescheduling the previously-deferred effects
				this.flush();
			}
		});
	}

	revive() {
		for (const e of this.#dirty_effects) {
			this.#maybe_dirty_effects.delete(e);
			set_signal_status(e, DIRTY);
			schedule_effect(e);
		}

		for (const e of this.#maybe_dirty_effects) {
			set_signal_status(e, MAYBE_DIRTY);
			schedule_effect(e);
		}

		this.flush();
	}

	/** @param {() => void} fn */
	oncommit(fn) {
		this.#commit_callbacks.add(fn);
	}

	/** @param {(batch: Batch) => void} fn */
	ondiscard(fn) {
		this.#discard_callbacks.add(fn);
	}

	settled() {
		return (this.#deferred ??= deferred()).promise;
	}

	static ensure() {
		if (current_batch === null) {
			const batch = (current_batch = new Batch());
			batches.add(current_batch);

			if (!is_flushing_sync) {
				queue_micro_task(() => {
					if (current_batch !== batch) {
						// a flushSync happened in the meantime
						return;
					}

					batch.flush();
				});
			}
		}

		return current_batch;
	}

	apply() {
		return;
	}
}

/**
 * Synchronously flush any pending updates.
 * Returns void if no callback is provided, otherwise returns the result of calling the callback.
 * @template [T=void]
 * @param {(() => T) | undefined} [fn]
 * @returns {T}
 */
function flushSync(fn) {
	var was_flushing_sync = is_flushing_sync;
	is_flushing_sync = true;

	try {
		var result;

		if (fn) ;

		while (true) {
			flush_tasks();

			if (queued_root_effects.length === 0) {
				current_batch?.flush();

				// we need to check again, in case we just updated an `$effect.pending()`
				if (queued_root_effects.length === 0) {
					// this would be reset in `flush_effects()` but since we are early returning here,
					// we need to reset it here as well in case the first time there's 0 queued root effects
					last_scheduled_effect = null;

					return /** @type {T} */ (result);
				}
			}

			flush_effects();
		}
	} finally {
		is_flushing_sync = was_flushing_sync;
	}
}

function flush_effects() {
	is_flushing = true;

	var source_stacks = DEV ? new Set() : null;

	try {
		var flush_count = 0;

		while (queued_root_effects.length > 0) {
			var batch = Batch.ensure();

			if (flush_count++ > 1000) {
				if (DEV) {
					var updates = new Map();

					for (const source of batch.current.keys()) {
						for (const [stack, update] of source.updated ?? []) {
							var entry = updates.get(stack);

							if (!entry) {
								entry = { error: update.error, count: 0 };
								updates.set(stack, entry);
							}

							entry.count += update.count;
						}
					}

					for (const update of updates.values()) {
						if (update.error) {
							// eslint-disable-next-line no-console
							console.error(update.error);
						}
					}
				}

				infinite_loop_guard();
			}

			batch.process(queued_root_effects);
			old_values.clear();

			if (DEV) {
				for (const source of batch.current.keys()) {
					/** @type {Set<Source>} */ (source_stacks).add(source);
				}
			}
		}
	} finally {
		is_flushing = false;

		last_scheduled_effect = null;

		if (DEV) {
			for (const source of /** @type {Set<Source>} */ (source_stacks)) {
				source.updated = null;
			}
		}
	}
}

function infinite_loop_guard() {
	try {
		effect_update_depth_exceeded();
	} catch (error) {
		if (DEV) {
			// stack contains no useful information, replace it
			define_property(error, 'stack', { value: '' });
		}

		// Best effort: invoke the boundary nearest the most recent
		// effect and hope that it's relevant to the infinite loop
		invoke_error_boundary(error, last_scheduled_effect);
	}
}

/** @type {Set<Effect> | null} */
let eager_block_effects = null;

/**
 * @param {Array<Effect>} effects
 * @returns {void}
 */
function flush_queued_effects(effects) {
	var length = effects.length;
	if (length === 0) return;

	var i = 0;

	while (i < length) {
		var effect = effects[i++];

		if ((effect.f & (DESTROYED | INERT)) === 0 && is_dirty(effect)) {
			eager_block_effects = new Set();

			update_effect(effect);

			// Effects with no dependencies or teardown do not get added to the effect tree.
			// Deferred effects (e.g. `$effect(...)`) _are_ added to the tree because we
			// don't know if we need to keep them until they are executed. Doing the check
			// here (rather than in `update_effect`) allows us to skip the work for
			// immediate effects.
			if (effect.deps === null && effect.first === null && effect.nodes === null) {
				// if there's no teardown or abort controller we completely unlink
				// the effect from the graph
				if (effect.teardown === null && effect.ac === null) {
					// remove this effect from the graph
					unlink_effect(effect);
				} else {
					// keep the effect in the graph, but free up some memory
					effect.fn = null;
				}
			}

			// If update_effect() has a flushSync() in it, we may have flushed another flush_queued_effects(),
			// which already handled this logic and did set eager_block_effects to null.
			if (eager_block_effects?.size > 0) {
				old_values.clear();

				for (const e of eager_block_effects) {
					// Skip eager effects that have already been unmounted
					if ((e.f & (DESTROYED | INERT)) !== 0) continue;

					// Run effects in order from ancestor to descendant, else we could run into nullpointers
					/** @type {Effect[]} */
					const ordered_effects = [e];
					let ancestor = e.parent;
					while (ancestor !== null) {
						if (eager_block_effects.has(ancestor)) {
							eager_block_effects.delete(ancestor);
							ordered_effects.push(ancestor);
						}
						ancestor = ancestor.parent;
					}

					for (let j = ordered_effects.length - 1; j >= 0; j--) {
						const e = ordered_effects[j];
						// Skip eager effects that have already been unmounted
						if ((e.f & (DESTROYED | INERT)) !== 0) continue;
						update_effect(e);
					}
				}

				eager_block_effects.clear();
			}
		}
	}

	eager_block_effects = null;
}

/**
 * This is similar to `mark_reactions`, but it only marks async/block effects
 * depending on `value` and at least one of the other `sources`, so that
 * these effects can re-run after another batch has been committed
 * @param {Value} value
 * @param {Source[]} sources
 * @param {Set<Value>} marked
 * @param {Map<Reaction, boolean>} checked
 */
function mark_effects(value, sources, marked, checked) {
	if (marked.has(value)) return;
	marked.add(value);

	if (value.reactions !== null) {
		for (const reaction of value.reactions) {
			const flags = reaction.f;

			if ((flags & DERIVED) !== 0) {
				mark_effects(/** @type {Derived} */ (reaction), sources, marked, checked);
			} else if (
				(flags & (ASYNC | BLOCK_EFFECT)) !== 0 &&
				(flags & DIRTY) === 0 &&
				depends_on(reaction, sources, checked)
			) {
				set_signal_status(reaction, DIRTY);
				schedule_effect(/** @type {Effect} */ (reaction));
			}
		}
	}
}

/**
 * @param {Reaction} reaction
 * @param {Source[]} sources
 * @param {Map<Reaction, boolean>} checked
 */
function depends_on(reaction, sources, checked) {
	const depends = checked.get(reaction);
	if (depends !== undefined) return depends;

	if (reaction.deps !== null) {
		for (const dep of reaction.deps) {
			if (includes.call(sources, dep)) {
				return true;
			}

			if ((dep.f & DERIVED) !== 0 && depends_on(/** @type {Derived} */ (dep), sources, checked)) {
				checked.set(/** @type {Derived} */ (dep), true);
				return true;
			}
		}
	}

	checked.set(reaction, false);

	return false;
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function schedule_effect(signal) {
	var effect = (last_scheduled_effect = signal);

	while (effect.parent !== null) {
		effect = effect.parent;
		var flags = effect.f;

		// if the effect is being scheduled because a parent (each/await/etc) block
		// updated an internal source, bail out or we'll cause a second flush
		if (
			is_flushing &&
			effect === active_effect &&
			(flags & BLOCK_EFFECT) !== 0 &&
			(flags & HEAD_EFFECT) === 0
		) {
			return;
		}

		if ((flags & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
			if ((flags & CLEAN) === 0) return;
			effect.f ^= CLEAN;
		}
	}

	queued_root_effects.push(effect);
}

/**
 * Mark all the effects inside a skipped branch CLEAN, so that
 * they can be correctly rescheduled later
 * @param {Effect} effect
 */
function reset_branch(effect) {
	// clean branch = nothing dirty inside, no need to traverse further
	if ((effect.f & BRANCH_EFFECT) !== 0 && (effect.f & CLEAN) !== 0) {
		return;
	}

	set_signal_status(effect, CLEAN);

	var e = effect.first;
	while (e !== null) {
		reset_branch(e);
		e = e.next;
	}
}

/**
 * Returns a `subscribe` function that integrates external event-based systems with Svelte's reactivity.
 * It's particularly useful for integrating with web APIs like `MediaQuery`, `IntersectionObserver`, or `WebSocket`.
 *
 * If `subscribe` is called inside an effect (including indirectly, for example inside a getter),
 * the `start` callback will be called with an `update` function. Whenever `update` is called, the effect re-runs.
 *
 * If `start` returns a cleanup function, it will be called when the effect is destroyed.
 *
 * If `subscribe` is called in multiple effects, `start` will only be called once as long as the effects
 * are active, and the returned teardown function will only be called when all effects are destroyed.
 *
 * It's best understood with an example. Here's an implementation of [`MediaQuery`](https://svelte.dev/docs/svelte/svelte-reactivity#MediaQuery):
 *
 * ```js
 * import { createSubscriber } from 'svelte/reactivity';
 * import { on } from 'svelte/events';
 *
 * export class MediaQuery {
 * 	#query;
 * 	#subscribe;
 *
 * 	constructor(query) {
 * 		this.#query = window.matchMedia(`(${query})`);
 *
 * 		this.#subscribe = createSubscriber((update) => {
 * 			// when the `change` event occurs, re-run any effects that read `this.current`
 * 			const off = on(this.#query, 'change', update);
 *
 * 			// stop listening when all the effects are destroyed
 * 			return () => off();
 * 		});
 * 	}
 *
 * 	get current() {
 * 		// This makes the getter reactive, if read in an effect
 * 		this.#subscribe();
 *
 * 		// Return the current state of the query, whether or not we're in an effect
 * 		return this.#query.matches;
 * 	}
 * }
 * ```
 * @param {(update: () => void) => (() => void) | void} start
 * @since 5.7.0
 */
function createSubscriber(start) {
	let subscribers = 0;
	let version = source(0);
	/** @type {(() => void) | void} */
	let stop;

	if (DEV) {
		tag(version, 'createSubscriber version');
	}

	return () => {
		if (effect_tracking()) {
			get(version);

			render_effect(() => {
				if (subscribers === 0) {
					stop = untrack(() => start(() => increment(version)));
				}

				subscribers += 1;

				return () => {
					queue_micro_task(() => {
						// Only count down after a microtask, else we would reach 0 before our own render effect reruns,
						// but reach 1 again when the tick callback of the prior teardown runs. That would mean we
						// re-subcribe unnecessarily and create a memory leak because the old subscription is never cleaned up.
						subscribers -= 1;

						if (subscribers === 0) {
							stop?.();
							stop = undefined;
							// Increment the version to ensure any dependent deriveds are marked dirty when the subscription is picked up again later.
							// If we didn't do this then the comparison of write versions would determine that the derived has a later version than
							// the subscriber, and it would not be re-run.
							increment(version);
						}
					});
				};
			});
		}
	};
}

/** @import { Effect, Source, TemplateNode, } from '#client' */

/**
 * @typedef {{
 * 	 onerror?: (error: unknown, reset: () => void) => void;
 *   failed?: (anchor: Node, error: () => unknown, reset: () => () => void) => void;
 *   pending?: (anchor: Node) => void;
 * }} BoundaryProps
 */

var flags = EFFECT_TRANSPARENT | EFFECT_PRESERVED | BOUNDARY_EFFECT;

/**
 * @param {TemplateNode} node
 * @param {BoundaryProps} props
 * @param {((anchor: Node) => void)} children
 * @returns {void}
 */
function boundary(node, props, children) {
	new Boundary(node, props, children);
}

class Boundary {
	/** @type {Boundary | null} */
	parent;

	is_pending = false;

	/** @type {TemplateNode} */
	#anchor;

	/** @type {TemplateNode | null} */
	#hydrate_open = null;

	/** @type {BoundaryProps} */
	#props;

	/** @type {((anchor: Node) => void)} */
	#children;

	/** @type {Effect} */
	#effect;

	/** @type {Effect | null} */
	#main_effect = null;

	/** @type {Effect | null} */
	#pending_effect = null;

	/** @type {Effect | null} */
	#failed_effect = null;

	/** @type {DocumentFragment | null} */
	#offscreen_fragment = null;

	/** @type {TemplateNode | null} */
	#pending_anchor = null;

	#local_pending_count = 0;
	#pending_count = 0;
	#pending_count_update_queued = false;

	#is_creating_fallback = false;

	/** @type {Set<Effect>} */
	#dirty_effects = new Set();

	/** @type {Set<Effect>} */
	#maybe_dirty_effects = new Set();

	/**
	 * A source containing the number of pending async deriveds/expressions.
	 * Only created if `$effect.pending()` is used inside the boundary,
	 * otherwise updating the source results in needless `Batch.ensure()`
	 * calls followed by no-op flushes
	 * @type {Source<number> | null}
	 */
	#effect_pending = null;

	#effect_pending_subscriber = createSubscriber(() => {
		this.#effect_pending = source(this.#local_pending_count);

		if (DEV) {
			tag(this.#effect_pending, '$effect.pending()');
		}

		return () => {
			this.#effect_pending = null;
		};
	});

	/**
	 * @param {TemplateNode} node
	 * @param {BoundaryProps} props
	 * @param {((anchor: Node) => void)} children
	 */
	constructor(node, props, children) {
		this.#anchor = node;
		this.#props = props;
		this.#children = children;

		this.parent = /** @type {Effect} */ (active_effect).b;

		this.is_pending = !!this.#props.pending;

		this.#effect = block(() => {
			/** @type {Effect} */ (active_effect).b = this;

			{
				var anchor = this.#get_anchor();

				try {
					this.#main_effect = branch(() => children(anchor));
				} catch (error) {
					this.error(error);
				}

				if (this.#pending_count > 0) {
					this.#show_pending_snippet();
				} else {
					this.is_pending = false;
				}
			}

			return () => {
				this.#pending_anchor?.remove();
			};
		}, flags);
	}

	#hydrate_resolved_content() {
		try {
			this.#main_effect = branch(() => this.#children(this.#anchor));
		} catch (error) {
			this.error(error);
		}
	}

	#hydrate_pending_content() {
		const pending = this.#props.pending;
		if (!pending) return;

		this.#pending_effect = branch(() => pending(this.#anchor));

		queue_micro_task(() => {
			var anchor = this.#get_anchor();

			this.#main_effect = this.#run(() => {
				Batch.ensure();
				return branch(() => this.#children(anchor));
			});

			if (this.#pending_count > 0) {
				this.#show_pending_snippet();
			} else {
				pause_effect(/** @type {Effect} */ (this.#pending_effect), () => {
					this.#pending_effect = null;
				});

				this.is_pending = false;
			}
		});
	}

	#get_anchor() {
		var anchor = this.#anchor;

		if (this.is_pending) {
			this.#pending_anchor = create_text();
			this.#anchor.before(this.#pending_anchor);

			anchor = this.#pending_anchor;
		}

		return anchor;
	}

	/**
	 * Defer an effect inside a pending boundary until the boundary resolves
	 * @param {Effect} effect
	 */
	defer_effect(effect) {
		defer_effect(effect, this.#dirty_effects, this.#maybe_dirty_effects);
	}

	/**
	 * Returns `false` if the effect exists inside a boundary whose pending snippet is shown
	 * @returns {boolean}
	 */
	is_rendered() {
		return !this.is_pending && (!this.parent || this.parent.is_rendered());
	}

	has_pending_snippet() {
		return !!this.#props.pending;
	}

	/**
	 * @param {() => Effect | null} fn
	 */
	#run(fn) {
		var previous_effect = active_effect;
		var previous_reaction = active_reaction;
		var previous_ctx = component_context;

		set_active_effect(this.#effect);
		set_active_reaction(this.#effect);
		set_component_context(this.#effect.ctx);

		try {
			return fn();
		} catch (e) {
			handle_error(e);
			return null;
		} finally {
			set_active_effect(previous_effect);
			set_active_reaction(previous_reaction);
			set_component_context(previous_ctx);
		}
	}

	#show_pending_snippet() {
		const pending = /** @type {(anchor: Node) => void} */ (this.#props.pending);

		if (this.#main_effect !== null) {
			this.#offscreen_fragment = document.createDocumentFragment();
			this.#offscreen_fragment.append(/** @type {TemplateNode} */ (this.#pending_anchor));
			move_effect(this.#main_effect, this.#offscreen_fragment);
		}

		if (this.#pending_effect === null) {
			this.#pending_effect = branch(() => pending(this.#anchor));
		}
	}

	/**
	 * Updates the pending count associated with the currently visible pending snippet,
	 * if any, such that we can replace the snippet with content once work is done
	 * @param {1 | -1} d
	 */
	#update_pending_count(d) {
		if (!this.has_pending_snippet()) {
			if (this.parent) {
				this.parent.#update_pending_count(d);
			}

			// if there's no parent, we're in a scope with no pending snippet
			return;
		}

		this.#pending_count += d;

		if (this.#pending_count === 0) {
			this.is_pending = false;

			// any effects that were encountered and deferred during traversal
			// should be rescheduled — after the next traversal (which will happen
			// immediately, due to the same update that brought us here)
			// the effects will be flushed
			for (const e of this.#dirty_effects) {
				set_signal_status(e, DIRTY);
				schedule_effect(e);
			}

			for (const e of this.#maybe_dirty_effects) {
				set_signal_status(e, MAYBE_DIRTY);
				schedule_effect(e);
			}

			this.#dirty_effects.clear();
			this.#maybe_dirty_effects.clear();

			if (this.#pending_effect) {
				pause_effect(this.#pending_effect, () => {
					this.#pending_effect = null;
				});
			}

			if (this.#offscreen_fragment) {
				this.#anchor.before(this.#offscreen_fragment);
				this.#offscreen_fragment = null;
			}
		}
	}

	/**
	 * Update the source that powers `$effect.pending()` inside this boundary,
	 * and controls when the current `pending` snippet (if any) is removed.
	 * Do not call from inside the class
	 * @param {1 | -1} d
	 */
	update_pending_count(d) {
		this.#update_pending_count(d);

		this.#local_pending_count += d;

		if (!this.#effect_pending || this.#pending_count_update_queued) return;
		this.#pending_count_update_queued = true;

		queue_micro_task(() => {
			this.#pending_count_update_queued = false;
			if (this.#effect_pending) {
				internal_set(this.#effect_pending, this.#local_pending_count);
			}
		});
	}

	get_effect_pending() {
		this.#effect_pending_subscriber();
		return get(/** @type {Source<number>} */ (this.#effect_pending));
	}

	/** @param {unknown} error */
	error(error) {
		var onerror = this.#props.onerror;
		let failed = this.#props.failed;

		// If we have nothing to capture the error, or if we hit an error while
		// rendering the fallback, re-throw for another boundary to handle
		if (this.#is_creating_fallback || (!onerror && !failed)) {
			throw error;
		}

		if (this.#main_effect) {
			destroy_effect(this.#main_effect);
			this.#main_effect = null;
		}

		if (this.#pending_effect) {
			destroy_effect(this.#pending_effect);
			this.#pending_effect = null;
		}

		if (this.#failed_effect) {
			destroy_effect(this.#failed_effect);
			this.#failed_effect = null;
		}

		var did_reset = false;
		var calling_on_error = false;

		const reset = () => {
			if (did_reset) {
				svelte_boundary_reset_noop();
				return;
			}

			did_reset = true;

			if (calling_on_error) {
				svelte_boundary_reset_onerror();
			}

			// If the failure happened while flushing effects, current_batch can be null
			Batch.ensure();

			this.#local_pending_count = 0;

			if (this.#failed_effect !== null) {
				pause_effect(this.#failed_effect, () => {
					this.#failed_effect = null;
				});
			}

			// we intentionally do not try to find the nearest pending boundary. If this boundary has one, we'll render it on reset
			// but it would be really weird to show the parent's boundary on a child reset.
			this.is_pending = this.has_pending_snippet();

			this.#main_effect = this.#run(() => {
				this.#is_creating_fallback = false;
				return branch(() => this.#children(this.#anchor));
			});

			if (this.#pending_count > 0) {
				this.#show_pending_snippet();
			} else {
				this.is_pending = false;
			}
		};

		queue_micro_task(() => {
			try {
				calling_on_error = true;
				onerror?.(error, reset);
				calling_on_error = false;
			} catch (error) {
				invoke_error_boundary(error, this.#effect && this.#effect.parent);
			}

			if (failed) {
				this.#failed_effect = this.#run(() => {
					Batch.ensure();
					this.#is_creating_fallback = true;

					try {
						return branch(() => {
							failed(
								this.#anchor,
								() => error,
								() => reset
							);
						});
					} catch (error) {
						invoke_error_boundary(error, /** @type {Effect} */ (this.#effect.parent));
						return null;
					} finally {
						this.#is_creating_fallback = false;
					}
				});
			}
		});
	}
}

/** @import { Blocker, Effect, Value } from '#client' */

/**
 * @param {Blocker[]} blockers
 * @param {Array<() => any>} sync
 * @param {Array<() => Promise<any>>} async
 * @param {(values: Value[]) => any} fn
 */
function flatten(blockers, sync, async, fn) {
	const d = derived ;

	// Filter out already-settled blockers - no need to wait for them
	var pending = blockers.filter((b) => !b.settled);

	if (async.length === 0 && pending.length === 0) {
		fn(sync.map(d));
		return;
	}

	var batch = current_batch;
	var parent = /** @type {Effect} */ (active_effect);

	var restore = capture();
	var blocker_promise =
		pending.length === 1
			? pending[0].promise
			: pending.length > 1
				? Promise.all(pending.map((b) => b.promise))
				: null;

	/** @param {Value[]} values */
	function finish(values) {
		restore();

		try {
			fn(values);
		} catch (error) {
			if ((parent.f & DESTROYED) === 0) {
				invoke_error_boundary(error, parent);
			}
		}

		batch?.deactivate();
		unset_context();
	}

	// Fast path: blockers but no async expressions
	if (async.length === 0) {
		/** @type {Promise<any>} */ (blocker_promise).then(() => finish(sync.map(d)));
		return;
	}

	// Full path: has async expressions
	function run() {
		restore();
		Promise.all(async.map((expression) => async_derived(expression)))
			.then((result) => finish([...sync.map(d), ...result]))
			.catch((error) => invoke_error_boundary(error, parent));
	}

	if (blocker_promise) {
		blocker_promise.then(run);
	} else {
		run();
	}
}

/**
 * Captures the current effect context so that we can restore it after
 * some asynchronous work has happened (so that e.g. `await a + b`
 * causes `b` to be registered as a dependency).
 */
function capture() {
	var previous_effect = active_effect;
	var previous_reaction = active_reaction;
	var previous_component_context = component_context;
	var previous_batch = current_batch;

	if (DEV) {
		var previous_dev_stack = dev_stack;
	}

	return function restore(activate_batch = true) {
		set_active_effect(previous_effect);
		set_active_reaction(previous_reaction);
		set_component_context(previous_component_context);
		if (activate_batch) previous_batch?.activate();

		if (DEV) {
			set_dev_stack(previous_dev_stack);
		}
	};
}

function unset_context() {
	set_active_effect(null);
	set_active_reaction(null);
	set_component_context(null);

	if (DEV) {
		set_dev_stack(null);
	}
}

/** @import { Derived, Effect, Source } from '#client' */
/** @import { Batch } from './batch.js'; */

const recent_async_deriveds = new Set();

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function derived(fn) {
	var flags = DERIVED | DIRTY;
	var parent_derived =
		active_reaction !== null && (active_reaction.f & DERIVED) !== 0
			? /** @type {Derived} */ (active_reaction)
			: null;

	if (active_effect !== null) {
		// Since deriveds are evaluated lazily, any effects created inside them are
		// created too late to ensure that the parent effect is added to the tree
		active_effect.f |= EFFECT_PRESERVED;
	}

	/** @type {Derived<V>} */
	const signal = {
		ctx: component_context,
		deps: null,
		effects: null,
		equals,
		f: flags,
		fn,
		reactions: null,
		rv: 0,
		v: /** @type {V} */ (UNINITIALIZED),
		wv: 0,
		parent: parent_derived ?? active_effect,
		ac: null
	};

	return signal;
}

/**
 * @template V
 * @param {() => V | Promise<V>} fn
 * @param {string} [label]
 * @param {string} [location] If provided, print a warning if the value is not read immediately after update
 * @returns {Promise<Source<V>>}
 */
/*#__NO_SIDE_EFFECTS__*/
function async_derived(fn, label, location) {
	let parent = /** @type {Effect | null} */ (active_effect);

	if (parent === null) {
		async_derived_orphan();
	}

	var boundary = /** @type {Boundary} */ (parent.b);

	var promise = /** @type {Promise<V>} */ (/** @type {unknown} */ (undefined));
	var signal = source(/** @type {V} */ (UNINITIALIZED));

	if (DEV) signal.label = label;

	// only suspend in async deriveds created on initialisation
	var should_suspend = !active_reaction;

	/** @type {Map<Batch, ReturnType<typeof deferred<V>>>} */
	var deferreds = new Map();

	async_effect(() => {

		/** @type {ReturnType<typeof deferred<V>>} */
		var d = deferred();
		promise = d.promise;

		try {
			// If this code is changed at some point, make sure to still access the then property
			// of fn() to read any signals it might access, so that we track them as dependencies.
			// We call `unset_context` to undo any `save` calls that happen inside `fn()`
			Promise.resolve(fn())
				.then(d.resolve, d.reject)
				.then(() => {
					if (batch === current_batch && batch.committed) {
						// if the batch was rejected as stale, we need to cleanup
						// after any `$.save(...)` calls inside `fn()`
						batch.deactivate();
					}

					unset_context();
				});
		} catch (error) {
			d.reject(error);
			unset_context();
		}

		var batch = /** @type {Batch} */ (current_batch);

		if (should_suspend) {
			var blocking = boundary.is_rendered();

			boundary.update_pending_count(1);
			batch.increment(blocking);

			deferreds.get(batch)?.reject(STALE_REACTION);
			deferreds.delete(batch); // delete to ensure correct order in Map iteration below
			deferreds.set(batch, d);
		}

		/**
		 * @param {any} value
		 * @param {unknown} error
		 */
		const handler = (value, error = undefined) => {

			batch.activate();

			if (error) {
				if (error !== STALE_REACTION) {
					signal.f |= ERROR_VALUE;

					// @ts-expect-error the error is the wrong type, but we don't care
					internal_set(signal, error);
				}
			} else {
				if ((signal.f & ERROR_VALUE) !== 0) {
					signal.f ^= ERROR_VALUE;
				}

				internal_set(signal, value);

				// All prior async derived runs are now stale
				for (const [b, d] of deferreds) {
					deferreds.delete(b);
					if (b === batch) break;
					d.reject(STALE_REACTION);
				}
			}

			if (should_suspend) {
				boundary.update_pending_count(-1);
				batch.decrement(blocking);
			}
		};

		d.promise.then(handler, (e) => handler(null, e || 'unknown'));
	});

	teardown(() => {
		for (const d of deferreds.values()) {
			d.reject(STALE_REACTION);
		}
	});

	if (DEV) {
		// add a flag that lets this be printed as a derived
		// when using `$inspect.trace()`
		signal.f |= ASYNC;
	}

	return new Promise((fulfil) => {
		/** @param {Promise<V>} p */
		function next(p) {
			function go() {
				if (p === promise) {
					fulfil(signal);
				} else {
					// if the effect re-runs before the initial promise
					// resolves, delay resolution until we have a value
					next(promise);
				}
			}

			p.then(go, go);
		}

		next(promise);
	});
}

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function user_derived(fn) {
	const d = derived(fn);

	push_reaction_value(d);

	return d;
}

/**
 * @template V
 * @param {() => V} fn
 * @returns {Derived<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function derived_safe_equal(fn) {
	const signal = derived(fn);
	signal.equals = safe_equals;
	return signal;
}

/**
 * @param {Derived} derived
 * @returns {void}
 */
function destroy_derived_effects(derived) {
	var effects = derived.effects;

	if (effects !== null) {
		derived.effects = null;

		for (var i = 0; i < effects.length; i += 1) {
			destroy_effect(/** @type {Effect} */ (effects[i]));
		}
	}
}

/**
 * The currently updating deriveds, used to detect infinite recursion
 * in dev mode and provide a nicer error than 'too much recursion'
 * @type {Derived[]}
 */
let stack = [];

/**
 * @param {Derived} derived
 * @returns {Effect | null}
 */
function get_derived_parent_effect(derived) {
	var parent = derived.parent;
	while (parent !== null) {
		if ((parent.f & DERIVED) === 0) {
			// The original parent effect might've been destroyed but the derived
			// is used elsewhere now - do not return the destroyed effect in that case
			return (parent.f & DESTROYED) === 0 ? /** @type {Effect} */ (parent) : null;
		}
		parent = parent.parent;
	}
	return null;
}

/**
 * @template T
 * @param {Derived} derived
 * @returns {T}
 */
function execute_derived(derived) {
	var value;
	var prev_active_effect = active_effect;

	set_active_effect(get_derived_parent_effect(derived));

	if (DEV) {
		let prev_eager_effects = eager_effects;
		set_eager_effects(new Set());
		try {
			if (includes.call(stack, derived)) {
				derived_references_self();
			}

			stack.push(derived);

			derived.f &= ~WAS_MARKED;
			destroy_derived_effects(derived);
			value = update_reaction(derived);
		} finally {
			set_active_effect(prev_active_effect);
			set_eager_effects(prev_eager_effects);
			stack.pop();
		}
	} else {
		try {
			derived.f &= ~WAS_MARKED;
			destroy_derived_effects(derived);
			value = update_reaction(derived);
		} finally {
			set_active_effect(prev_active_effect);
		}
	}

	return value;
}

/**
 * @param {Derived} derived
 * @returns {void}
 */
function update_derived(derived) {
	var value = execute_derived(derived);

	if (!derived.equals(value)) {
		derived.wv = increment_write_version();

		// in a fork, we don't update the underlying value, just `batch_values`.
		// the underlying value will be updated when the fork is committed.
		// otherwise, the next time we get here after a 'real world' state
		// change, `derived.equals` may incorrectly return `true`
		if (!current_batch?.is_fork || derived.deps === null) {
			derived.v = value;

			// deriveds without dependencies should never be recomputed
			if (derived.deps === null) {
				set_signal_status(derived, CLEAN);
				return;
			}
		}
	}

	// don't mark derived clean if we're reading it inside a
	// cleanup function, or it will cache a stale value
	if (is_destroying_effect) {
		return;
	}

	// During time traveling we don't want to reset the status so that
	// traversal of the graph in the other batches still happens
	if (batch_values !== null) {
		// only cache the value if we're in a tracking context, otherwise we won't
		// clear the cache in `mark_reactions` when dependencies are updated
		if (effect_tracking() || current_batch?.is_fork) {
			batch_values.set(derived, value);
		}
	} else {
		update_derived_status(derived);
	}
}

/** @import { Derived, Effect, Source, Value } from '#client' */

/** @type {Set<any>} */
let eager_effects = new Set();

/** @type {Map<Source, any>} */
const old_values = new Map();

/**
 * @param {Set<any>} v
 */
function set_eager_effects(v) {
	eager_effects = v;
}

let eager_effects_deferred = false;

function set_eager_effects_deferred() {
	eager_effects_deferred = true;
}

/**
 * @template V
 * @param {V} v
 * @param {Error | null} [stack]
 * @returns {Source<V>}
 */
// TODO rename this to `state` throughout the codebase
function source(v, stack) {
	/** @type {Value} */
	var signal = {
		f: 0, // TODO ideally we could skip this altogether, but it causes type errors
		v,
		reactions: null,
		equals,
		rv: 0,
		wv: 0
	};

	return signal;
}

/**
 * @template V
 * @param {V} v
 * @param {Error | null} [stack]
 */
/*#__NO_SIDE_EFFECTS__*/
function state(v, stack) {
	const s = source(v);

	push_reaction_value(s);

	return s;
}

/**
 * @template V
 * @param {V} initial_value
 * @param {boolean} [immutable]
 * @returns {Source<V>}
 */
/*#__NO_SIDE_EFFECTS__*/
function mutable_source(initial_value, immutable = false, trackable = true) {
	const s = source(initial_value);
	if (!immutable) {
		s.equals = safe_equals;
	}

	return s;
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @param {boolean} [should_proxy]
 * @returns {V}
 */
function set(source, value, should_proxy = false) {
	if (
		active_reaction !== null &&
		// since we are untracking the function inside `$inspect.with` we need to add this check
		// to ensure we error if state is set inside an inspect effect
		(!untracking || (active_reaction.f & EAGER_EFFECT) !== 0) &&
		is_runes() &&
		(active_reaction.f & (DERIVED | BLOCK_EFFECT | ASYNC | EAGER_EFFECT)) !== 0 &&
		(current_sources === null || !includes.call(current_sources, source))
	) {
		state_unsafe_mutation();
	}

	let new_value = should_proxy ? proxy(value) : value;

	if (DEV) {
		tag_proxy(new_value, /** @type {string} */ (source.label));
	}

	return internal_set(source, new_value);
}

/**
 * @template V
 * @param {Source<V>} source
 * @param {V} value
 * @returns {V}
 */
function internal_set(source, value) {
	if (!source.equals(value)) {
		var old_value = source.v;

		if (is_destroying_effect) {
			old_values.set(source, value);
		} else {
			old_values.set(source, old_value);
		}

		source.v = value;

		var batch = Batch.ensure();
		batch.capture(source, old_value);

		if (DEV) {
			if (active_effect !== null) {
				source.updated ??= new Map();

				// For performance reasons, when not using $inspect.trace, we only start collecting stack traces
				// after the same source has been updated more than 5 times in the same flush cycle.
				const count = (source.updated.get('')?.count ?? 0) + 1;
				source.updated.set('', { error: /** @type {any} */ (null), count });

				if (count > 5) {
					const error = get_error('updated at');

					if (error !== null) {
						let entry = source.updated.get(error.stack);

						if (!entry) {
							entry = { error, count: 0 };
							source.updated.set(error.stack, entry);
						}

						entry.count++;
					}
				}
			}

			if (active_effect !== null) {
				source.set_during_effect = true;
			}
		}

		if ((source.f & DERIVED) !== 0) {
			const derived = /** @type {Derived} */ (source);

			// if we are assigning to a dirty derived we set it to clean/maybe dirty but we also eagerly execute it to track the dependencies
			if ((source.f & DIRTY) !== 0) {
				execute_derived(derived);
			}

			update_derived_status(derived);
		}

		source.wv = increment_write_version();

		// For debugging, in case you want to know which reactions are being scheduled:
		// log_reactions(source);
		mark_reactions(source, DIRTY);

		// It's possible that the current reaction might not have up-to-date dependencies
		// whilst it's actively running. So in the case of ensuring it registers the reaction
		// properly for itself, we need to ensure the current effect actually gets
		// scheduled. i.e: `$effect(() => x++)`
		if (
			active_effect !== null &&
			(active_effect.f & CLEAN) !== 0 &&
			(active_effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0
		) {
			if (untracked_writes === null) {
				set_untracked_writes([source]);
			} else {
				untracked_writes.push(source);
			}
		}

		if (!batch.is_fork && eager_effects.size > 0 && !eager_effects_deferred) {
			flush_eager_effects();
		}
	}

	return value;
}

function flush_eager_effects() {
	eager_effects_deferred = false;

	for (const effect of eager_effects) {
		// Mark clean inspect-effects as maybe dirty and then check their dirtiness
		// instead of just updating the effects - this way we avoid overfiring.
		if ((effect.f & CLEAN) !== 0) {
			set_signal_status(effect, MAYBE_DIRTY);
		}

		if (is_dirty(effect)) {
			update_effect(effect);
		}
	}

	eager_effects.clear();
}

/**
 * Silently (without using `get`) increment a source
 * @param {Source<number>} source
 */
function increment(source) {
	set(source, source.v + 1);
}

/**
 * @param {Value} signal
 * @param {number} status should be DIRTY or MAYBE_DIRTY
 * @returns {void}
 */
function mark_reactions(signal, status) {
	var reactions = signal.reactions;
	if (reactions === null) return;
	var length = reactions.length;

	for (var i = 0; i < length; i++) {
		var reaction = reactions[i];
		var flags = reaction.f;

		// Inspect effects need to run immediately, so that the stack trace makes sense
		if (DEV && (flags & EAGER_EFFECT) !== 0) {
			eager_effects.add(reaction);
			continue;
		}

		var not_dirty = (flags & DIRTY) === 0;

		// don't set a DIRTY reaction to MAYBE_DIRTY
		if (not_dirty) {
			set_signal_status(reaction, status);
		}

		if ((flags & DERIVED) !== 0) {
			var derived = /** @type {Derived} */ (reaction);

			batch_values?.delete(derived);

			if ((flags & WAS_MARKED) === 0) {
				// Only connected deriveds can be reliably unmarked right away
				if (flags & CONNECTED) {
					reaction.f |= WAS_MARKED;
				}

				mark_reactions(derived, MAYBE_DIRTY);
			}
		} else if (not_dirty) {
			if ((flags & BLOCK_EFFECT) !== 0 && eager_block_effects !== null) {
				eager_block_effects.add(/** @type {Effect} */ (reaction));
			}

			schedule_effect(/** @type {Effect} */ (reaction));
		}
	}
}

/** @import { Source } from '#client' */

// TODO move all regexes into shared module?
const regex_is_valid_identifier = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function proxy(value) {
	// if non-proxyable, or is already a proxy, return `value`
	if (typeof value !== 'object' || value === null || STATE_SYMBOL in value) {
		return value;
	}

	const prototype = get_prototype_of(value);

	if (prototype !== object_prototype && prototype !== array_prototype) {
		return value;
	}

	/** @type {Map<any, Source<any>>} */
	var sources = new Map();
	var is_proxied_array = is_array(value);
	var version = state(0);
	var parent_version = update_version;

	/**
	 * Executes the proxy in the context of the reaction it was originally created in, if any
	 * @template T
	 * @param {() => T} fn
	 */
	var with_parent = (fn) => {
		if (update_version === parent_version) {
			return fn();
		}

		// child source is being created after the initial proxy —
		// prevent it from being associated with the current reaction
		var reaction = active_reaction;
		var version = update_version;

		set_active_reaction(null);
		set_update_version(parent_version);

		var result = fn();

		set_active_reaction(reaction);
		set_update_version(version);

		return result;
	};

	if (is_proxied_array) {
		// We need to create the length source eagerly to ensure that
		// mutations to the array are properly synced with our proxy
		sources.set('length', state(/** @type {any[]} */ (value).length));
		if (DEV) {
			value = /** @type {any} */ (inspectable_array(/** @type {any[]} */ (value)));
		}
	}

	/** Used in dev for $inspect.trace() */
	var path = '';
	let updating = false;
	/** @param {string} new_path */
	function update_path(new_path) {
		if (updating) return;
		updating = true;
		path = new_path;

		tag(version, `${path} version`);

		// rename all child sources and child proxies
		for (const [prop, source] of sources) {
			tag(source, get_label(path, prop));
		}
		updating = false;
	}

	return new Proxy(/** @type {any} */ (value), {
		defineProperty(_, prop, descriptor) {
			if (
				!('value' in descriptor) ||
				descriptor.configurable === false ||
				descriptor.enumerable === false ||
				descriptor.writable === false
			) {
				// we disallow non-basic descriptors, because unless they are applied to the
				// target object — which we avoid, so that state can be forked — we will run
				// afoul of the various invariants
				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/getOwnPropertyDescriptor#invariants
				state_descriptors_fixed();
			}
			var s = sources.get(prop);
			if (s === undefined) {
				s = with_parent(() => {
					var s = state(descriptor.value);
					sources.set(prop, s);
					if (DEV && typeof prop === 'string') {
						tag(s, get_label(path, prop));
					}
					return s;
				});
			} else {
				set(s, descriptor.value, true);
			}

			return true;
		},

		deleteProperty(target, prop) {
			var s = sources.get(prop);

			if (s === undefined) {
				if (prop in target) {
					const s = with_parent(() => state(UNINITIALIZED));
					sources.set(prop, s);
					increment(version);

					if (DEV) {
						tag(s, get_label(path, prop));
					}
				}
			} else {
				set(s, UNINITIALIZED);
				increment(version);
			}

			return true;
		},

		get(target, prop, receiver) {
			if (prop === STATE_SYMBOL) {
				return value;
			}

			if (DEV && prop === PROXY_PATH_SYMBOL) {
				return update_path;
			}

			var s = sources.get(prop);
			var exists = prop in target;

			// create a source, but only if it's an own property and not a prototype property
			if (s === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
				s = with_parent(() => {
					var p = proxy(exists ? target[prop] : UNINITIALIZED);
					var s = state(p);

					if (DEV) {
						tag(s, get_label(path, prop));
					}

					return s;
				});

				sources.set(prop, s);
			}

			if (s !== undefined) {
				var v = get(s);
				return v === UNINITIALIZED ? undefined : v;
			}

			return Reflect.get(target, prop, receiver);
		},

		getOwnPropertyDescriptor(target, prop) {
			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			if (descriptor && 'value' in descriptor) {
				var s = sources.get(prop);
				if (s) descriptor.value = get(s);
			} else if (descriptor === undefined) {
				var source = sources.get(prop);
				var value = source?.v;

				if (source !== undefined && value !== UNINITIALIZED) {
					return {
						enumerable: true,
						configurable: true,
						value,
						writable: true
					};
				}
			}

			return descriptor;
		},

		has(target, prop) {
			if (prop === STATE_SYMBOL) {
				return true;
			}

			var s = sources.get(prop);
			var has = (s !== undefined && s.v !== UNINITIALIZED) || Reflect.has(target, prop);

			if (
				s !== undefined ||
				(active_effect !== null && (!has || get_descriptor(target, prop)?.writable))
			) {
				if (s === undefined) {
					s = with_parent(() => {
						var p = has ? proxy(target[prop]) : UNINITIALIZED;
						var s = state(p);

						if (DEV) {
							tag(s, get_label(path, prop));
						}

						return s;
					});

					sources.set(prop, s);
				}

				var value = get(s);
				if (value === UNINITIALIZED) {
					return false;
				}
			}

			return has;
		},

		set(target, prop, value, receiver) {
			var s = sources.get(prop);
			var has = prop in target;

			// variable.length = value -> clear all signals with index >= value
			if (is_proxied_array && prop === 'length') {
				for (var i = value; i < /** @type {Source<number>} */ (s).v; i += 1) {
					var other_s = sources.get(i + '');
					if (other_s !== undefined) {
						set(other_s, UNINITIALIZED);
					} else if (i in target) {
						// If the item exists in the original, we need to create an uninitialized source,
						// else a later read of the property would result in a source being created with
						// the value of the original item at that index.
						other_s = with_parent(() => state(UNINITIALIZED));
						sources.set(i + '', other_s);

						if (DEV) {
							tag(other_s, get_label(path, i));
						}
					}
				}
			}

			// If we haven't yet created a source for this property, we need to ensure
			// we do so otherwise if we read it later, then the write won't be tracked and
			// the heuristics of effects will be different vs if we had read the proxied
			// object property before writing to that property.
			if (s === undefined) {
				if (!has || get_descriptor(target, prop)?.writable) {
					s = with_parent(() => state(undefined));

					if (DEV) {
						tag(s, get_label(path, prop));
					}
					set(s, proxy(value));

					sources.set(prop, s);
				}
			} else {
				has = s.v !== UNINITIALIZED;

				var p = with_parent(() => proxy(value));
				set(s, p);
			}

			var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

			// Set the new value before updating any signals so that any listeners get the new value
			if (descriptor?.set) {
				descriptor.set.call(receiver, value);
			}

			if (!has) {
				// If we have mutated an array directly, we might need to
				// signal that length has also changed. Do it before updating metadata
				// to ensure that iterating over the array as a result of a metadata update
				// will not cause the length to be out of sync.
				if (is_proxied_array && typeof prop === 'string') {
					var ls = /** @type {Source<number>} */ (sources.get('length'));
					var n = Number(prop);

					if (Number.isInteger(n) && n >= ls.v) {
						set(ls, n + 1);
					}
				}

				increment(version);
			}

			return true;
		},

		ownKeys(target) {
			get(version);

			var own_keys = Reflect.ownKeys(target).filter((key) => {
				var source = sources.get(key);
				return source === undefined || source.v !== UNINITIALIZED;
			});

			for (var [key, source] of sources) {
				if (source.v !== UNINITIALIZED && !(key in target)) {
					own_keys.push(key);
				}
			}

			return own_keys;
		},

		setPrototypeOf() {
			state_prototype_fixed();
		}
	});
}

/**
 * @param {string} path
 * @param {string | symbol} prop
 */
function get_label(path, prop) {
	if (typeof prop === 'symbol') return `${path}[Symbol(${prop.description ?? ''})]`;
	if (regex_is_valid_identifier.test(prop)) return `${path}.${prop}`;
	return /^\d+$/.test(prop) ? `${path}[${prop}]` : `${path}['${prop}']`;
}

/**
 * @param {any} value
 */
function get_proxied_value(value) {
	try {
		if (value !== null && typeof value === 'object' && STATE_SYMBOL in value) {
			return value[STATE_SYMBOL];
		}
	} catch {
		// the above if check can throw an error if the value in question
		// is the contentWindow of an iframe on another domain, in which
		// case we want to just return the value (because it's definitely
		// not a proxied value) so we don't break any JavaScript interacting
		// with that iframe (such as various payment companies client side
		// JavaScript libraries interacting with their iframes on the same
		// domain)
	}

	return value;
}

const ARRAY_MUTATING_METHODS = new Set([
	'copyWithin',
	'fill',
	'pop',
	'push',
	'reverse',
	'shift',
	'sort',
	'splice',
	'unshift'
]);

/**
 * Wrap array mutating methods so $inspect is triggered only once and
 * to prevent logging an array in intermediate state (e.g. with an empty slot)
 * @param {any[]} array
 */
function inspectable_array(array) {
	return new Proxy(array, {
		get(target, prop, receiver) {
			var value = Reflect.get(target, prop, receiver);
			if (!ARRAY_MUTATING_METHODS.has(/** @type {string} */ (prop))) {
				return value;
			}

			/**
			 * @this {any[]}
			 * @param {any[]} args
			 */
			return function (...args) {
				set_eager_effects_deferred();
				var result = value.apply(this, args);
				flush_eager_effects();
				return result;
			};
		}
	});
}

function init_array_prototype_warnings() {
	const array_prototype = Array.prototype;
	// The REPL ends up here over and over, and this prevents it from adding more and more patches
	// of the same kind to the prototype, which would slow down everything over time.
	// @ts-expect-error
	const cleanup = Array.__svelte_cleanup;
	if (cleanup) {
		cleanup();
	}

	const { indexOf, lastIndexOf, includes } = array_prototype;

	array_prototype.indexOf = function (item, from_index) {
		const index = indexOf.call(this, item, from_index);

		if (index === -1) {
			for (let i = from_index ?? 0; i < this.length; i += 1) {
				if (get_proxied_value(this[i]) === item) {
					state_proxy_equality_mismatch('array.indexOf(...)');
					break;
				}
			}
		}

		return index;
	};

	array_prototype.lastIndexOf = function (item, from_index) {
		// we need to specify this.length - 1 because it's probably using something like
		// `arguments` inside so passing undefined is different from not passing anything
		const index = lastIndexOf.call(this, item, from_index ?? this.length - 1);

		if (index === -1) {
			for (let i = 0; i <= (from_index ?? this.length - 1); i += 1) {
				if (get_proxied_value(this[i]) === item) {
					state_proxy_equality_mismatch('array.lastIndexOf(...)');
					break;
				}
			}
		}

		return index;
	};

	array_prototype.includes = function (item, from_index) {
		const has = includes.call(this, item, from_index);

		if (!has) {
			for (let i = 0; i < this.length; i += 1) {
				if (get_proxied_value(this[i]) === item) {
					state_proxy_equality_mismatch('array.includes(...)');
					break;
				}
			}
		}

		return has;
	};

	// @ts-expect-error
	Array.__svelte_cleanup = () => {
		array_prototype.indexOf = indexOf;
		array_prototype.lastIndexOf = lastIndexOf;
		array_prototype.includes = includes;
	};
}

/** @import { Effect, TemplateNode } from '#client' */

// export these for reference in the compiled code, making global name deduplication unnecessary
/** @type {Window} */
var $window;

/** @type {boolean} */
var is_firefox;

/** @type {() => Node | null} */
var first_child_getter;
/** @type {() => Node | null} */
var next_sibling_getter;

/**
 * Initialize these lazily to avoid issues when using the runtime in a server context
 * where these globals are not available while avoiding a separate server entry point
 */
function init_operations() {
	if ($window !== undefined) {
		return;
	}

	$window = window;
	is_firefox = /Firefox/.test(navigator.userAgent);

	var element_prototype = Element.prototype;
	var node_prototype = Node.prototype;
	var text_prototype = Text.prototype;

	// @ts-ignore
	first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
	// @ts-ignore
	next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;

	if (is_extensible(element_prototype)) {
		// the following assignments improve perf of lookups on DOM nodes
		// @ts-expect-error
		element_prototype.__click = undefined;
		// @ts-expect-error
		element_prototype.__className = undefined;
		// @ts-expect-error
		element_prototype.__attributes = null;
		// @ts-expect-error
		element_prototype.__style = undefined;
		// @ts-expect-error
		element_prototype.__e = undefined;
	}

	if (is_extensible(text_prototype)) {
		// @ts-expect-error
		text_prototype.__t = undefined;
	}

	if (DEV) {
		// @ts-expect-error
		element_prototype.__svelte_meta = null;

		init_array_prototype_warnings();
	}
}

/**
 * @param {string} value
 * @returns {Text}
 */
function create_text(value = '') {
	return document.createTextNode(value);
}

/**
 * @template {Node} N
 * @param {N} node
 */
/*@__NO_SIDE_EFFECTS__*/
function get_first_child(node) {
	return /** @type {TemplateNode | null} */ (first_child_getter.call(node));
}

/**
 * @template {Node} N
 * @param {N} node
 */
/*@__NO_SIDE_EFFECTS__*/
function get_next_sibling(node) {
	return /** @type {TemplateNode | null} */ (next_sibling_getter.call(node));
}

/**
 * Don't mark this as side-effect-free, hydration needs to walk all nodes
 * @template {Node} N
 * @param {N} node
 * @param {boolean} is_text
 * @returns {TemplateNode | null}
 */
function child(node, is_text) {
	{
		return get_first_child(node);
	}
}

/**
 * Don't mark this as side-effect-free, hydration needs to walk all nodes
 * @param {TemplateNode} node
 * @param {boolean} [is_text]
 * @returns {TemplateNode | null}
 */
function first_child(node, is_text = false) {
	{
		var first = get_first_child(node);

		// TODO prevent user comments with the empty string when preserveComments is true
		if (first instanceof Comment && first.data === '') return get_next_sibling(first);

		return first;
	}
}

/**
 * Don't mark this as side-effect-free, hydration needs to walk all nodes
 * @param {TemplateNode} node
 * @param {number} count
 * @param {boolean} is_text
 * @returns {TemplateNode | null}
 */
function sibling(node, count = 1, is_text = false) {
	let next_sibling = node;

	while (count--) {
		next_sibling = /** @type {TemplateNode} */ (get_next_sibling(next_sibling));
	}

	{
		return next_sibling;
	}
}

/**
 * @template {Node} N
 * @param {N} node
 * @returns {void}
 */
function clear_text_content(node) {
	node.textContent = '';
}

/**
 * Returns `true` if we're updating the current block, for example `condition` in
 * an `{#if condition}` block just changed. In this case, the branch should be
 * appended (or removed) at the same time as other updates within the
 * current `<svelte:boundary>`
 */
function should_defer_append() {
	return false;
}

let listening_to_form_reset = false;

function add_form_reset_listener() {
	if (!listening_to_form_reset) {
		listening_to_form_reset = true;
		document.addEventListener(
			'reset',
			(evt) => {
				// Needs to happen one tick later or else the dom properties of the form
				// elements have not updated to their reset values yet
				Promise.resolve().then(() => {
					if (!evt.defaultPrevented) {
						for (const e of /**@type {HTMLFormElement} */ (evt.target).elements) {
							// @ts-expect-error
							e.__on_r?.();
						}
					}
				});
			},
			// In the capture phase to guarantee we get noticed of it (no possibility of stopPropagation)
			{ capture: true }
		);
	}
}

/**
 * @template T
 * @param {() => T} fn
 */
function without_reactive_context(fn) {
	var previous_reaction = active_reaction;
	var previous_effect = active_effect;
	set_active_reaction(null);
	set_active_effect(null);
	try {
		return fn();
	} finally {
		set_active_reaction(previous_reaction);
		set_active_effect(previous_effect);
	}
}

/**
 * Listen to the given event, and then instantiate a global form reset listener if not already done,
 * to notify all bindings when the form is reset
 * @param {HTMLElement} element
 * @param {string} event
 * @param {(is_reset?: true) => void} handler
 * @param {(is_reset?: true) => void} [on_reset]
 */
function listen_to_event_and_reset_event(element, event, handler, on_reset = handler) {
	element.addEventListener(event, () => without_reactive_context(handler));
	// @ts-expect-error
	const prev = element.__on_r;
	if (prev) {
		// special case for checkbox that can have multiple binds (group & checked)
		// @ts-expect-error
		element.__on_r = () => {
			prev();
			on_reset(true);
		};
	} else {
		// @ts-expect-error
		element.__on_r = () => on_reset(true);
	}

	add_form_reset_listener();
}

/** @import { Blocker, ComponentContext, ComponentContextLegacy, Derived, Effect, TemplateNode, TransitionManager } from '#client' */

/**
 * @param {'$effect' | '$effect.pre' | '$inspect'} rune
 */
function validate_effect(rune) {
	if (active_effect === null) {
		if (active_reaction === null) {
			effect_orphan(rune);
		}

		effect_in_unowned_derived();
	}

	if (is_destroying_effect) {
		effect_in_teardown(rune);
	}
}

/**
 * @param {Effect} effect
 * @param {Effect} parent_effect
 */
function push_effect(effect, parent_effect) {
	var parent_last = parent_effect.last;
	if (parent_last === null) {
		parent_effect.last = parent_effect.first = effect;
	} else {
		parent_last.next = effect;
		effect.prev = parent_last;
		parent_effect.last = effect;
	}
}

/**
 * @param {number} type
 * @param {null | (() => void | (() => void))} fn
 * @param {boolean} sync
 * @returns {Effect}
 */
function create_effect(type, fn, sync) {
	var parent = active_effect;

	if (DEV) {
		// Ensure the parent is never an inspect effect
		while (parent !== null && (parent.f & EAGER_EFFECT) !== 0) {
			parent = parent.parent;
		}
	}

	if (parent !== null && (parent.f & INERT) !== 0) {
		type |= INERT;
	}

	/** @type {Effect} */
	var effect = {
		ctx: component_context,
		deps: null,
		nodes: null,
		f: type | DIRTY | CONNECTED,
		first: null,
		fn,
		last: null,
		next: null,
		parent,
		b: parent && parent.b,
		prev: null,
		teardown: null,
		wv: 0,
		ac: null
	};

	if (DEV) {
		effect.component_function = dev_current_component_function;
	}

	if (sync) {
		try {
			update_effect(effect);
			effect.f |= EFFECT_RAN;
		} catch (e) {
			destroy_effect(effect);
			throw e;
		}
	} else if (fn !== null) {
		schedule_effect(effect);
	}

	/** @type {Effect | null} */
	var e = effect;

	// if an effect has already ran and doesn't need to be kept in the tree
	// (because it won't re-run, has no DOM, and has no teardown etc)
	// then we skip it and go to its child (if any)
	if (
		sync &&
		e.deps === null &&
		e.teardown === null &&
		e.nodes === null &&
		e.first === e.last && // either `null`, or a singular child
		(e.f & EFFECT_PRESERVED) === 0
	) {
		e = e.first;
		if ((type & BLOCK_EFFECT) !== 0 && (type & EFFECT_TRANSPARENT) !== 0 && e !== null) {
			e.f |= EFFECT_TRANSPARENT;
		}
	}

	if (e !== null) {
		e.parent = parent;

		if (parent !== null) {
			push_effect(e, parent);
		}

		// if we're in a derived, add the effect there too
		if (
			active_reaction !== null &&
			(active_reaction.f & DERIVED) !== 0 &&
			(type & ROOT_EFFECT) === 0
		) {
			var derived = /** @type {Derived} */ (active_reaction);
			(derived.effects ??= []).push(e);
		}
	}

	return effect;
}

/**
 * Internal representation of `$effect.tracking()`
 * @returns {boolean}
 */
function effect_tracking() {
	return active_reaction !== null && !untracking;
}

/**
 * @param {() => void} fn
 */
function teardown(fn) {
	const effect = create_effect(RENDER_EFFECT, null, false);
	set_signal_status(effect, CLEAN);
	effect.teardown = fn;
	return effect;
}

/**
 * Internal representation of `$effect(...)`
 * @param {() => void | (() => void)} fn
 */
function user_effect(fn) {
	validate_effect('$effect');

	if (DEV) {
		define_property(fn, 'name', {
			value: '$effect'
		});
	}

	// Non-nested `$effect(...)` in a component should be deferred
	// until the component is mounted
	var flags = /** @type {Effect} */ (active_effect).f;
	var defer = !active_reaction && (flags & BRANCH_EFFECT) !== 0 && (flags & EFFECT_RAN) === 0;

	if (defer) {
		// Top-level `$effect(...)` in an unmounted component — defer until mount
		var context = /** @type {ComponentContext} */ (component_context);
		(context.e ??= []).push(fn);
	} else {
		// Everything else — create immediately
		return create_user_effect(fn);
	}
}

/**
 * @param {() => void | (() => void)} fn
 */
function create_user_effect(fn) {
	return create_effect(EFFECT | USER_EFFECT, fn, false);
}

/**
 * An effect root whose children can transition out
 * @param {() => void} fn
 * @returns {(options?: { outro?: boolean }) => Promise<void>}
 */
function component_root(fn) {
	Batch.ensure();
	const effect = create_effect(ROOT_EFFECT | EFFECT_PRESERVED, fn, true);

	return (options = {}) => {
		return new Promise((fulfil) => {
			if (options.outro) {
				pause_effect(effect, () => {
					destroy_effect(effect);
					fulfil(undefined);
				});
			} else {
				destroy_effect(effect);
				fulfil(undefined);
			}
		});
	};
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function effect(fn) {
	return create_effect(EFFECT, fn, false);
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function async_effect(fn) {
	return create_effect(ASYNC | EFFECT_PRESERVED, fn, true);
}

/**
 * @param {() => void | (() => void)} fn
 * @returns {Effect}
 */
function render_effect(fn, flags = 0) {
	return create_effect(RENDER_EFFECT | flags, fn, true);
}

/**
 * @param {(...expressions: any) => void | (() => void)} fn
 * @param {Array<() => any>} sync
 * @param {Array<() => Promise<any>>} async
 * @param {Blocker[]} blockers
 */
function template_effect(fn, sync = [], async = [], blockers = []) {
	flatten(blockers, sync, async, (values) => {
		create_effect(RENDER_EFFECT, () => fn(...values.map(get)), true);
	});
}

/**
 * @param {(() => void)} fn
 * @param {number} flags
 */
function block(fn, flags = 0) {
	var effect = create_effect(BLOCK_EFFECT | flags, fn, true);
	if (DEV) {
		effect.dev_stack = dev_stack;
	}
	return effect;
}

/**
 * @param {(() => void)} fn
 */
function branch(fn) {
	return create_effect(BRANCH_EFFECT | EFFECT_PRESERVED, fn, true);
}

/**
 * @param {Effect} effect
 */
function execute_effect_teardown(effect) {
	var teardown = effect.teardown;
	if (teardown !== null) {
		const previously_destroying_effect = is_destroying_effect;
		const previous_reaction = active_reaction;
		set_is_destroying_effect(true);
		set_active_reaction(null);
		try {
			teardown.call(null);
		} finally {
			set_is_destroying_effect(previously_destroying_effect);
			set_active_reaction(previous_reaction);
		}
	}
}

/**
 * @param {Effect} signal
 * @param {boolean} remove_dom
 * @returns {void}
 */
function destroy_effect_children(signal, remove_dom = false) {
	var effect = signal.first;
	signal.first = signal.last = null;

	while (effect !== null) {
		const controller = effect.ac;

		if (controller !== null) {
			without_reactive_context(() => {
				controller.abort(STALE_REACTION);
			});
		}

		var next = effect.next;

		if ((effect.f & ROOT_EFFECT) !== 0) {
			// this is now an independent root
			effect.parent = null;
		} else {
			destroy_effect(effect, remove_dom);
		}

		effect = next;
	}
}

/**
 * @param {Effect} signal
 * @returns {void}
 */
function destroy_block_effect_children(signal) {
	var effect = signal.first;

	while (effect !== null) {
		var next = effect.next;
		if ((effect.f & BRANCH_EFFECT) === 0) {
			destroy_effect(effect);
		}
		effect = next;
	}
}

/**
 * @param {Effect} effect
 * @param {boolean} [remove_dom]
 * @returns {void}
 */
function destroy_effect(effect, remove_dom = true) {
	var removed = false;

	if (
		(remove_dom || (effect.f & HEAD_EFFECT) !== 0) &&
		effect.nodes !== null &&
		effect.nodes.end !== null
	) {
		remove_effect_dom(effect.nodes.start, /** @type {TemplateNode} */ (effect.nodes.end));
		removed = true;
	}

	destroy_effect_children(effect, remove_dom && !removed);
	remove_reactions(effect, 0);
	set_signal_status(effect, DESTROYED);

	var transitions = effect.nodes && effect.nodes.t;

	if (transitions !== null) {
		for (const transition of transitions) {
			transition.stop();
		}
	}

	execute_effect_teardown(effect);

	var parent = effect.parent;

	// If the parent doesn't have any children, then skip this work altogether
	if (parent !== null && parent.first !== null) {
		unlink_effect(effect);
	}

	if (DEV) {
		effect.component_function = null;
	}

	// `first` and `child` are nulled out in destroy_effect_children
	// we don't null out `parent` so that error propagation can work correctly
	effect.next =
		effect.prev =
		effect.teardown =
		effect.ctx =
		effect.deps =
		effect.fn =
		effect.nodes =
		effect.ac =
			null;
}

/**
 *
 * @param {TemplateNode | null} node
 * @param {TemplateNode} end
 */
function remove_effect_dom(node, end) {
	while (node !== null) {
		/** @type {TemplateNode | null} */
		var next = node === end ? null : get_next_sibling(node);

		node.remove();
		node = next;
	}
}

/**
 * Detach an effect from the effect tree, freeing up memory and
 * reducing the amount of work that happens on subsequent traversals
 * @param {Effect} effect
 */
function unlink_effect(effect) {
	var parent = effect.parent;
	var prev = effect.prev;
	var next = effect.next;

	if (prev !== null) prev.next = next;
	if (next !== null) next.prev = prev;

	if (parent !== null) {
		if (parent.first === effect) parent.first = next;
		if (parent.last === effect) parent.last = prev;
	}
}

/**
 * When a block effect is removed, we don't immediately destroy it or yank it
 * out of the DOM, because it might have transitions. Instead, we 'pause' it.
 * It stays around (in memory, and in the DOM) until outro transitions have
 * completed, and if the state change is reversed then we _resume_ it.
 * A paused effect does not update, and the DOM subtree becomes inert.
 * @param {Effect} effect
 * @param {() => void} [callback]
 * @param {boolean} [destroy]
 */
function pause_effect(effect, callback, destroy = true) {
	/** @type {TransitionManager[]} */
	var transitions = [];

	pause_children(effect, transitions, true);

	var fn = () => {
		if (destroy) destroy_effect(effect);
		if (callback) callback();
	};

	var remaining = transitions.length;
	if (remaining > 0) {
		var check = () => --remaining || fn();
		for (var transition of transitions) {
			transition.out(check);
		}
	} else {
		fn();
	}
}

/**
 * @param {Effect} effect
 * @param {TransitionManager[]} transitions
 * @param {boolean} local
 */
function pause_children(effect, transitions, local) {
	if ((effect.f & INERT) !== 0) return;
	effect.f ^= INERT;

	var t = effect.nodes && effect.nodes.t;

	if (t !== null) {
		for (const transition of t) {
			if (transition.is_global || local) {
				transitions.push(transition);
			}
		}
	}

	var child = effect.first;

	while (child !== null) {
		var sibling = child.next;
		var transparent =
			(child.f & EFFECT_TRANSPARENT) !== 0 ||
			// If this is a branch effect without a block effect parent,
			// it means the parent block effect was pruned. In that case,
			// transparency information was transferred to the branch effect.
			((child.f & BRANCH_EFFECT) !== 0 && (effect.f & BLOCK_EFFECT) !== 0);
		// TODO we don't need to call pause_children recursively with a linked list in place
		// it's slightly more involved though as we have to account for `transparent` changing
		// through the tree.
		pause_children(child, transitions, transparent ? local : false);
		child = sibling;
	}
}

/**
 * The opposite of `pause_effect`. We call this if (for example)
 * `x` becomes falsy then truthy: `{#if x}...{/if}`
 * @param {Effect} effect
 */
function resume_effect(effect) {
	resume_children(effect, true);
}

/**
 * @param {Effect} effect
 * @param {boolean} local
 */
function resume_children(effect, local) {
	if ((effect.f & INERT) === 0) return;
	effect.f ^= INERT;

	// If a dependency of this effect changed while it was paused,
	// schedule the effect to update. we don't use `is_dirty`
	// here because we don't want to eagerly recompute a derived like
	// `{#if foo}{foo.bar()}{/if}` if `foo` is now `undefined
	if ((effect.f & CLEAN) === 0) {
		set_signal_status(effect, DIRTY);
		schedule_effect(effect);
	}

	var child = effect.first;

	while (child !== null) {
		var sibling = child.next;
		var transparent = (child.f & EFFECT_TRANSPARENT) !== 0 || (child.f & BRANCH_EFFECT) !== 0;
		// TODO we don't need to call resume_children recursively with a linked list in place
		// it's slightly more involved though as we have to account for `transparent` changing
		// through the tree.
		resume_children(child, transparent ? local : false);
		child = sibling;
	}

	var t = effect.nodes && effect.nodes.t;

	if (t !== null) {
		for (const transition of t) {
			if (transition.is_global || local) {
				transition.in();
			}
		}
	}
}

/**
 * @param {Effect} effect
 * @param {DocumentFragment} fragment
 */
function move_effect(effect, fragment) {
	if (!effect.nodes) return;

	/** @type {TemplateNode | null} */
	var node = effect.nodes.start;
	var end = effect.nodes.end;

	while (node !== null) {
		/** @type {TemplateNode | null} */
		var next = node === end ? null : get_next_sibling(node);

		fragment.append(node);
		node = next;
	}
}

/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */

let is_updating_effect = false;

let is_destroying_effect = false;

/** @param {boolean} value */
function set_is_destroying_effect(value) {
	is_destroying_effect = value;
}

/** @type {null | Reaction} */
let active_reaction = null;

let untracking = false;

/** @param {null | Reaction} reaction */
function set_active_reaction(reaction) {
	active_reaction = reaction;
}

/** @type {null | Effect} */
let active_effect = null;

/** @param {null | Effect} effect */
function set_active_effect(effect) {
	active_effect = effect;
}

/**
 * When sources are created within a reaction, reading and writing
 * them within that reaction should not cause a re-run
 * @type {null | Source[]}
 */
let current_sources = null;

/** @param {Value} value */
function push_reaction_value(value) {
	if (active_reaction !== null && (true)) {
		if (current_sources === null) {
			current_sources = [value];
		} else {
			current_sources.push(value);
		}
	}
}

/**
 * The dependencies of the reaction that is currently being executed. In many cases,
 * the dependencies are unchanged between runs, and so this will be `null` unless
 * and until a new dependency is accessed — we track this via `skipped_deps`
 * @type {null | Value[]}
 */
let new_deps = null;

let skipped_deps = 0;

/**
 * Tracks writes that the effect it's executed in doesn't listen to yet,
 * so that the dependency can be added to the effect later on if it then reads it
 * @type {null | Source[]}
 */
let untracked_writes = null;

/** @param {null | Source[]} value */
function set_untracked_writes(value) {
	untracked_writes = value;
}

/**
 * @type {number} Used by sources and deriveds for handling updates.
 * Version starts from 1 so that unowned deriveds differentiate between a created effect and a run one for tracing
 **/
let write_version = 1;

/** @type {number} Used to version each read of a source of derived to avoid duplicating depedencies inside a reaction */
let read_version = 0;

let update_version = read_version;

/** @param {number} value */
function set_update_version(value) {
	update_version = value;
}

function increment_write_version() {
	return ++write_version;
}

/**
 * Determines whether a derived or effect is dirty.
 * If it is MAYBE_DIRTY, will set the status to CLEAN
 * @param {Reaction} reaction
 * @returns {boolean}
 */
function is_dirty(reaction) {
	var flags = reaction.f;

	if ((flags & DIRTY) !== 0) {
		return true;
	}

	if (flags & DERIVED) {
		reaction.f &= ~WAS_MARKED;
	}

	if ((flags & MAYBE_DIRTY) !== 0) {
		var dependencies = /** @type {Value[]} */ (reaction.deps);
		var length = dependencies.length;

		for (var i = 0; i < length; i++) {
			var dependency = dependencies[i];

			if (is_dirty(/** @type {Derived} */ (dependency))) {
				update_derived(/** @type {Derived} */ (dependency));
			}

			if (dependency.wv > reaction.wv) {
				return true;
			}
		}

		if (
			(flags & CONNECTED) !== 0 &&
			// During time traveling we don't want to reset the status so that
			// traversal of the graph in the other batches still happens
			batch_values === null
		) {
			set_signal_status(reaction, CLEAN);
		}
	}

	return false;
}

/**
 * @param {Value} signal
 * @param {Effect} effect
 * @param {boolean} [root]
 */
function schedule_possible_effect_self_invalidation(signal, effect, root = true) {
	var reactions = signal.reactions;
	if (reactions === null) return;

	if (current_sources !== null && includes.call(current_sources, signal)) {
		return;
	}

	for (var i = 0; i < reactions.length; i++) {
		var reaction = reactions[i];

		if ((reaction.f & DERIVED) !== 0) {
			schedule_possible_effect_self_invalidation(/** @type {Derived} */ (reaction), effect, false);
		} else if (effect === reaction) {
			if (root) {
				set_signal_status(reaction, DIRTY);
			} else if ((reaction.f & CLEAN) !== 0) {
				set_signal_status(reaction, MAYBE_DIRTY);
			}
			schedule_effect(/** @type {Effect} */ (reaction));
		}
	}
}

/** @param {Reaction} reaction */
function update_reaction(reaction) {
	var previous_deps = new_deps;
	var previous_skipped_deps = skipped_deps;
	var previous_untracked_writes = untracked_writes;
	var previous_reaction = active_reaction;
	var previous_sources = current_sources;
	var previous_component_context = component_context;
	var previous_untracking = untracking;
	var previous_update_version = update_version;

	var flags = reaction.f;

	new_deps = /** @type {null | Value[]} */ (null);
	skipped_deps = 0;
	untracked_writes = null;
	active_reaction = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;

	current_sources = null;
	set_component_context(reaction.ctx);
	untracking = false;
	update_version = ++read_version;

	if (reaction.ac !== null) {
		without_reactive_context(() => {
			/** @type {AbortController} */ (reaction.ac).abort(STALE_REACTION);
		});

		reaction.ac = null;
	}

	try {
		reaction.f |= REACTION_IS_UPDATING;
		var fn = /** @type {Function} */ (reaction.fn);
		var result = fn();
		var deps = reaction.deps;

		// Don't remove reactions during fork;
		// they must remain for when fork is discarded
		var is_fork = current_batch?.is_fork;

		if (new_deps !== null) {
			var i;

			if (!is_fork) {
				remove_reactions(reaction, skipped_deps);
			}

			if (deps !== null && skipped_deps > 0) {
				deps.length = skipped_deps + new_deps.length;
				for (i = 0; i < new_deps.length; i++) {
					deps[skipped_deps + i] = new_deps[i];
				}
			} else {
				reaction.deps = deps = new_deps;
			}

			if (effect_tracking() && (reaction.f & CONNECTED) !== 0) {
				for (i = skipped_deps; i < deps.length; i++) {
					(deps[i].reactions ??= []).push(reaction);
				}
			}
		} else if (!is_fork && deps !== null && skipped_deps < deps.length) {
			remove_reactions(reaction, skipped_deps);
			deps.length = skipped_deps;
		}

		// If we're inside an effect and we have untracked writes, then we need to
		// ensure that if any of those untracked writes result in re-invalidation
		// of the current effect, then that happens accordingly
		if (
			is_runes() &&
			untracked_writes !== null &&
			!untracking &&
			deps !== null &&
			(reaction.f & (DERIVED | MAYBE_DIRTY | DIRTY)) === 0
		) {
			for (i = 0; i < /** @type {Source[]} */ (untracked_writes).length; i++) {
				schedule_possible_effect_self_invalidation(
					untracked_writes[i],
					/** @type {Effect} */ (reaction)
				);
			}
		}

		// If we are returning to an previous reaction then
		// we need to increment the read version to ensure that
		// any dependencies in this reaction aren't marked with
		// the same version
		if (previous_reaction !== null && previous_reaction !== reaction) {
			read_version++;

			// update the `rv` of the previous reaction's deps — both existing and new —
			// so that they are not added again
			if (previous_reaction.deps !== null) {
				for (let i = 0; i < previous_skipped_deps; i += 1) {
					previous_reaction.deps[i].rv = read_version;
				}
			}

			if (previous_deps !== null) {
				for (const dep of previous_deps) {
					dep.rv = read_version;
				}
			}

			if (untracked_writes !== null) {
				if (previous_untracked_writes === null) {
					previous_untracked_writes = untracked_writes;
				} else {
					previous_untracked_writes.push(.../** @type {Source[]} */ (untracked_writes));
				}
			}
		}

		if ((reaction.f & ERROR_VALUE) !== 0) {
			reaction.f ^= ERROR_VALUE;
		}

		return result;
	} catch (error) {
		return handle_error(error);
	} finally {
		reaction.f ^= REACTION_IS_UPDATING;
		new_deps = previous_deps;
		skipped_deps = previous_skipped_deps;
		untracked_writes = previous_untracked_writes;
		active_reaction = previous_reaction;
		current_sources = previous_sources;
		set_component_context(previous_component_context);
		untracking = previous_untracking;
		update_version = previous_update_version;
	}
}

/**
 * @template V
 * @param {Reaction} signal
 * @param {Value<V>} dependency
 * @returns {void}
 */
function remove_reaction(signal, dependency) {
	let reactions = dependency.reactions;
	if (reactions !== null) {
		var index = index_of.call(reactions, signal);
		if (index !== -1) {
			var new_length = reactions.length - 1;
			if (new_length === 0) {
				reactions = dependency.reactions = null;
			} else {
				// Swap with last element and then remove.
				reactions[index] = reactions[new_length];
				reactions.pop();
			}
		}
	}

	// If the derived has no reactions, then we can disconnect it from the graph,
	// allowing it to either reconnect in the future, or be GC'd by the VM.
	if (
		reactions === null &&
		(dependency.f & DERIVED) !== 0 &&
		// Destroying a child effect while updating a parent effect can cause a dependency to appear
		// to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
		// allows us to skip the expensive work of disconnecting and immediately reconnecting it
		(new_deps === null || !includes.call(new_deps, dependency))
	) {
		var derived = /** @type {Derived} */ (dependency);

		// If we are working with a derived that is owned by an effect, then mark it as being
		// disconnected and remove the mark flag, as it cannot be reliably removed otherwise
		if ((derived.f & CONNECTED) !== 0) {
			derived.f ^= CONNECTED;
			derived.f &= ~WAS_MARKED;
		}

		update_derived_status(derived);

		// Disconnect any reactions owned by this reaction
		destroy_derived_effects(derived);
		remove_reactions(derived, 0);
	}
}

/**
 * @param {Reaction} signal
 * @param {number} start_index
 * @returns {void}
 */
function remove_reactions(signal, start_index) {
	var dependencies = signal.deps;
	if (dependencies === null) return;

	for (var i = start_index; i < dependencies.length; i++) {
		remove_reaction(signal, dependencies[i]);
	}
}

/**
 * @param {Effect} effect
 * @returns {void}
 */
function update_effect(effect) {
	var flags = effect.f;

	if ((flags & DESTROYED) !== 0) {
		return;
	}

	set_signal_status(effect, CLEAN);

	var previous_effect = active_effect;
	var was_updating_effect = is_updating_effect;

	active_effect = effect;
	is_updating_effect = true;

	if (DEV) {
		var previous_component_fn = dev_current_component_function;
		set_dev_current_component_function(effect.component_function);
		var previous_stack = /** @type {any} */ (dev_stack);
		// only block effects have a dev stack, keep the current one otherwise
		set_dev_stack(effect.dev_stack ?? dev_stack);
	}

	try {
		if ((flags & (BLOCK_EFFECT | MANAGED_EFFECT)) !== 0) {
			destroy_block_effect_children(effect);
		} else {
			destroy_effect_children(effect);
		}

		execute_effect_teardown(effect);
		var teardown = update_reaction(effect);
		effect.teardown = typeof teardown === 'function' ? teardown : null;
		effect.wv = write_version;

		// In DEV, increment versions of any sources that were written to during the effect,
		// so that they are correctly marked as dirty when the effect re-runs
		var dep; if (DEV && tracing_mode_flag && (effect.f & DIRTY) !== 0 && effect.deps !== null) ;
	} finally {
		is_updating_effect = was_updating_effect;
		active_effect = previous_effect;

		if (DEV) {
			set_dev_current_component_function(previous_component_fn);
			set_dev_stack(previous_stack);
		}
	}
}

/**
 * Returns a promise that resolves once any pending state changes have been applied.
 * @returns {Promise<void>}
 */
async function tick() {

	await Promise.resolve();

	// By calling flushSync we guarantee that any pending state changes are applied after one tick.
	// TODO look into whether we can make flushing subsequent updates synchronously in the future.
	flushSync();
}

/**
 * @template V
 * @param {Value<V>} signal
 * @returns {V}
 */
function get(signal) {
	var flags = signal.f;
	var is_derived = (flags & DERIVED) !== 0;

	// Register the dependency on the current reaction signal.
	if (active_reaction !== null && !untracking) {
		// if we're in a derived that is being read inside an _async_ derived,
		// it's possible that the effect was already destroyed. In this case,
		// we don't add the dependency, because that would create a memory leak
		var destroyed = active_effect !== null && (active_effect.f & DESTROYED) !== 0;

		if (!destroyed && (current_sources === null || !includes.call(current_sources, signal))) {
			var deps = active_reaction.deps;

			if ((active_reaction.f & REACTION_IS_UPDATING) !== 0) {
				// we're in the effect init/update cycle
				if (signal.rv < read_version) {
					signal.rv = read_version;

					// If the signal is accessing the same dependencies in the same
					// order as it did last time, increment `skipped_deps`
					// rather than updating `new_deps`, which creates GC cost
					if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
						skipped_deps++;
					} else if (new_deps === null) {
						new_deps = [signal];
					} else {
						new_deps.push(signal);
					}
				}
			} else {
				// we're adding a dependency outside the init/update cycle
				// (i.e. after an `await`)
				(active_reaction.deps ??= []).push(signal);

				var reactions = signal.reactions;

				if (reactions === null) {
					signal.reactions = [active_reaction];
				} else if (!includes.call(reactions, active_reaction)) {
					reactions.push(active_reaction);
				}
			}
		}
	}

	if (DEV) {
		// TODO reinstate this, but make it actually work
		// if (current_async_effect) {
		// 	var tracking = (current_async_effect.f & REACTION_IS_UPDATING) !== 0;
		// 	var was_read = current_async_effect.deps?.includes(signal);

		// 	if (!tracking && !untracking && !was_read) {
		// 		w.await_reactivity_loss(/** @type {string} */ (signal.label));

		// 		var trace = get_error('traced at');
		// 		// eslint-disable-next-line no-console
		// 		if (trace) console.warn(trace);
		// 	}
		// }

		recent_async_deriveds.delete(signal);
	}

	if (is_destroying_effect && old_values.has(signal)) {
		return old_values.get(signal);
	}

	if (is_derived) {
		var derived = /** @type {Derived} */ (signal);

		if (is_destroying_effect) {
			var value = derived.v;

			// if the derived is dirty and has reactions, or depends on the values that just changed, re-execute
			// (a derived can be maybe_dirty due to the effect destroy removing its last reaction)
			if (
				((derived.f & CLEAN) === 0 && derived.reactions !== null) ||
				depends_on_old_values(derived)
			) {
				value = execute_derived(derived);
			}

			old_values.set(derived, value);

			return value;
		}

		// connect disconnected deriveds if we are reading them inside an effect,
		// or inside another derived that is already connected
		var should_connect =
			(derived.f & CONNECTED) === 0 &&
			!untracking &&
			active_reaction !== null &&
			(is_updating_effect || (active_reaction.f & CONNECTED) !== 0);

		var is_new = derived.deps === null;

		if (is_dirty(derived)) {
			if (should_connect) {
				// set the flag before `update_derived`, so that the derived
				// is added as a reaction to its dependencies
				derived.f |= CONNECTED;
			}

			update_derived(derived);
		}

		if (should_connect && !is_new) {
			reconnect(derived);
		}
	}

	if (batch_values?.has(signal)) {
		return batch_values.get(signal);
	}

	if ((signal.f & ERROR_VALUE) !== 0) {
		throw signal.v;
	}

	return signal.v;
}

/**
 * (Re)connect a disconnected derived, so that it is notified
 * of changes in `mark_reactions`
 * @param {Derived} derived
 */
function reconnect(derived) {
	if (derived.deps === null) return;

	derived.f |= CONNECTED;

	for (const dep of derived.deps) {
		(dep.reactions ??= []).push(derived);

		if ((dep.f & DERIVED) !== 0 && (dep.f & CONNECTED) === 0) {
			reconnect(/** @type {Derived} */ (dep));
		}
	}
}

/** @param {Derived} derived */
function depends_on_old_values(derived) {
	if (derived.v === UNINITIALIZED) return true; // we don't know, so assume the worst
	if (derived.deps === null) return false;

	for (const dep of derived.deps) {
		if (old_values.has(dep)) {
			return true;
		}

		if ((dep.f & DERIVED) !== 0 && depends_on_old_values(/** @type {Derived} */ (dep))) {
			return true;
		}
	}

	return false;
}

/**
 * When used inside a [`$derived`](https://svelte.dev/docs/svelte/$derived) or [`$effect`](https://svelte.dev/docs/svelte/$effect),
 * any state read inside `fn` will not be treated as a dependency.
 *
 * ```ts
 * $effect(() => {
 *   // this will run when `data` changes, but not when `time` changes
 *   save(data, {
 *     timestamp: untrack(() => time)
 *   });
 * });
 * ```
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function untrack(fn) {
	var previous_untracking = untracking;
	try {
		untracking = true;
		return fn();
	} finally {
		untracking = previous_untracking;
	}
}

/**
 * Subset of delegated events which should be passive by default.
 * These two are already passive via browser defaults on window, document and body.
 * But since
 * - we're delegating them
 * - they happen often
 * - they apply to mobile which is generally less performant
 * we're marking them as passive by default for other elements, too.
 */
const PASSIVE_EVENTS = ['touchstart', 'touchmove'];

/**
 * Returns `true` if `name` is a passive event
 * @param {string} name
 */
function is_passive_event(name) {
	return PASSIVE_EVENTS.includes(name);
}

/** @type {Set<string>} */
const all_registered_events = new Set();

/** @type {Set<(events: Array<string>) => void>} */
const root_event_handles = new Set();

/**
 * @param {string} event_name
 * @param {EventTarget} dom
 * @param {EventListener} [handler]
 * @param {AddEventListenerOptions} [options]
 */
function create_event(event_name, dom, handler, options = {}) {
	/**
	 * @this {EventTarget}
	 */
	function target_handler(/** @type {Event} */ event) {
		if (!options.capture) {
			// Only call in the bubble phase, else delegated events would be called before the capturing events
			handle_event_propagation.call(dom, event);
		}
		if (!event.cancelBubble) {
			return without_reactive_context(() => {
				return handler?.call(this, event);
			});
		}
	}

	// Chrome has a bug where pointer events don't work when attached to a DOM element that has been cloned
	// with cloneNode() and the DOM element is disconnected from the document. To ensure the event works, we
	// defer the attachment till after it's been appended to the document. TODO: remove this once Chrome fixes
	// this bug. The same applies to wheel events and touch events.
	if (
		event_name.startsWith('pointer') ||
		event_name.startsWith('touch') ||
		event_name === 'wheel'
	) {
		queue_micro_task(() => {
			dom.addEventListener(event_name, target_handler, options);
		});
	} else {
		dom.addEventListener(event_name, target_handler, options);
	}

	return target_handler;
}

/**
 * @param {string} event_name
 * @param {Element} dom
 * @param {EventListener} [handler]
 * @param {boolean} [capture]
 * @param {boolean} [passive]
 * @returns {void}
 */
function event(event_name, dom, handler, capture, passive) {
	var options = { capture, passive };
	var target_handler = create_event(event_name, dom, handler, options);

	if (
		dom === document.body ||
		// @ts-ignore
		dom === window ||
		// @ts-ignore
		dom === document ||
		// Firefox has quirky behavior, it can happen that we still get "canplay" events when the element is already removed
		dom instanceof HTMLMediaElement
	) {
		teardown(() => {
			dom.removeEventListener(event_name, target_handler, options);
		});
	}
}

/**
 * @param {Array<string>} events
 * @returns {void}
 */
function delegate(events) {
	for (var i = 0; i < events.length; i++) {
		all_registered_events.add(events[i]);
	}

	for (var fn of root_event_handles) {
		fn(events);
	}
}

// used to store the reference to the currently propagated event
// to prevent garbage collection between microtasks in Firefox
// If the event object is GCed too early, the expando __root property
// set on the event object is lost, causing the event delegation
// to process the event twice
let last_propagated_event = null;

/**
 * @this {EventTarget}
 * @param {Event} event
 * @returns {void}
 */
function handle_event_propagation(event) {
	var handler_element = this;
	var owner_document = /** @type {Node} */ (handler_element).ownerDocument;
	var event_name = event.type;
	var path = event.composedPath?.() || [];
	var current_target = /** @type {null | Element} */ (path[0] || event.target);

	last_propagated_event = event;

	// composedPath contains list of nodes the event has propagated through.
	// We check __root to skip all nodes below it in case this is a
	// parent of the __root node, which indicates that there's nested
	// mounted apps. In this case we don't want to trigger events multiple times.
	var path_idx = 0;

	// the `last_propagated_event === event` check is redundant, but
	// without it the variable will be DCE'd and things will
	// fail mysteriously in Firefox
	// @ts-expect-error is added below
	var handled_at = last_propagated_event === event && event.__root;

	if (handled_at) {
		var at_idx = path.indexOf(handled_at);
		if (
			at_idx !== -1 &&
			(handler_element === document || handler_element === /** @type {any} */ (window))
		) {
			// This is the fallback document listener or a window listener, but the event was already handled
			// -> ignore, but set handle_at to document/window so that we're resetting the event
			// chain in case someone manually dispatches the same event object again.
			// @ts-expect-error
			event.__root = handler_element;
			return;
		}

		// We're deliberately not skipping if the index is higher, because
		// someone could create an event programmatically and emit it multiple times,
		// in which case we want to handle the whole propagation chain properly each time.
		// (this will only be a false negative if the event is dispatched multiple times and
		// the fallback document listener isn't reached in between, but that's super rare)
		var handler_idx = path.indexOf(handler_element);
		if (handler_idx === -1) {
			// handle_idx can theoretically be -1 (happened in some JSDOM testing scenarios with an event listener on the window object)
			// so guard against that, too, and assume that everything was handled at this point.
			return;
		}

		if (at_idx <= handler_idx) {
			path_idx = at_idx;
		}
	}

	current_target = /** @type {Element} */ (path[path_idx] || event.target);
	// there can only be one delegated event per element, and we either already handled the current target,
	// or this is the very first target in the chain which has a non-delegated listener, in which case it's safe
	// to handle a possible delegated event on it later (through the root delegation listener for example).
	if (current_target === handler_element) return;

	// Proxy currentTarget to correct target
	define_property(event, 'currentTarget', {
		configurable: true,
		get() {
			return current_target || owner_document;
		}
	});

	// This started because of Chromium issue https://chromestatus.com/feature/5128696823545856,
	// where removal or moving of of the DOM can cause sync `blur` events to fire, which can cause logic
	// to run inside the current `active_reaction`, which isn't what we want at all. However, on reflection,
	// it's probably best that all event handled by Svelte have this behaviour, as we don't really want
	// an event handler to run in the context of another reaction or effect.
	var previous_reaction = active_reaction;
	var previous_effect = active_effect;
	set_active_reaction(null);
	set_active_effect(null);

	try {
		/**
		 * @type {unknown}
		 */
		var throw_error;
		/**
		 * @type {unknown[]}
		 */
		var other_errors = [];

		while (current_target !== null) {
			/** @type {null | Element} */
			var parent_element =
				current_target.assignedSlot ||
				current_target.parentNode ||
				/** @type {any} */ (current_target).host ||
				null;

			try {
				// @ts-expect-error
				var delegated = current_target['__' + event_name];

				if (
					delegated != null &&
					(!(/** @type {any} */ (current_target).disabled) ||
						// DOM could've been updated already by the time this is reached, so we check this as well
						// -> the target could not have been disabled because it emits the event in the first place
						event.target === current_target)
				) {
					delegated.call(current_target, event);
				}
			} catch (error) {
				if (throw_error) {
					other_errors.push(error);
				} else {
					throw_error = error;
				}
			}
			if (event.cancelBubble || parent_element === handler_element || parent_element === null) {
				break;
			}
			current_target = parent_element;
		}

		if (throw_error) {
			for (let error of other_errors) {
				// Throw the rest of the errors, one-by-one on a microtask
				queueMicrotask(() => {
					throw error;
				});
			}
			throw throw_error;
		}
	} finally {
		// @ts-expect-error is used above
		event.__root = handler_element;
		// @ts-ignore remove proxy on currentTarget
		delete event.currentTarget;
		set_active_reaction(previous_reaction);
		set_active_effect(previous_effect);
	}
}

/** @param {string} html */
function create_fragment_from_html(html) {
	var elem = document.createElement('template');
	elem.innerHTML = html.replaceAll('<!>', '<!---->'); // XHTML compliance
	return elem.content;
}

/** @import { Effect, EffectNodes, TemplateNode } from '#client' */
/** @import { TemplateStructure } from './types' */

/**
 * @param {TemplateNode} start
 * @param {TemplateNode | null} end
 */
function assign_nodes(start, end) {
	var effect = /** @type {Effect} */ (active_effect);
	if (effect.nodes === null) {
		effect.nodes = { start, end, a: null, t: null };
	}
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
function from_html(content, flags) {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;

	/** @type {Node} */
	var node;

	/**
	 * Whether or not the first item is a text/element node. If not, we need to
	 * create an additional comment node to act as `effect.nodes.start`
	 */
	var has_start = !content.startsWith('<!>');

	return () => {

		if (node === undefined) {
			node = create_fragment_from_html(has_start ? content : '<!>' + content);
			if (!is_fragment) node = /** @type {TemplateNode} */ (get_first_child(node));
		}

		var clone = /** @type {TemplateNode} */ (
			use_import_node || is_firefox ? document.importNode(node, true) : node.cloneNode(true)
		);

		if (is_fragment) {
			var start = /** @type {TemplateNode} */ (get_first_child(clone));
			var end = /** @type {TemplateNode} */ (clone.lastChild);

			assign_nodes(start, end);
		} else {
			assign_nodes(clone, clone);
		}

		return clone;
	};
}

/**
 * @returns {TemplateNode | DocumentFragment}
 */
function comment() {

	var frag = document.createDocumentFragment();
	var start = document.createComment('');
	var anchor = create_text();
	frag.append(start, anchor);

	assign_nodes(start, anchor);

	return frag;
}

/**
 * Assign the created (or in hydration mode, traversed) dom elements to the current block
 * and insert the elements into the dom (in client mode).
 * @param {Text | Comment | Element} anchor
 * @param {DocumentFragment | Element} dom
 */
function append(anchor, dom) {

	if (anchor === null) {
		// edge case — void `<svelte:element>` with content
		return;
	}

	anchor.before(/** @type {Node} */ (dom));
}

/** @import { ComponentContext, Effect, EffectNodes, TemplateNode } from '#client' */
/** @import { Component, ComponentType, SvelteComponent, MountOptions } from '../../index.js' */

/**
 * @param {Element} text
 * @param {string} value
 * @returns {void}
 */
function set_text(text, value) {
	// For objects, we apply string coercion (which might make things like $state array references in the template reactive) before diffing
	var str = value == null ? '' : typeof value === 'object' ? value + '' : value;
	// @ts-expect-error
	if (str !== (text.__t ??= text.nodeValue)) {
		// @ts-expect-error
		text.__t = str;
		text.nodeValue = str + '';
	}
}

/**
 * Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.
 * Transitions will play during the initial render unless the `intro` option is set to `false`.
 *
 * @template {Record<string, any>} Props
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
 * @param {MountOptions<Props>} options
 * @returns {Exports}
 */
function mount(component, options) {
	return _mount(component, options);
}

/** @type {Map<string, number>} */
const document_listeners = new Map();

/**
 * @template {Record<string, any>} Exports
 * @param {ComponentType<SvelteComponent<any>> | Component<any>} Component
 * @param {MountOptions} options
 * @returns {Exports}
 */
function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
	init_operations();

	/** @type {Set<string>} */
	var registered_events = new Set();

	/** @param {Array<string>} events */
	var event_handle = (events) => {
		for (var i = 0; i < events.length; i++) {
			var event_name = events[i];

			if (registered_events.has(event_name)) continue;
			registered_events.add(event_name);

			var passive = is_passive_event(event_name);

			// Add the event listener to both the container and the document.
			// The container listener ensures we catch events from within in case
			// the outer content stops propagation of the event.
			target.addEventListener(event_name, handle_event_propagation, { passive });

			var n = document_listeners.get(event_name);

			if (n === undefined) {
				// The document listener ensures we catch events that originate from elements that were
				// manually moved outside of the container (e.g. via manual portals).
				document.addEventListener(event_name, handle_event_propagation, { passive });
				document_listeners.set(event_name, 1);
			} else {
				document_listeners.set(event_name, n + 1);
			}
		}
	};

	event_handle(array_from(all_registered_events));
	root_event_handles.add(event_handle);

	/** @type {Exports} */
	// @ts-expect-error will be defined because the render effect runs synchronously
	var component = undefined;

	var unmount = component_root(() => {
		var anchor_node = anchor ?? target.appendChild(create_text());

		boundary(
			/** @type {TemplateNode} */ (anchor_node),
			{
				pending: () => {}
			},
			(anchor_node) => {
				if (context) {
					push({});
					var ctx = /** @type {ComponentContext} */ (component_context);
					ctx.c = context;
				}

				if (events) {
					// We can't spread the object or else we'd lose the state proxy stuff, if it is one
					/** @type {any} */ (props).$$events = events;
				}
				// @ts-expect-error the public typings are not what the actual function looks like
				component = Component(anchor_node, props) || {};

				if (context) {
					pop();
				}
			}
		);

		return () => {
			for (var event_name of registered_events) {
				target.removeEventListener(event_name, handle_event_propagation);

				var n = /** @type {number} */ (document_listeners.get(event_name));

				if (--n === 0) {
					document.removeEventListener(event_name, handle_event_propagation);
					document_listeners.delete(event_name);
				} else {
					document_listeners.set(event_name, n);
				}
			}

			root_event_handles.delete(event_handle);

			if (anchor_node !== anchor) {
				anchor_node.parentNode?.removeChild(anchor_node);
			}
		};
	});

	mounted_components.set(component, unmount);
	return component;
}

/**
 * References of the components that were mounted or hydrated.
 * Uses a `WeakMap` to avoid memory leaks.
 */
let mounted_components = new WeakMap();

/**
 * Unmounts a component that was previously mounted using `mount` or `hydrate`.
 *
 * Since 5.13.0, if `options.outro` is `true`, [transitions](https://svelte.dev/docs/svelte/transition) will play before the component is removed from the DOM.
 *
 * Returns a `Promise` that resolves after transitions have completed if `options.outro` is true, or immediately otherwise (prior to 5.13.0, returns `void`).
 *
 * ```js
 * import { mount, unmount } from 'svelte';
 * import App from './App.svelte';
 *
 * const app = mount(App, { target: document.body });
 *
 * // later...
 * unmount(app, { outro: true });
 * ```
 * @param {Record<string, any>} component
 * @param {{ outro?: boolean }} [options]
 * @returns {Promise<void>}
 */
function unmount(component, options) {
	const fn = mounted_components.get(component);

	if (fn) {
		mounted_components.delete(component);
		return fn(options);
	}

	if (DEV) {
		if (STATE_SYMBOL in component) {
			state_proxy_unmount();
		} else {
			lifecycle_double_unmount();
		}
	}

	return Promise.resolve();
}

/** @import { Effect, TemplateNode } from '#client' */

/**
 * @typedef {{ effect: Effect, fragment: DocumentFragment }} Branch
 */

/**
 * @template Key
 */
class BranchManager {
	/** @type {TemplateNode} */
	anchor;

	/** @type {Map<Batch, Key>} */
	#batches = new Map();

	/**
	 * Map of keys to effects that are currently rendered in the DOM.
	 * These effects are visible and actively part of the document tree.
	 * Example:
	 * ```
	 * {#if condition}
	 * 	foo
	 * {:else}
	 * 	bar
	 * {/if}
	 * ```
	 * Can result in the entries `true->Effect` and `false->Effect`
	 * @type {Map<Key, Effect>}
	 */
	#onscreen = new Map();

	/**
	 * Similar to #onscreen with respect to the keys, but contains branches that are not yet
	 * in the DOM, because their insertion is deferred.
	 * @type {Map<Key, Branch>}
	 */
	#offscreen = new Map();

	/**
	 * Keys of effects that are currently outroing
	 * @type {Set<Key>}
	 */
	#outroing = new Set();

	/**
	 * Whether to pause (i.e. outro) on change, or destroy immediately.
	 * This is necessary for `<svelte:element>`
	 */
	#transition = true;

	/**
	 * @param {TemplateNode} anchor
	 * @param {boolean} transition
	 */
	constructor(anchor, transition = true) {
		this.anchor = anchor;
		this.#transition = transition;
	}

	#commit = () => {
		var batch = /** @type {Batch} */ (current_batch);

		// if this batch was made obsolete, bail
		if (!this.#batches.has(batch)) return;

		var key = /** @type {Key} */ (this.#batches.get(batch));

		var onscreen = this.#onscreen.get(key);

		if (onscreen) {
			// effect is already in the DOM — abort any current outro
			resume_effect(onscreen);
			this.#outroing.delete(key);
		} else {
			// effect is currently offscreen. put it in the DOM
			var offscreen = this.#offscreen.get(key);

			if (offscreen) {
				this.#onscreen.set(key, offscreen.effect);
				this.#offscreen.delete(key);

				// remove the anchor...
				/** @type {TemplateNode} */ (offscreen.fragment.lastChild).remove();

				// ...and append the fragment
				this.anchor.before(offscreen.fragment);
				onscreen = offscreen.effect;
			}
		}

		for (const [b, k] of this.#batches) {
			this.#batches.delete(b);

			if (b === batch) {
				// keep values for newer batches
				break;
			}

			const offscreen = this.#offscreen.get(k);

			if (offscreen) {
				// for older batches, destroy offscreen effects
				// as they will never be committed
				destroy_effect(offscreen.effect);
				this.#offscreen.delete(k);
			}
		}

		// outro/destroy all onscreen effects...
		for (const [k, effect] of this.#onscreen) {
			// ...except the one that was just committed
			//    or those that are already outroing (else the transition is aborted and the effect destroyed right away)
			if (k === key || this.#outroing.has(k)) continue;

			const on_destroy = () => {
				const keys = Array.from(this.#batches.values());

				if (keys.includes(k)) {
					// keep the effect offscreen, as another batch will need it
					var fragment = document.createDocumentFragment();
					move_effect(effect, fragment);

					fragment.append(create_text()); // TODO can we avoid this?

					this.#offscreen.set(k, { effect, fragment });
				} else {
					destroy_effect(effect);
				}

				this.#outroing.delete(k);
				this.#onscreen.delete(k);
			};

			if (this.#transition || !onscreen) {
				this.#outroing.add(k);
				pause_effect(effect, on_destroy, false);
			} else {
				on_destroy();
			}
		}
	};

	/**
	 * @param {Batch} batch
	 */
	#discard = (batch) => {
		this.#batches.delete(batch);

		const keys = Array.from(this.#batches.values());

		for (const [k, branch] of this.#offscreen) {
			if (!keys.includes(k)) {
				destroy_effect(branch.effect);
				this.#offscreen.delete(k);
			}
		}
	};

	/**
	 *
	 * @param {any} key
	 * @param {null | ((target: TemplateNode) => void)} fn
	 */
	ensure(key, fn) {
		var batch = /** @type {Batch} */ (current_batch);
		var defer = should_defer_append();

		if (fn && !this.#onscreen.has(key) && !this.#offscreen.has(key)) {
			if (defer) {
				var fragment = document.createDocumentFragment();
				var target = create_text();

				fragment.append(target);

				this.#offscreen.set(key, {
					effect: branch(() => fn(target)),
					fragment
				});
			} else {
				this.#onscreen.set(
					key,
					branch(() => fn(this.anchor))
				);
			}
		}

		this.#batches.set(batch, key);

		if (defer) {
			for (const [k, effect] of this.#onscreen) {
				if (k === key) {
					batch.skipped_effects.delete(effect);
				} else {
					batch.skipped_effects.add(effect);
				}
			}

			for (const [k, branch] of this.#offscreen) {
				if (k === key) {
					batch.skipped_effects.delete(branch.effect);
				} else {
					batch.skipped_effects.add(branch.effect);
				}
			}

			batch.oncommit(this.#commit);
			batch.ondiscard(this.#discard);
		} else {

			this.#commit();
		}
	}
}

/** @import { TemplateNode } from '#client' */

// TODO reinstate https://github.com/sveltejs/svelte/pull/15250

/**
 * @param {TemplateNode} node
 * @param {(branch: (fn: (anchor: Node) => void, flag?: boolean) => void) => void} fn
 * @param {boolean} [elseif] True if this is an `{:else if ...}` block rather than an `{#if ...}`, as that affects which transitions are considered 'local'
 * @returns {void}
 */
function if_block(node, fn, elseif = false) {

	var branches = new BranchManager(node);
	var flags = elseif ? EFFECT_TRANSPARENT : 0;

	/**
	 * @param {boolean} condition,
	 * @param {null | ((anchor: Node) => void)} fn
	 */
	function update_branch(condition, fn) {

		branches.ensure(condition, fn);
	}

	block(() => {
		var has_branch = false;

		fn((fn, flag = true) => {
			has_branch = true;
			update_branch(flag, fn);
		});

		if (!has_branch) {
			update_branch(false, null);
		}
	}, flags);
}

/** @import { EachItem, EachOutroGroup, EachState, Effect, EffectNodes, MaybeSource, Source, TemplateNode, TransitionManager, Value } from '#client' */
/** @import { Batch } from '../../reactivity/batch.js'; */

// When making substantive changes to this file, validate them with the each block stress test:
// https://svelte.dev/playground/1972b2cf46564476ad8c8c6405b23b7b
// This test also exists in this repo, as `packages/svelte/tests/manual/each-stress-test`

/**
 * @param {any} _
 * @param {number} i
 */
function index(_, i) {
	return i;
}

/**
 * Pause multiple effects simultaneously, and coordinate their
 * subsequent destruction. Used in each blocks
 * @param {EachState} state
 * @param {Effect[]} to_destroy
 * @param {null | Node} controlled_anchor
 */
function pause_effects(state, to_destroy, controlled_anchor) {
	/** @type {TransitionManager[]} */
	var transitions = [];
	var length = to_destroy.length;

	/** @type {EachOutroGroup} */
	var group;
	var remaining = to_destroy.length;

	for (var i = 0; i < length; i++) {
		let effect = to_destroy[i];

		pause_effect(
			effect,
			() => {
				if (group) {
					group.pending.delete(effect);
					group.done.add(effect);

					if (group.pending.size === 0) {
						var groups = /** @type {Set<EachOutroGroup>} */ (state.outrogroups);

						destroy_effects(array_from(group.done));
						groups.delete(group);

						if (groups.size === 0) {
							state.outrogroups = null;
						}
					}
				} else {
					remaining -= 1;
				}
			},
			false
		);
	}

	if (remaining === 0) {
		// If we're in a controlled each block (i.e. the block is the only child of an
		// element), and we are removing all items, _and_ there are no out transitions,
		// we can use the fast path — emptying the element and replacing the anchor
		var fast_path = transitions.length === 0 && controlled_anchor !== null;

		if (fast_path) {
			var anchor = /** @type {Element} */ (controlled_anchor);
			var parent_node = /** @type {Element} */ (anchor.parentNode);

			clear_text_content(parent_node);
			parent_node.append(anchor);

			state.items.clear();
		}

		destroy_effects(to_destroy, !fast_path);
	} else {
		group = {
			pending: new Set(to_destroy),
			done: new Set()
		};

		(state.outrogroups ??= new Set()).add(group);
	}
}

/**
 * @param {Effect[]} to_destroy
 * @param {boolean} remove_dom
 */
function destroy_effects(to_destroy, remove_dom = true) {
	// TODO only destroy effects if no pending batch needs them. otherwise,
	// just re-add the `EFFECT_OFFSCREEN` flag
	for (var i = 0; i < to_destroy.length; i++) {
		destroy_effect(to_destroy[i], remove_dom);
	}
}

/** @type {TemplateNode} */
var offscreen_anchor;

/**
 * @template V
 * @param {Element | Comment} node The next sibling node, or the parent node if this is a 'controlled' block
 * @param {number} flags
 * @param {() => V[]} get_collection
 * @param {(value: V, index: number) => any} get_key
 * @param {(anchor: Node, item: MaybeSource<V>, index: MaybeSource<number>) => void} render_fn
 * @param {null | ((anchor: Node) => void)} fallback_fn
 * @returns {void}
 */
function each(node, flags, get_collection, get_key, render_fn, fallback_fn = null) {
	var anchor = node;

	/** @type {Map<any, EachItem>} */
	var items = new Map();

	var is_controlled = (flags & EACH_IS_CONTROLLED) !== 0;

	if (is_controlled) {
		var parent_node = /** @type {Element} */ (node);

		anchor = parent_node.appendChild(create_text());
	}

	/** @type {Effect | null} */
	var fallback = null;

	// TODO: ideally we could use derived for runes mode but because of the ability
	// to use a store which can be mutated, we can't do that here as mutating a store
	// will still result in the collection array being the same from the store
	var each_array = derived_safe_equal(() => {
		var collection = get_collection();

		return is_array(collection) ? collection : collection == null ? [] : array_from(collection);
	});

	/** @type {V[]} */
	var array;

	var first_run = true;

	function commit() {
		state.fallback = fallback;
		reconcile(state, array, anchor, flags, get_key);

		if (fallback !== null) {
			if (array.length === 0) {
				if ((fallback.f & EFFECT_OFFSCREEN) === 0) {
					resume_effect(fallback);
				} else {
					fallback.f ^= EFFECT_OFFSCREEN;
					move(fallback, null, anchor);
				}
			} else {
				pause_effect(fallback, () => {
					// TODO only null out if no pending batch needs it,
					// otherwise re-add `fallback.fragment` and move the
					// effect into it
					fallback = null;
				});
			}
		}
	}

	var effect = block(() => {
		array = /** @type {V[]} */ (get(each_array));
		var length = array.length;

		var keys = new Set();
		var batch = /** @type {Batch} */ (current_batch);
		var defer = should_defer_append();

		for (var index = 0; index < length; index += 1) {

			var value = array[index];
			var key = get_key(value, index);

			var item = first_run ? null : items.get(key);

			if (item) {
				// update before reconciliation, to trigger any async updates
				if (item.v) internal_set(item.v, value);
				if (item.i) internal_set(item.i, index);

				if (defer) {
					batch.skipped_effects.delete(item.e);
				}
			} else {
				item = create_item(
					items,
					first_run ? anchor : (offscreen_anchor ??= create_text()),
					value,
					key,
					index,
					render_fn,
					flags,
					get_collection
				);

				if (!first_run) {
					item.e.f |= EFFECT_OFFSCREEN;
				}

				items.set(key, item);
			}

			keys.add(key);
		}

		if (length === 0 && fallback_fn && !fallback) {
			if (first_run) {
				fallback = branch(() => fallback_fn(anchor));
			} else {
				fallback = branch(() => fallback_fn((offscreen_anchor ??= create_text())));
				fallback.f |= EFFECT_OFFSCREEN;
			}
		}

		if (!first_run) {
			if (defer) {
				for (const [key, item] of items) {
					if (!keys.has(key)) {
						batch.skipped_effects.add(item.e);
					}
				}

				batch.oncommit(commit);
				batch.ondiscard(() => {
					// TODO presumably we need to do something here?
				});
			} else {
				commit();
			}
		}

		// When we mount the each block for the first time, the collection won't be
		// connected to this effect as the effect hasn't finished running yet and its deps
		// won't be assigned. However, it's possible that when reconciling the each block
		// that a mutation occurred and it's made the collection MAYBE_DIRTY, so reading the
		// collection again can provide consistency to the reactive graph again as the deriveds
		// will now be `CLEAN`.
		get(each_array);
	});

	/** @type {EachState} */
	var state = { effect, items, outrogroups: null, fallback };

	first_run = false;
}

/**
 * Skip past any non-branch effects (which could be created with `createSubscriber`, for example) to find the next branch effect
 * @param {Effect | null} effect
 * @returns {Effect | null}
 */
function skip_to_branch(effect) {
	while (effect !== null && (effect.f & BRANCH_EFFECT) === 0) {
		effect = effect.next;
	}
	return effect;
}

/**
 * Add, remove, or reorder items output by an each block as its input changes
 * @template V
 * @param {EachState} state
 * @param {Array<V>} array
 * @param {Element | Comment | Text} anchor
 * @param {number} flags
 * @param {(value: V, index: number) => any} get_key
 * @returns {void}
 */
function reconcile(state, array, anchor, flags, get_key) {
	var is_animated = (flags & EACH_IS_ANIMATED) !== 0;

	var length = array.length;
	var items = state.items;
	var current = skip_to_branch(state.effect.first);

	/** @type {undefined | Set<Effect>} */
	var seen;

	/** @type {Effect | null} */
	var prev = null;

	/** @type {undefined | Set<Effect>} */
	var to_animate;

	/** @type {Effect[]} */
	var matched = [];

	/** @type {Effect[]} */
	var stashed = [];

	/** @type {V} */
	var value;

	/** @type {any} */
	var key;

	/** @type {Effect | undefined} */
	var effect;

	/** @type {number} */
	var i;

	if (is_animated) {
		for (i = 0; i < length; i += 1) {
			value = array[i];
			key = get_key(value, i);
			effect = /** @type {EachItem} */ (items.get(key)).e;

			// offscreen == coming in now, no animation in that case,
			// else this would happen https://github.com/sveltejs/svelte/issues/17181
			if ((effect.f & EFFECT_OFFSCREEN) === 0) {
				effect.nodes?.a?.measure();
				(to_animate ??= new Set()).add(effect);
			}
		}
	}

	for (i = 0; i < length; i += 1) {
		value = array[i];
		key = get_key(value, i);

		effect = /** @type {EachItem} */ (items.get(key)).e;

		if (state.outrogroups !== null) {
			for (const group of state.outrogroups) {
				group.pending.delete(effect);
				group.done.delete(effect);
			}
		}

		if ((effect.f & EFFECT_OFFSCREEN) !== 0) {
			effect.f ^= EFFECT_OFFSCREEN;

			if (effect === current) {
				move(effect, null, anchor);
			} else {
				var next = prev ? prev.next : current;

				if (effect === state.effect.last) {
					state.effect.last = effect.prev;
				}

				if (effect.prev) effect.prev.next = effect.next;
				if (effect.next) effect.next.prev = effect.prev;
				link(state, prev, effect);
				link(state, effect, next);

				move(effect, next, anchor);
				prev = effect;

				matched = [];
				stashed = [];

				current = skip_to_branch(prev.next);
				continue;
			}
		}

		if ((effect.f & INERT) !== 0) {
			resume_effect(effect);
			if (is_animated) {
				effect.nodes?.a?.unfix();
				(to_animate ??= new Set()).delete(effect);
			}
		}

		if (effect !== current) {
			if (seen !== undefined && seen.has(effect)) {
				if (matched.length < stashed.length) {
					// more efficient to move later items to the front
					var start = stashed[0];
					var j;

					prev = start.prev;

					var a = matched[0];
					var b = matched[matched.length - 1];

					for (j = 0; j < matched.length; j += 1) {
						move(matched[j], start, anchor);
					}

					for (j = 0; j < stashed.length; j += 1) {
						seen.delete(stashed[j]);
					}

					link(state, a.prev, b.next);
					link(state, prev, a);
					link(state, b, start);

					current = start;
					prev = b;
					i -= 1;

					matched = [];
					stashed = [];
				} else {
					// more efficient to move earlier items to the back
					seen.delete(effect);
					move(effect, current, anchor);

					link(state, effect.prev, effect.next);
					link(state, effect, prev === null ? state.effect.first : prev.next);
					link(state, prev, effect);

					prev = effect;
				}

				continue;
			}

			matched = [];
			stashed = [];

			while (current !== null && current !== effect) {
				(seen ??= new Set()).add(current);
				stashed.push(current);
				current = skip_to_branch(current.next);
			}

			if (current === null) {
				continue;
			}
		}

		if ((effect.f & EFFECT_OFFSCREEN) === 0) {
			matched.push(effect);
		}

		prev = effect;
		current = skip_to_branch(effect.next);
	}

	if (state.outrogroups !== null) {
		for (const group of state.outrogroups) {
			if (group.pending.size === 0) {
				destroy_effects(array_from(group.done));
				state.outrogroups?.delete(group);
			}
		}

		if (state.outrogroups.size === 0) {
			state.outrogroups = null;
		}
	}

	if (current !== null || seen !== undefined) {
		/** @type {Effect[]} */
		var to_destroy = [];

		if (seen !== undefined) {
			for (effect of seen) {
				if ((effect.f & INERT) === 0) {
					to_destroy.push(effect);
				}
			}
		}

		while (current !== null) {
			// If the each block isn't inert, then inert effects are currently outroing and will be removed once the transition is finished
			if ((current.f & INERT) === 0 && current !== state.fallback) {
				to_destroy.push(current);
			}

			current = skip_to_branch(current.next);
		}

		var destroy_length = to_destroy.length;

		if (destroy_length > 0) {
			var controlled_anchor = (flags & EACH_IS_CONTROLLED) !== 0 && length === 0 ? anchor : null;

			if (is_animated) {
				for (i = 0; i < destroy_length; i += 1) {
					to_destroy[i].nodes?.a?.measure();
				}

				for (i = 0; i < destroy_length; i += 1) {
					to_destroy[i].nodes?.a?.fix();
				}
			}

			pause_effects(state, to_destroy, controlled_anchor);
		}
	}

	if (is_animated) {
		queue_micro_task(() => {
			if (to_animate === undefined) return;
			for (effect of to_animate) {
				effect.nodes?.a?.apply();
			}
		});
	}
}

/**
 * @template V
 * @param {Map<any, EachItem>} items
 * @param {Node} anchor
 * @param {V} value
 * @param {unknown} key
 * @param {number} index
 * @param {(anchor: Node, item: V | Source<V>, index: number | Value<number>, collection: () => V[]) => void} render_fn
 * @param {number} flags
 * @param {() => V[]} get_collection
 * @returns {EachItem}
 */
function create_item(items, anchor, value, key, index, render_fn, flags, get_collection) {
	var v =
		(flags & EACH_ITEM_REACTIVE) !== 0
			? (flags & EACH_ITEM_IMMUTABLE) === 0
				? mutable_source(value, false, false)
				: source(value)
			: null;

	var i = (flags & EACH_INDEX_REACTIVE) !== 0 ? source(index) : null;

	if (DEV && v) {
		// For tracing purposes, we need to link the source signal we create with the
		// collection + index so that tracing works as intended
		v.trace = () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			get_collection()[i?.v ?? index];
		};
	}

	return {
		v,
		i,
		e: branch(() => {
			render_fn(anchor, v ?? value, i ?? index, get_collection);

			return () => {
				items.delete(key);
			};
		})
	};
}

/**
 * @param {Effect} effect
 * @param {Effect | null} next
 * @param {Text | Element | Comment} anchor
 */
function move(effect, next, anchor) {
	if (!effect.nodes) return;

	var node = effect.nodes.start;
	var end = effect.nodes.end;

	var dest =
		next && (next.f & EFFECT_OFFSCREEN) === 0
			? /** @type {EffectNodes} */ (next.nodes).start
			: anchor;

	while (node !== null) {
		var next_node = /** @type {TemplateNode} */ (get_next_sibling(node));
		dest.before(node);

		if (node === end) {
			return;
		}

		node = next_node;
	}
}

/**
 * @param {EachState} state
 * @param {Effect | null} prev
 * @param {Effect | null} next
 */
function link(state, prev, next) {
	if (prev === null) {
		state.effect.first = next;
	} else {
		prev.next = next;
	}

	if (next === null) {
		state.effect.last = prev;
	} else {
		next.prev = prev;
	}
}

const whitespace = [...' \t\n\r\f\u00a0\u000b\ufeff'];

/**
 * @param {any} value
 * @param {string | null} [hash]
 * @param {Record<string, boolean>} [directives]
 * @returns {string | null}
 */
function to_class(value, hash, directives) {
	var classname = value == null ? '' : '' + value;

	if (directives) {
		for (var key in directives) {
			if (directives[key]) {
				classname = classname ? classname + ' ' + key : key;
			} else if (classname.length) {
				var len = key.length;
				var a = 0;

				while ((a = classname.indexOf(key, a)) >= 0) {
					var b = a + len;

					if (
						(a === 0 || whitespace.includes(classname[a - 1])) &&
						(b === classname.length || whitespace.includes(classname[b]))
					) {
						classname = (a === 0 ? '' : classname.substring(0, a)) + classname.substring(b + 1);
					} else {
						a = b;
					}
				}
			}
		}
	}

	return classname === '' ? null : classname;
}

/**
 *
 * @param {Record<string,any>} styles
 * @param {boolean} important
 */
function append_styles(styles, important = false) {
	var separator = important ? ' !important;' : ';';
	var css = '';

	for (var key in styles) {
		var value = styles[key];
		if (value != null && value !== '') {
			css += ' ' + key + ': ' + value + separator;
		}
	}

	return css;
}

/**
 * @param {string} name
 * @returns {string}
 */
function to_css_name(name) {
	if (name[0] !== '-' || name[1] !== '-') {
		return name.toLowerCase();
	}
	return name;
}

/**
 * @param {any} value
 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [styles]
 * @returns {string | null}
 */
function to_style(value, styles) {
	if (styles) {
		var new_style = '';

		/** @type {Record<string,any> | undefined} */
		var normal_styles;

		/** @type {Record<string,any> | undefined} */
		var important_styles;

		if (Array.isArray(styles)) {
			normal_styles = styles[0];
			important_styles = styles[1];
		} else {
			normal_styles = styles;
		}

		if (value) {
			value = String(value)
				.replaceAll(/\s*\/\*.*?\*\/\s*/g, '')
				.trim();

			/** @type {boolean | '"' | "'"} */
			var in_str = false;
			var in_apo = 0;
			var in_comment = false;

			var reserved_names = [];

			if (normal_styles) {
				reserved_names.push(...Object.keys(normal_styles).map(to_css_name));
			}
			if (important_styles) {
				reserved_names.push(...Object.keys(important_styles).map(to_css_name));
			}

			var start_index = 0;
			var name_index = -1;

			const len = value.length;
			for (var i = 0; i < len; i++) {
				var c = value[i];

				if (in_comment) {
					if (c === '/' && value[i - 1] === '*') {
						in_comment = false;
					}
				} else if (in_str) {
					if (in_str === c) {
						in_str = false;
					}
				} else if (c === '/' && value[i + 1] === '*') {
					in_comment = true;
				} else if (c === '"' || c === "'") {
					in_str = c;
				} else if (c === '(') {
					in_apo++;
				} else if (c === ')') {
					in_apo--;
				}

				if (!in_comment && in_str === false && in_apo === 0) {
					if (c === ':' && name_index === -1) {
						name_index = i;
					} else if (c === ';' || i === len - 1) {
						if (name_index !== -1) {
							var name = to_css_name(value.substring(start_index, name_index).trim());

							if (!reserved_names.includes(name)) {
								if (c !== ';') {
									i++;
								}

								var property = value.substring(start_index, i).trim();
								new_style += ' ' + property + ';';
							}
						}

						start_index = i + 1;
						name_index = -1;
					}
				}
			}
		}

		if (normal_styles) {
			new_style += append_styles(normal_styles);
		}

		if (important_styles) {
			new_style += append_styles(important_styles, true);
		}

		new_style = new_style.trim();
		return new_style === '' ? null : new_style;
	}

	return value == null ? null : String(value);
}

/**
 * @param {Element} dom
 * @param {boolean | number} is_html
 * @param {string | null} value
 * @param {string} [hash]
 * @param {Record<string, any>} [prev_classes]
 * @param {Record<string, any>} [next_classes]
 * @returns {Record<string, boolean> | undefined}
 */
function set_class(dom, is_html, value, hash, prev_classes, next_classes) {
	// @ts-expect-error need to add __className to patched prototype
	var prev = dom.__className;

	if (
		prev !== value ||
		prev === undefined // for edge case of `class={undefined}`
	) {
		var next_class_name = to_class(value, hash, next_classes);

		{
			// Removing the attribute when the value is only an empty string causes
			// performance issues vs simply making the className an empty string. So
			// we should only remove the class if the value is nullish
			// and there no hash/directives :
			if (next_class_name == null) {
				dom.removeAttribute('class');
			} else {
				dom.className = next_class_name;
			}
		}

		// @ts-expect-error need to add __className to patched prototype
		dom.__className = value;
	} else if (next_classes && prev_classes !== next_classes) {
		for (var key in next_classes) {
			var is_present = !!next_classes[key];

			if (prev_classes == null || is_present !== !!prev_classes[key]) {
				dom.classList.toggle(key, is_present);
			}
		}
	}

	return next_classes;
}

/**
 * @param {Element & ElementCSSInlineStyle} dom
 * @param {Record<string, any>} prev
 * @param {Record<string, any>} next
 * @param {string} [priority]
 */
function update_styles(dom, prev = {}, next, priority) {
	for (var key in next) {
		var value = next[key];

		if (prev[key] !== value) {
			if (next[key] == null) {
				dom.style.removeProperty(key);
			} else {
				dom.style.setProperty(key, value, priority);
			}
		}
	}
}

/**
 * @param {Element & ElementCSSInlineStyle} dom
 * @param {string | null} value
 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [prev_styles]
 * @param {Record<string, any> | [Record<string, any>, Record<string, any>]} [next_styles]
 */
function set_style(dom, value, prev_styles, next_styles) {
	// @ts-expect-error
	var prev = dom.__style;

	if (prev !== value) {
		var next_style_attr = to_style(value, next_styles);

		{
			if (next_style_attr == null) {
				dom.removeAttribute('style');
			} else {
				dom.style.cssText = next_style_attr;
			}
		}

		// @ts-expect-error
		dom.__style = value;
	} else if (next_styles) {
		if (Array.isArray(next_styles)) {
			update_styles(dom, prev_styles?.[0], next_styles[0]);
			update_styles(dom, prev_styles?.[1], next_styles[1], 'important');
		} else {
			update_styles(dom, prev_styles, next_styles);
		}
	}

	return next_styles;
}

/** @import { Blocker, Effect } from '#client' */

const IS_CUSTOM_ELEMENT = Symbol('is custom element');
const IS_HTML = Symbol('is html');

/**
 * @param {Element} element
 * @param {string} attribute
 * @param {string | null} value
 * @param {boolean} [skip_warning]
 */
function set_attribute(element, attribute, value, skip_warning) {
	var attributes = get_attributes(element);

	if (attributes[attribute] === (attributes[attribute] = value)) return;

	if (attribute === 'loading') {
		// @ts-expect-error
		element[LOADING_ATTR_SYMBOL] = value;
	}

	if (value == null) {
		element.removeAttribute(attribute);
	} else if (typeof value !== 'string' && get_setters(element).includes(attribute)) {
		// @ts-ignore
		element[attribute] = value;
	} else {
		element.setAttribute(attribute, value);
	}
}

/**
 *
 * @param {Element} element
 */
function get_attributes(element) {
	return /** @type {Record<string | symbol, unknown>} **/ (
		// @ts-expect-error
		element.__attributes ??= {
			[IS_CUSTOM_ELEMENT]: element.nodeName.includes('-'),
			[IS_HTML]: element.namespaceURI === NAMESPACE_HTML
		}
	);
}

/** @type {Map<string, string[]>} */
var setters_cache = new Map();

/** @param {Element} element */
function get_setters(element) {
	var cache_key = element.getAttribute('is') || element.nodeName;
	var setters = setters_cache.get(cache_key);
	if (setters) return setters;
	setters_cache.set(cache_key, (setters = []));

	var descriptors;
	var proto = element; // In the case of custom elements there might be setters on the instance
	var element_proto = Element.prototype;

	// Stop at Element, from there on there's only unnecessary setters we're not interested in
	// Do not use contructor.name here as that's unreliable in some browser environments
	while (element_proto !== proto) {
		descriptors = get_descriptors(proto);

		for (var key in descriptors) {
			if (descriptors[key].set) {
				setters.push(key);
			}
		}

		proto = get_prototype_of(proto);
	}

	return setters;
}

/** @import { Batch } from '../../../reactivity/batch.js' */

/**
 * @param {HTMLInputElement} input
 * @param {() => unknown} get
 * @param {(value: unknown) => void} set
 * @returns {void}
 */
function bind_value(input, get, set = get) {
	var batches = new WeakSet();

	listen_to_event_and_reset_event(input, 'input', async (is_reset) => {
		if (DEV && input.type === 'checkbox') {
			// TODO should this happen in prod too?
			bind_invalid_checkbox_value();
		}

		/** @type {any} */
		var value = is_reset ? input.defaultValue : input.value;
		value = is_numberlike_input(input) ? to_number(value) : value;
		set(value);

		if (current_batch !== null) {
			batches.add(current_batch);
		}

		// Because `{#each ...}` blocks work by updating sources inside the flush,
		// we need to wait a tick before checking to see if we should forcibly
		// update the input and reset the selection state
		await tick();

		// Respect any validation in accessors
		if (value !== (value = get())) {
			var start = input.selectionStart;
			var end = input.selectionEnd;
			var length = input.value.length;

			// the value is coerced on assignment
			input.value = value ?? '';

			// Restore selection
			if (end !== null) {
				var new_length = input.value.length;
				// If cursor was at end and new input is longer, move cursor to new end
				if (start === end && end === length && new_length > length) {
					input.selectionStart = new_length;
					input.selectionEnd = new_length;
				} else {
					input.selectionStart = start;
					input.selectionEnd = Math.min(end, new_length);
				}
			}
		}
	});

	if (
		// If we are hydrating and the value has since changed,
		// then use the updated value from the input instead.
		// If defaultValue is set, then value == defaultValue
		// TODO Svelte 6: remove input.value check and set to empty string?
		(untrack(get) == null && input.value)
	) {
		set(is_numberlike_input(input) ? to_number(input.value) : input.value);

		if (current_batch !== null) {
			batches.add(current_batch);
		}
	}

	render_effect(() => {
		if (DEV && input.type === 'checkbox') {
			// TODO should this happen in prod too?
			bind_invalid_checkbox_value();
		}

		var value = get();

		if (input === document.activeElement) {
			// we need both, because in non-async mode, render effects run before previous_batch is set
			var batch = /** @type {Batch} */ (previous_batch ?? current_batch);

			// Never rewrite the contents of a focused input. We can get here if, for example,
			// an update is deferred because of async work depending on the input:
			//
			// <input bind:value={query}>
			// <p>{await find(query)}</p>
			if (batches.has(batch)) {
				return;
			}
		}

		if (is_numberlike_input(input) && value === to_number(input.value)) {
			// handles 0 vs 00 case (see https://github.com/sveltejs/svelte/issues/9959)
			return;
		}

		if (input.type === 'date' && !value && !input.value) {
			// Handles the case where a temporarily invalid date is set (while typing, for example with a leading 0 for the day)
			// and prevents this state from clearing the other parts of the date input (see https://github.com/sveltejs/svelte/issues/7897)
			return;
		}

		// don't set the value of the input if it's the same to allow
		// minlength to work properly
		if (value !== input.value) {
			// @ts-expect-error the value is coerced on assignment
			input.value = value ?? '';
		}
	});
}

/**
 * @param {HTMLInputElement} input
 */
function is_numberlike_input(input) {
	var type = input.type;
	return type === 'number' || type === 'range';
}

/**
 * @param {string} value
 */
function to_number(value) {
	return value === '' ? null : +value;
}

/**
 * @param {any} bound_value
 * @param {Element} element_or_component
 * @returns {boolean}
 */
function is_bound_this(bound_value, element_or_component) {
	return (
		bound_value === element_or_component || bound_value?.[STATE_SYMBOL] === element_or_component
	);
}

/**
 * @param {any} element_or_component
 * @param {(value: unknown, ...parts: unknown[]) => void} update
 * @param {(...parts: unknown[]) => unknown} get_value
 * @param {() => unknown[]} [get_parts] Set if the this binding is used inside an each block,
 * 										returns all the parts of the each block context that are used in the expression
 * @returns {void}
 */
function bind_this(element_or_component = {}, update, get_value, get_parts) {
	effect(() => {
		/** @type {unknown[]} */
		var old_parts;

		/** @type {unknown[]} */
		var parts;

		render_effect(() => {
			old_parts = parts;
			// We only track changes to the parts, not the value itself to avoid unnecessary reruns.
			parts = [];

			untrack(() => {
				if (element_or_component !== get_value(...parts)) {
					update(element_or_component, ...parts);
					// If this is an effect rerun (cause: each block context changes), then nullify the binding at
					// the previous position if it isn't already taken over by a different effect.
					if (old_parts && is_bound_this(get_value(...old_parts), element_or_component)) {
						update(null, ...old_parts);
					}
				}
			});
		});

		return () => {
			// We cannot use effects in the teardown phase, we we use a microtask instead.
			queue_micro_task(() => {
				if (parts && is_bound_this(get_value(...parts), element_or_component)) {
					update(null, ...parts);
				}
			});
		};
	});

	return element_or_component;
}

/** @import { StoreReferencesContainer } from '#client' */
/** @import { Store } from '#shared' */

/**
 * Whether or not the prop currently being read is a store binding, as in
 * `<Child bind:x={$y} />`. If it is, we treat the prop as mutable even in
 * runes mode, and skip `binding_property_non_reactive` validation
 */
let is_store_binding = false;

/**
 * Returns a tuple that indicates whether `fn()` reads a prop that is a store binding.
 * Used to prevent `binding_property_non_reactive` validation false positives and
 * ensure that these props are treated as mutable even in runes mode
 * @template T
 * @param {() => T} fn
 * @returns {[T, boolean]}
 */
function capture_store_binding(fn) {
	var previous_is_store_binding = is_store_binding;

	try {
		is_store_binding = false;
		return [fn(), is_store_binding];
	} finally {
		is_store_binding = previous_is_store_binding;
	}
}

/** @import { Effect, Source } from './types.js' */

/**
 * The proxy handler for spread props. Handles the incoming array of props
 * that looks like `() => { dynamic: props }, { static: prop }, ..` and wraps
 * them so that the whole thing is passed to the component as the `$$props` argument.
 * @type {ProxyHandler<{ props: Array<Record<string | symbol, unknown> | (() => Record<string | symbol, unknown>)> }>}}
 */
const spread_props_handler = {
	get(target, key) {
		let i = target.props.length;
		while (i--) {
			let p = target.props[i];
			if (is_function(p)) p = p();
			if (typeof p === 'object' && p !== null && key in p) return p[key];
		}
	},
	set(target, key, value) {
		let i = target.props.length;
		while (i--) {
			let p = target.props[i];
			if (is_function(p)) p = p();
			const desc = get_descriptor(p, key);
			if (desc && desc.set) {
				desc.set(value);
				return true;
			}
		}
		return false;
	},
	getOwnPropertyDescriptor(target, key) {
		let i = target.props.length;
		while (i--) {
			let p = target.props[i];
			if (is_function(p)) p = p();
			if (typeof p === 'object' && p !== null && key in p) {
				const descriptor = get_descriptor(p, key);
				if (descriptor && !descriptor.configurable) {
					// Prevent a "Non-configurability Report Error": The target is an array, it does
					// not actually contain this property. If it is now described as non-configurable,
					// the proxy throws a validation error. Setting it to true avoids that.
					descriptor.configurable = true;
				}
				return descriptor;
			}
		}
	},
	has(target, key) {
		// To prevent a false positive `is_entry_props` in the `prop` function
		if (key === STATE_SYMBOL || key === LEGACY_PROPS) return false;

		for (let p of target.props) {
			if (is_function(p)) p = p();
			if (p != null && key in p) return true;
		}

		return false;
	},
	ownKeys(target) {
		/** @type {Array<string | symbol>} */
		const keys = [];

		for (let p of target.props) {
			if (is_function(p)) p = p();
			if (!p) continue;

			for (const key in p) {
				if (!keys.includes(key)) keys.push(key);
			}

			for (const key of Object.getOwnPropertySymbols(p)) {
				if (!keys.includes(key)) keys.push(key);
			}
		}

		return keys;
	}
};

/**
 * @param {Array<Record<string, unknown> | (() => Record<string, unknown>)>} props
 * @returns {any}
 */
function spread_props(...props) {
	return new Proxy({ props }, spread_props_handler);
}

/**
 * This function is responsible for synchronizing a possibly bound prop with the inner component state.
 * It is used whenever the compiler sees that the component writes to the prop, or when it has a default prop_value.
 * @template V
 * @param {Record<string, unknown>} props
 * @param {string} key
 * @param {number} flags
 * @param {V | (() => V)} [fallback]
 * @returns {(() => V | ((arg: V) => V) | ((arg: V, mutation: boolean) => V))}
 */
function prop(props, key, flags, fallback) {
	var bindable = (flags & PROPS_IS_BINDABLE) !== 0;
	var lazy = (flags & PROPS_IS_LAZY_INITIAL) !== 0;

	var fallback_value = /** @type {V} */ (fallback);
	var fallback_dirty = true;

	var get_fallback = () => {
		if (fallback_dirty) {
			fallback_dirty = false;

			fallback_value = lazy
				? untrack(/** @type {() => V} */ (fallback))
				: /** @type {V} */ (fallback);
		}

		return fallback_value;
	};

	/** @type {((v: V) => void) | undefined} */
	var setter;

	if (bindable) {
		// Can be the case when someone does `mount(Component, props)` with `let props = $state({...})`
		// or `createClassComponent(Component, props)`
		var is_entry_props = STATE_SYMBOL in props || LEGACY_PROPS in props;

		setter =
			get_descriptor(props, key)?.set ??
			(is_entry_props && key in props ? (v) => (props[key] = v) : undefined);
	}

	var initial_value;
	var is_store_sub = false;

	if (bindable) {
		[initial_value, is_store_sub] = capture_store_binding(() => /** @type {V} */ (props[key]));
	} else {
		initial_value = /** @type {V} */ (props[key]);
	}

	if (initial_value === undefined && fallback !== undefined) {
		initial_value = get_fallback();

		if (setter) {
			props_invalid_value(key);
			setter(initial_value);
		}
	}

	/** @type {() => V} */
	var getter;

	{
		getter = () => {
			var value = /** @type {V} */ (props[key]);
			if (value === undefined) return get_fallback();
			fallback_dirty = true;
			return value;
		};
	}

	// prop is never written to — we only need a getter
	if ((flags & PROPS_IS_UPDATED) === 0) {
		return getter;
	}

	// prop is written to, but the parent component had `bind:foo` which
	// means we can just call `$$props.foo = value` directly
	if (setter) {
		var legacy_parent = props.$$legacy;
		return /** @type {() => V} */ (
			function (/** @type {V} */ value, /** @type {boolean} */ mutation) {
				if (arguments.length > 0) {
					// We don't want to notify if the value was mutated and the parent is in runes mode.
					// In that case the state proxy (if it exists) should take care of the notification.
					// If the parent is not in runes mode, we need to notify on mutation, too, that the prop
					// has changed because the parent will not be able to detect the change otherwise.
					if (!mutation || legacy_parent || is_store_sub) {
						/** @type {Function} */ (setter)(mutation ? getter() : value);
					}

					return value;
				}

				return getter();
			}
		);
	}

	// Either prop is written to, but there's no binding, which means we
	// create a derived that we can write to locally.
	// Or we are in legacy mode where we always create a derived to replicate that
	// Svelte 4 did not trigger updates when a primitive value was updated to the same value.
	var overridden = false;

	var d = ((flags & PROPS_IS_IMMUTABLE) !== 0 ? derived : derived_safe_equal)(() => {
		overridden = false;
		return getter();
	});

	if (DEV) {
		d.label = key;
	}

	// Capture the initial value if it's bindable
	if (bindable) get(d);

	var parent_effect = /** @type {Effect} */ (active_effect);

	return /** @type {() => V} */ (
		function (/** @type {any} */ value, /** @type {boolean} */ mutation) {
			if (arguments.length > 0) {
				const new_value = mutation ? get(d) : bindable ? proxy(value) : value;

				set(d, new_value);
				overridden = true;

				if (fallback_value !== undefined) {
					fallback_value = new_value;
				}

				return value;
			}

			// special case — avoid recalculating the derived if we're in a
			// teardown function and the prop was overridden locally, or the
			// component was already destroyed (this latter part is necessary
			// because `bind:this` can read props after the component has
			// been destroyed. TODO simplify `bind:this`
			if ((is_destroying_effect && overridden) || (parent_effect.f & DESTROYED) !== 0) {
				return d.v;
			}

			return get(d);
		}
	);
}

/** @import { ComponentContext, ComponentContextLegacy } from '#client' */
/** @import { EventDispatcher } from './index.js' */
/** @import { NotFunction } from './internal/types.js' */

if (DEV) {
	/**
	 * @param {string} rune
	 */
	function throw_rune_error(rune) {
		if (!(rune in globalThis)) {
			// TODO if people start adjusting the "this can contain runes" config through v-p-s more, adjust this message
			/** @type {any} */
			let value; // let's hope noone modifies this global, but belts and braces
			Object.defineProperty(globalThis, rune, {
				configurable: true,
				// eslint-disable-next-line getter-return
				get: () => {
					if (value !== undefined) {
						return value;
					}

					rune_outside_svelte(rune);
				},
				set: (v) => {
					value = v;
				}
			});
		}
	}

	throw_rune_error('$state');
	throw_rune_error('$effect');
	throw_rune_error('$derived');
	throw_rune_error('$inspect');
	throw_rune_error('$props');
	throw_rune_error('$bindable');
}

/**
 * `onMount`, like [`$effect`](https://svelte.dev/docs/svelte/$effect), schedules a function to run as soon as the component has been mounted to the DOM.
 * Unlike `$effect`, the provided function only runs once.
 *
 * It must be called during the component's initialisation (but doesn't need to live _inside_ the component;
 * it can be called from an external module). If a function is returned _synchronously_ from `onMount`,
 * it will be called when the component is unmounted.
 *
 * `onMount` functions do not run during [server-side rendering](https://svelte.dev/docs/svelte/svelte-server#render).
 *
 * @template T
 * @param {() => NotFunction<T> | Promise<NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
	if (component_context === null) {
		lifecycle_outside_component('onMount');
	}

	{
		user_effect(() => {
			const cleanup = untrack(fn);
			if (typeof cleanup === 'function') return /** @type {() => void} */ (cleanup);
		});
	}
}

// generated during release, do not modify

const PUBLIC_VERSION = '5';

if (typeof window !== 'undefined') {
	// @ts-expect-error
	((window.__svelte ??= {}).v ??= new Set()).add(PUBLIC_VERSION);
}

function WorkerWrapper(options) {
            return new Worker(
              ""+new URL('assets/worker-DYbR_ihC.js', import.meta.url).href+"",
              {
          type: "module",
          name: options?.name
        }
            );
          }

const xForColStart = (colIdx, grid) => {
  let acc = 0;
  for (const c of grid.columns) {
    if (c.idx >= colIdx) break;
    acc += c.width;
  }
  return acc;
};
const xForColEnd = (colIdx, grid) => {
  let acc = 0;
  for (const c of grid.columns) {
    acc += c.width;
    if (c.idx >= colIdx) break;
  }
  return acc;
};
const yForRowStart = (rowIdx, grid) => {
  let acc = 0;
  for (const r of grid.rows) {
    if (r.idx >= rowIdx) break;
    acc += r.height;
  }
  return acc;
};
const yForRowEnd = (rowIdx, grid) => {
  let acc = 0;
  for (const r of grid.rows) {
    acc += r.height;
    if (r.idx >= rowIdx) break;
  }
  return acc;
};
const getPosition = (rowIdx, colIdx, grid) => {
  let xAcc = 0;
  let x0 = 0;
  let x1 = 0;
  for (const c of grid.columns) {
    if (c.idx < colIdx) {
      xAcc += c.width;
      continue;
    }
    x0 = xAcc;
    x1 = xAcc + c.width;
    break;
  }
  let yAcc = 0;
  let y0 = 0;
  let y1 = 0;
  for (const r of grid.rows) {
    if (r.idx < rowIdx) {
      yAcc += r.height;
      continue;
    }
    y0 = yAcc;
    y1 = yAcc + r.height;
    break;
  }
  return { startX: x0, startY: y0, endX: x1, endY: y1 };
};
const findVisibleRowIdxRange = (anchor, height, grid) => {
  let s = grid.anchorY;
  let startIdx = 0;
  for (let i = 0; i < grid.rows.length; i += 1) {
    if (s >= anchor) {
      startIdx = i;
      break;
    }
    s += grid.rows[i].height;
  }
  let endIdx = startIdx;
  let acc = 0;
  for (let j = startIdx; j < grid.rows.length; j += 1) {
    acc += grid.rows[j].height;
    if (acc >= height) {
      endIdx = j - 1;
      break;
    }
  }
  return [startIdx, endIdx];
};
const findVisibleColIdxRange = (anchor, width, grid) => {
  let s = grid.anchorX;
  let startIdx = 0;
  for (let i = 0; i < grid.columns.length; i += 1) {
    if (s >= anchor) {
      startIdx = i;
      break;
    }
    s += grid.columns[i].width;
  }
  let endIdx = grid.columns.length - 1;
  let acc = 0;
  for (let j = startIdx; j < grid.columns.length; j += 1) {
    acc += grid.columns[j].width;
    if (acc > width) {
      endIdx = j;
    }
  }
  return [startIdx, endIdx];
};
function match(canvasX, canvasY, anchorX, anchorY, data) {
  const clickX = canvasX + anchorX;
  const clickY = canvasY + anchorY;
  let h = data.anchorY;
  let rowIdx = 0;
  let rowHeight = 0;
  for (const row of data.rows) {
    h += row.height;
    if (h > clickY) {
      rowIdx = row.idx;
      rowHeight = row.height;
      break;
    }
  }
  let w = data.anchorX;
  let colIdx = 0;
  let colWidth = 0;
  for (const col of data.columns) {
    w += col.width;
    if (w > clickX) {
      colIdx = col.idx;
      colWidth = col.width;
      break;
    }
  }
  let pStartRow = h - rowHeight;
  let pEndRow = h;
  let pStartCol = w - colWidth;
  let pEndCol = w;
  let startRow = rowIdx;
  let endRow = rowIdx;
  let startCol = colIdx;
  let endCol = colIdx;
  if (data.mergeCells && data.mergeCells.length > 0) {
    const mergedCell = data.mergeCells.find(
      (c) => c.startRow <= rowIdx && c.endRow >= rowIdx && c.startCol <= colIdx && c.endCol >= colIdx
    );
    if (mergedCell) {
      startRow = mergedCell.startRow;
      endRow = mergedCell.endRow;
      startCol = mergedCell.startCol;
      endCol = mergedCell.endCol;
      let sRow = 0;
      let eRow = 0;
      for (const row of data.rows) {
        if (row.idx > endRow) break;
        if (row.idx > startRow) {
          eRow += row.height;
        } else {
          sRow += row.height;
          eRow += row.height;
        }
      }
      pStartRow = sRow;
      pEndRow = eRow;
      let sCol = 0;
      let eCol = 0;
      for (const col of data.columns) {
        if (col.idx > endCol) break;
        if (col.idx > startCol) {
          eCol += col.width;
        } else {
          sCol += col.width;
          eCol += col.width;
        }
      }
      pStartCol = sCol;
      pEndCol = eCol;
    }
  }
  return new Cell("Cell").setPosition(
    new Range$1().setStartRow(pStartRow).setEndRow(pEndRow).setStartCol(pStartCol).setEndCol(pEndCol)
  ).setCoordinate(
    new Range$1().setStartRow(startRow).setEndRow(endRow).setStartCol(startCol).setEndCol(endCol)
  );
}
function getSelectedCellRange(v) {
  if (v.data?.ty === "cellRange") return v.data.d;
  return void 0;
}
function getSelectedLines(v) {
  if (v.data?.ty === "line") return v.data.d;
  return void 0;
}
function buildSelectedDataFromCell(row, col, source) {
  return {
    source,
    data: {
      ty: "cellRange",
      d: { startRow: row, endRow: row, startCol: col, endCol: col }
    }
  };
}
function buildSelectedDataFromCellRange(startRow, startCol, endRow, endCol, source) {
  return {
    source,
    data: {
      ty: "cellRange",
      d: { startRow, endRow, startCol, endCol }
    }
  };
}
function buildSelectedDataFromLines(start, end, type, source) {
  return {
    source,
    data: {
      ty: "line",
      d: { start, end, type }
    }
  };
}
function getSelectedRows(v) {
  if (v.data?.ty === "cellRange") {
    return [v.data.d.startRow, v.data.d.endRow];
  }
  if (v.data?.ty === "line" && v.data.d.type === "row") {
    return [v.data.d.start, v.data.d.end];
  }
  return [];
}
function getSelectedColumns(v) {
  if (v.data?.ty === "cellRange") {
    return [v.data.d.startCol, v.data.d.endCol];
  }
  if (v.data?.ty === "line" && v.data.d.type === "col") {
    return [v.data.d.start, v.data.d.end];
  }
  return [];
}
function toA1notation(col) {
  let result = "";
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(c % 26 + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}
function getReferenceString(v) {
  if (v.data === void 0) return "";
  if (v.data.ty === "cellRange") {
    const startRow = v.data.d.startRow;
    const endRow = v.data.d.endRow;
    const startCol = v.data.d.startCol;
    const endCol = v.data.d.endCol;
    if (startRow === endRow && startCol === endCol) {
      return `${toA1notation(startCol)}${startRow + 1}`;
    }
    return `${toA1notation(startCol)}${startRow + 1}:${toA1notation(endCol)}${endRow + 1}`;
  }
  if (v.data.ty === "line") {
    if (v.data.d.type === "col") {
      return `${toA1notation(v.data.d.start)}:${toA1notation(v.data.d.end)}`;
    }
    return `${v.data.d.start + 1}:${v.data.d.end + 1}`;
  }
  return "";
}
const DEFAULT_PPI$1 = 96;
function ptToPx$1(pt) {
  return Math.round(pt * DEFAULT_PPI$1 / 72 * 100) / 100;
}
function pxToPt$1(px) {
  return Math.round(px * 72 / DEFAULT_PPI$1 * 100) / 100;
}
function widthToPx$1(w) {
  return w * 7;
}
function pxToWidth$1(px) {
  return px / 7;
}
function simpleUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

var root_1$2 = from_html(`<div class="guide base-guide svelte-1ra3v2x"></div>`);
var root_2$5 = from_html(`<div class="guide curr-guide svelte-1ra3v2x"></div>`);
var root_3$2 = from_html(`<div class="badge svelte-1ra3v2x"> </div>`);
var root$6 = from_html(`<!> <!> <!> <div class="handle svelte-1ra3v2x" role="slider" tabindex="-1"></div>`, 1);

function HeaderResizer($$anchor, $$props) {
	push($$props, true);

	/**
	 * HeaderResizer - A draggable handle for resizing column widths or row heights.
	 * Shows visual guides during drag operation.
	 */
	/** 'row' for row headers, 'col' for column headers */
	/** Absolute X position inside the header container */
	/** Absolute Y position inside the header container */
	/** Length of the handle line (height for col, width for row) */
	/** Optional thickness in px */
	/** Live resize delta callback (in px) */
	/** Commit resize delta callback (in px) */
	let thickness = prop($$props, 'thickness', 3, 6);

	// State
	let dragging = state(false);

	let delta = state(0);
	let startPos = null;

	function onMouseDown(e) {
		e.preventDefault();
		e.stopPropagation();
		startPos = { x: e.clientX, y: e.clientY };
		set(dragging, true);
		set(delta, 0);

		const onMove = (me) => {
			if (!startPos) return;

			const dx = me.clientX - startPos.x;
			const dy = me.clientY - startPos.y;
			const d = $$props.orientation === 'col' ? dx : dy;

			set(delta, d, true);
			$$props.onResize?.(d);
		};

		const onUp = (ue) => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);

			if (!startPos) return;

			const dx = ue.clientX - startPos.x;
			const dy = ue.clientY - startPos.y;
			const d = $$props.orientation === 'col' ? dx : dy;

			$$props.onResizeEnd?.(d);
			startPos = null;
			set(dragging, false);
			set(delta, 0);
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	// Computed styles
	const handleStyle = user_derived(() => $$props.orientation === 'col'
		? `left: ${$$props.x - thickness() / 2}px; top: ${$$props.y}px; width: ${thickness()}px; height: ${$$props.length}px; cursor: col-resize;`
		: `left: ${$$props.x}px; top: ${$$props.y - thickness() / 2}px; width: ${$$props.length}px; height: ${thickness()}px; cursor: row-resize;`);

	const baseGuideStyle = user_derived(() => $$props.orientation === 'col'
		? `left: ${$$props.x - 1}px; top: 0; width: 2px; height: ${$$props.length}px;`
		: `left: 0; top: ${$$props.y - 1}px; width: ${$$props.length}px; height: 2px;`);

	const currGuideStyle = user_derived(() => $$props.orientation === 'col'
		? `left: ${$$props.x + get(delta) - 1}px; top: 0; width: 2px; height: ${$$props.length}px;`
		: `left: 0; top: ${$$props.y + get(delta) - 1}px; width: ${$$props.length}px; height: 2px;`);

	const badgeStyle = user_derived(() => $$props.orientation === 'col'
		? `left: ${$$props.x + get(delta) + 6}px; top: 4px;`
		: `left: 4px; top: ${$$props.y + get(delta) + 6}px;`);

	const badgeText = user_derived(() => `${Math.round(get(delta) * 10) / 10}px`);
	var fragment = root$6();
	var node = first_child(fragment);

	{
		var consequent = ($$anchor) => {
			var div = root_1$2();

			template_effect(() => set_style(div, get(baseGuideStyle)));
			append($$anchor, div);
		};

		if_block(node, ($$render) => {
			if (get(dragging)) $$render(consequent);
		});
	}

	var node_1 = sibling(node, 2);

	{
		var consequent_1 = ($$anchor) => {
			var div_1 = root_2$5();

			template_effect(() => set_style(div_1, get(currGuideStyle)));
			append($$anchor, div_1);
		};

		if_block(node_1, ($$render) => {
			if (get(dragging)) $$render(consequent_1);
		});
	}

	var node_2 = sibling(node_1, 2);

	{
		var consequent_2 = ($$anchor) => {
			var div_2 = root_3$2();
			var text = child(div_2);

			template_effect(() => {
				set_style(div_2, get(badgeStyle));
				set_text(text, get(badgeText));
			});

			append($$anchor, div_2);
		};

		if_block(node_2, ($$render) => {
			if (get(dragging)) $$render(consequent_2);
		});
	}

	var div_3 = sibling(node_2, 2);

	div_3.__mousedown = onMouseDown;

	template_effect(() => {
		set_style(div_3, get(handleStyle));
		set_attribute(div_3, 'aria-valuenow', get(delta));
	});

	append($$anchor, fragment);
	pop();
}

delegate(['mousedown']);

var root_2$4 = from_html(`<button> </button> <!>`, 1);
var root$5 = from_html(`<div class="column-headers svelte-14c1vjw"><!></div>`);

function ColumnHeaders($$anchor, $$props) {
	push($$props, true);

	let grid = prop($$props, 'grid', 3, null),
		selectedColumnRange = prop($$props, 'selectedColumnRange', 3, undefined),
		leftTopWidth = prop($$props, 'leftTopWidth', 3, 32),
		leftTopHeight = prop($$props, 'leftTopHeight', 3, 24);

	let hostEl = state(void 0);

	function isSelected(colIdx) {
		if (!selectedColumnRange()) return false;

		return colIdx >= selectedColumnRange()[0] && colIdx <= selectedColumnRange()[1];
	}

	function findColIdxAt(x) {
		if (!grid()) return undefined;

		let acc = 0;

		for (const c of grid().columns) {
			acc += c.width;

			if (x < acc) return c.idx;
		}

		return grid().columns.at(-1)?.idx;
	}

	function handleMouseDown(downIdx, e) {
		if (e.button !== 0) return; // left-click only

		e.preventDefault();
		e.stopPropagation();

		if (!grid()) return;

		// Initial single selection
		$$props.onSelectColumn?.(downIdx);

		const handleMouseMove = (me) => {
			const r = get(hostEl)?.getBoundingClientRect();
			const x = me.clientX - (r?.left ?? 0);
			const currIdx = findColIdxAt(x) ?? downIdx;
			const start = Math.min(downIdx, currIdx);
			const end = Math.max(downIdx, currIdx);

			$$props.onSelectColumnRange?.(start, end);
		};

		const handleMouseUp = (ue) => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);

			const r = get(hostEl)?.getBoundingClientRect();
			const x = ue.clientX - (r?.left ?? 0);
			const upIdx = findColIdxAt(x) ?? downIdx;
			const start = Math.min(downIdx, upIdx);
			const end = Math.max(downIdx, upIdx);

			$$props.onSelectColumnRange?.(start, end);
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleContextMenu(colIdx, e) {
		e.preventDefault();
		e.stopPropagation();

		// Select the column if not already selected
		if (!selectedColumnRange() || colIdx < selectedColumnRange()[0] || colIdx > selectedColumnRange()[1]) {
			$$props.onSelectColumn?.(colIdx);
		}

		$$props.onContextMenu?.(colIdx, e);
	}

	// Compute positions using reduce pattern like the original React code
	function getColumnPositions(columns) {
		const result = [];
		let x = 0;

		for (const col of columns) {
			result.push({ col, x, rightEdge: x + col.width });
			x += col.width;
		}

		return result;
	}

	var div = root$5();
	var node = child(div);

	{
		var consequent = ($$anchor) => {
			var fragment = comment();
			var node_1 = first_child(fragment);

			each(node_1, 17, () => getColumnPositions(grid().columns), index, ($$anchor, $$item) => {
				let col = () => get($$item).col;
				let x = () => get($$item).x;
				let rightEdge = () => get($$item).rightEdge;
				var fragment_1 = root_2$4();
				var button = first_child(fragment_1);
				let classes;

				button.__mousedown = (e) => handleMouseDown(col().idx, e);
				button.__contextmenu = (e) => handleContextMenu(col().idx, e);

				var text = child(button);

				var node_2 = sibling(button, 2);

				HeaderResizer(node_2, {
					orientation: 'col',
					get x() {
						return rightEdge();
					},
					y: 0,
					get length() {
						return leftTopHeight();
					},
					onResizeEnd: (deltaPx) => $$props.onResizeCol?.(col().idx, deltaPx)
				});

				template_effect(
					($0, $1) => {
						classes = set_class(button, 1, 'column-header svelte-14c1vjw', null, classes, $0);
						set_style(button, `left: ${x() ?? ''}px; width: ${col().width ?? ''}px;`);
						set_text(text, $1);
					},
					[
						() => ({ selected: isSelected(col().idx) }),
						() => toA1notation(col().idx)
					]
				);

				append($$anchor, fragment_1);
			});

			append($$anchor, fragment);
		};

		if_block(node, ($$render) => {
			if (grid()?.columns) $$render(consequent);
		});
	}
	bind_this(div, ($$value) => set(hostEl, $$value), () => get(hostEl));
	template_effect(() => set_style(div, `left: ${leftTopWidth() ?? ''}px; top: 0; height: ${leftTopHeight() ?? ''}px;`));
	append($$anchor, div);
	pop();
}

delegate(['mousedown', 'contextmenu']);

var root_2$3 = from_html(`<button> </button> <!>`, 1);
var root$4 = from_html(`<div class="row-headers svelte-1d9outi"><!></div>`);

function RowHeaders($$anchor, $$props) {
	push($$props, true);

	let grid = prop($$props, 'grid', 3, null),
		selectedRowRange = prop($$props, 'selectedRowRange', 3, undefined),
		leftTopWidth = prop($$props, 'leftTopWidth', 3, 32),
		leftTopHeight = prop($$props, 'leftTopHeight', 3, 24);

	let hostEl = state(void 0);

	function isSelected(rowIdx) {
		if (!selectedRowRange()) return false;

		return rowIdx >= selectedRowRange()[0] && rowIdx <= selectedRowRange()[1];
	}

	function findRowIdxAt(y) {
		if (!grid()) return undefined;

		let acc = 0;

		for (const r of grid().rows) {
			acc += r.height;

			if (y < acc) return r.idx;
		}

		return grid().rows.at(-1)?.idx;
	}

	function handleMouseDown(downIdx, e) {
		if (e.button !== 0) return; // left-click only

		e.preventDefault();
		e.stopPropagation();

		if (!grid()) return;

		// Initial single selection
		$$props.onSelectRow?.(downIdx);

		const handleMouseMove = (me) => {
			const r = get(hostEl)?.getBoundingClientRect();
			const y = me.clientY - (r?.top ?? 0);
			const currIdx = findRowIdxAt(y) ?? downIdx;
			const start = Math.min(downIdx, currIdx);
			const end = Math.max(downIdx, currIdx);

			$$props.onSelectRowRange?.(start, end);
		};

		const handleMouseUp = (ue) => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);

			const r = get(hostEl)?.getBoundingClientRect();
			const y = ue.clientY - (r?.top ?? 0);
			const upIdx = findRowIdxAt(y) ?? downIdx;
			const start = Math.min(downIdx, upIdx);
			const end = Math.max(downIdx, upIdx);

			$$props.onSelectRowRange?.(start, end);
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleContextMenu(rowIdx, e) {
		e.preventDefault();
		e.stopPropagation();

		// Select the row if not already selected
		if (!selectedRowRange() || rowIdx < selectedRowRange()[0] || rowIdx > selectedRowRange()[1]) {
			$$props.onSelectRow?.(rowIdx);
		}

		$$props.onContextMenu?.(rowIdx, e);
	}

	// Compute positions using reduce pattern like the original React code
	function getRowPositions(rows) {
		const result = [];
		let y = 0;

		for (const row of rows) {
			result.push({ row, y, bottomEdge: y + row.height });
			y += row.height;
		}

		return result;
	}

	var div = root$4();
	var node = child(div);

	{
		var consequent = ($$anchor) => {
			var fragment = comment();
			var node_1 = first_child(fragment);

			each(node_1, 17, () => getRowPositions(grid().rows), index, ($$anchor, $$item) => {
				let row = () => get($$item).row;
				let y = () => get($$item).y;
				let bottomEdge = () => get($$item).bottomEdge;
				var fragment_1 = root_2$3();
				var button = first_child(fragment_1);
				let classes;

				button.__mousedown = (e) => handleMouseDown(row().idx, e);
				button.__contextmenu = (e) => handleContextMenu(row().idx, e);

				var text = child(button);

				var node_2 = sibling(button, 2);

				HeaderResizer(node_2, {
					orientation: 'row',
					x: 0,
					get y() {
						return bottomEdge();
					},

					get length() {
						return leftTopWidth();
					},
					onResizeEnd: (deltaPx) => $$props.onResizeRow?.(row().idx, deltaPx)
				});

				template_effect(
					($0) => {
						classes = set_class(button, 1, 'row-header svelte-1d9outi', null, classes, $0);
						set_style(button, `top: ${y() ?? ''}px; height: ${row().height ?? ''}px;`);
						set_text(text, row().idx + 1);
					},
					[() => ({ selected: isSelected(row().idx) })]
				);

				append($$anchor, fragment_1);
			});

			append($$anchor, fragment);
		};

		if_block(node, ($$render) => {
			if (grid()?.rows) $$render(consequent);
		});
	}
	bind_this(div, ($$value) => set(hostEl, $$value), () => get(hostEl));
	template_effect(() => set_style(div, `left: 0; top: ${leftTopHeight() ?? ''}px; width: ${leftTopWidth() ?? ''}px;`));
	append($$anchor, div);
	pop();
}

delegate(['mousedown', 'contextmenu']);

var root$3 = from_html(`<div class="selector svelte-14imyzv"></div>`);

function Selector($$anchor, $$props) {
	let x = prop($$props, 'x', 3, 0),
		y = prop($$props, 'y', 3, 0),
		width = prop($$props, 'width', 3, 0),
		height = prop($$props, 'height', 3, 0);

	var div = root$3();

	template_effect(() => set_style(div, `
        left: ${x() ?? ''}px;
        top: ${y() ?? ''}px;
        width: ${width() ?? ''}px;
        height: ${height() ?? ''}px;
    `));

	append($$anchor, div);
}

var root_2$2 = from_html(`<input type="text" class="tab-input svelte-1l76c1b"/>`);
var root_3$1 = from_html(`<span class="tab-name svelte-1l76c1b"> </span>`);
var root_1$1 = from_html(`<button><!></button>`);
var root_5$1 = from_html(`<button class="menu-item danger svelte-1l76c1b">Delete</button>`);
var root_4$1 = from_html(`<div class="context-menu svelte-1l76c1b" role="menu" tabindex="0"><button class="menu-item svelte-1l76c1b">Rename</button> <!></div>`);
var root$2 = from_html(`<div class="sheet-tabs svelte-1l76c1b"><div class="tabs-container svelte-1l76c1b"></div> <button class="add-btn svelte-1l76c1b" title="Add sheet"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" fill="none"></path></svg></button> <!></div>`);

function SheetTabs($$anchor, $$props) {
	push($$props, true);

	/** Optional handler to execute transactions (for add/delete/rename) */
	let sheets = prop($$props, 'sheets', 19, () => []),
		activeSheet = prop($$props, 'activeSheet', 3, 0);

	let contextMenuOpen = state(false);
	let contextMenuX = state(0);
	let contextMenuY = state(0);
	let contextMenuIndex = state(0);
	let editingIndex = state(null);
	let editingName = state('');

	function handleTabClick(index) {
		$$props.onActiveSheetChange?.(index);
	}

	function handleContextMenu(e, index) {
		e.preventDefault();
		e.stopPropagation();
		set(contextMenuIndex, index, true);
		set(contextMenuX, e.clientX, true);
		set(contextMenuY, e.clientY, true);
		set(contextMenuOpen, true);
	}

	function closeContextMenu() {
		set(contextMenuOpen, false);
	}

	function handleAddSheet() {
		if ($$props.onAddSheet) {
			$$props.onAddSheet();
		} else if ($$props.onTransaction) {
			const newName = findNewSheetName(sheets().map((s) => s.name));
			const newIdx = sheets().length;
			const payload = { type: 'createSheet', value: { idx: newIdx, newName } };

			$$props.onTransaction({ payloads: [payload], undoable: true, temp: false }).then((success) => {
				if (!success) {
					$$props.onActiveSheetChange?.(newIdx);
				}
			});
		}
	}

	function handleDeleteSheet() {
		closeContextMenu();
		$$props.onDeleteSheet?.(get(contextMenuIndex));
	}

	function startRename() {
		closeContextMenu();
		set(editingIndex, get(contextMenuIndex), true);
		set(editingName, sheets()[get(contextMenuIndex)]?.name ?? '', true);
	}

	function finishRename() {
		if (get(editingIndex) !== null && get(editingName).trim()) {
			$$props.onRenameSheet?.(get(editingIndex), get(editingName).trim());
		}

		set(editingIndex, null);
		set(editingName, '');
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') {
			finishRename();
		} else if (e.key === 'Escape') {
			set(editingIndex, null);
			set(editingName, '');
		}
	}

	function findNewSheetName(sheetNames) {
		const sheetPattern = /^Sheet(\d+)$/;

		const numbers = sheetNames.map((name) => {
			const match = name.match(sheetPattern);

			return match ? parseInt(match[1], 10) : null;
		}).filter((num) => num !== null);

		const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

		return `Sheet${nextNumber}`;
	}

	function getTabColor(sheet) {
		if (!sheet.tabColor) return undefined;

		// Convert ARGB to CSS color
		const argb = Number(sheet.tabColor);

		if (isNaN(argb)) return undefined;

		const a = argb >> 24 & 0xff;
		const r = argb >> 16 & 0xff;
		const g = argb >> 8 & 0xff;
		const b = argb & 0xff;

		if (a === 0) return undefined;

		return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
	}

	var div = root$2();

	event('click', $window, closeContextMenu);

	var div_1 = child(div);

	each(div_1, 21, sheets, index, ($$anchor, sheet, i) => {
		var button = root_1$1();
		let classes;

		button.__click = () => handleTabClick(i);
		button.__contextmenu = (e) => handleContextMenu(e, i);

		let styles;
		var node = child(button);

		{
			var consequent = ($$anchor) => {
				var input = root_2$2();
				input.__keydown = handleKeydown;
				event('blur', input, finishRename);
				bind_value(input, () => get(editingName), ($$value) => set(editingName, $$value));
				append($$anchor, input);
			};

			var alternate = ($$anchor) => {
				var span = root_3$1();
				var text = child(span);
				template_effect(() => set_text(text, get(sheet).name));
				append($$anchor, span);
			};

			if_block(node, ($$render) => {
				if (get(editingIndex) === i) $$render(consequent); else $$render(alternate, false);
			});
		}

		template_effect(
			($0) => {
				classes = set_class(button, 1, 'tab svelte-1l76c1b', null, classes, { active: i === activeSheet() });
				styles = set_style(button, '', styles, $0);
			},
			[() => ({ 'background-color': getTabColor(get(sheet)) })]
		);

		append($$anchor, button);
	});

	var button_1 = sibling(div_1, 2);

	button_1.__click = handleAddSheet;

	var node_1 = sibling(button_1, 2);

	{
		var consequent_2 = ($$anchor) => {
			var div_2 = root_4$1();

			div_2.__keydown = (e) => e.key === 'Escape' && closeContextMenu();

			var button_2 = child(div_2);

			button_2.__click = startRename;

			var node_2 = sibling(button_2, 2);

			{
				var consequent_1 = ($$anchor) => {
					var button_3 = root_5$1();

					button_3.__click = handleDeleteSheet;
					append($$anchor, button_3);
				};

				if_block(node_2, ($$render) => {
					if (sheets().length > 1) $$render(consequent_1);
				});
			}
			template_effect(() => set_style(div_2, `left: ${get(contextMenuX) ?? ''}px; top: ${get(contextMenuY) ?? ''}px;`));
			append($$anchor, div_2);
		};

		if_block(node_1, ($$render) => {
			if (get(contextMenuOpen)) $$render(consequent_2);
		});
	}
	append($$anchor, div);
	pop();
}

delegate(['click', 'contextmenu', 'keydown']);

var root$1 = from_html(`<div><div class="track svelte-1xzr1y2"><span class="thumb svelte-1xzr1y2"></span></div></div>`);

function Scrollbar($$anchor, $$props) {
	push($$props, true);

	/** Total document length in pixels */
	/** Current scroll position (0..totalLength) */
	/** Visible viewport length in pixels */
	/** Scrollbar orientation */
	/** Called when position changes */
	/** Called when dragging ends */
	let trackEl = state(void 0);

	let thumbEl = state(void 0);
	let visible = state(false);
	let hideTimeout = null;

	// Ensure totalLength is at least visibleLength + some buffer
	const effectiveTotalLength = user_derived(() => $$props.totalLength < $$props.visibleLength ? $$props.visibleLength + 200 : $$props.totalLength);

	// Calculate thumb dimensions and position
	const thumbStyle = user_derived(() => {
		if (!get(trackEl)) return {};

		const ratio = get(effectiveTotalLength) === 0
			? 0
			: $$props.visibleLength / get(effectiveTotalLength);

		const posRatio = get(effectiveTotalLength) === 0 ? 0 : $$props.position / get(effectiveTotalLength);

		if ($$props.orientation === 'x') {
			const containerLength = get(trackEl).clientWidth || 100;
			const thumbLength = Math.max(containerLength * ratio, 20);

			if (thumbLength >= containerLength) return { width: '0px' };

			const left = posRatio * containerLength;

			if (left + thumbLength > containerLength) {
				return { width: `${thumbLength}px`, right: '0px' };
			}

			return { width: `${thumbLength}px`, left: `${left}px` };
		} else {
			const containerLength = get(trackEl).clientHeight || 100;
			const thumbLength = Math.max(containerLength * ratio, 20);

			if (thumbLength >= containerLength) return { height: '0px' };

			const top = posRatio * containerLength;

			if (top + thumbLength > containerLength) {
				return { height: `${thumbLength}px`, bottom: '0px' };
			}

			return { height: `${thumbLength}px`, top: `${top}px` };
		}
	});

	function showScrollbar() {
		set(visible, true);

		if (hideTimeout) clearTimeout(hideTimeout);

		hideTimeout = setTimeout(
			() => {
				set(visible, false);
			},
			800
		);
	}

	function applyDelta(startDocPos, deltaPx) {
		if (!get(trackEl)) return;

		const totalPx = $$props.orientation === 'x'
			? get(trackEl).clientWidth
			: get(trackEl).clientHeight;

		const thumbPx = $$props.orientation === 'x'
			? get(thumbEl)?.offsetWidth ?? 0
			: get(thumbEl)?.offsetHeight ?? 0;

		const oldRatio = totalPx === 0 ? 0 : startDocPos / get(effectiveTotalLength);
		const oldStartPx = totalPx * oldRatio;
		let newStartPx = oldStartPx + deltaPx;

		if (newStartPx + thumbPx > totalPx) newStartPx = totalPx - thumbPx;
		if (newStartPx < 0) newStartPx = 0;

		const newRatio = totalPx === 0 ? 0 : newStartPx / totalPx;
		const newDocPos = clamp(newRatio * get(effectiveTotalLength), 0, get(effectiveTotalLength) - $$props.visibleLength);

		$$props.onChange?.(newDocPos);
	}

	function handleThumbMouseDown(e) {
		e.stopPropagation();
		e.preventDefault();

		const start = $$props.orientation === 'x' ? e.clientX : e.clientY;
		const startDocPos = $$props.position;

		function handleMouseMove(me) {
			me.preventDefault();
			me.stopPropagation();

			const end = $$props.orientation === 'x' ? me.clientX : me.clientY;

			applyDelta(startDocPos, end - start);
		}

		function handleMouseUp() {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			$$props.onBlur?.();
		}

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleWheel(e) {
		const delta = $$props.orientation === 'x' ? e.deltaX : e.deltaY;

		showScrollbar();
		applyDelta($$props.position, delta);
	}

	function handleMouseEnter() {
		set(visible, true);

		if (hideTimeout) clearTimeout(hideTimeout);
	}

	function handleMouseLeave() {
		if (hideTimeout) clearTimeout(hideTimeout);

		hideTimeout = setTimeout(
			() => {
				set(visible, false);
			},
			300
		);
	}

	function clamp(n, min, max) {
		return Math.max(min, Math.min(max, n));
	}

	// Show scrollbar when position changes
	user_effect(() => {
		$$props.position; // track this
		showScrollbar();
	});

	var div = root$1();
	let classes;
	var div_1 = child(div);
	var span = child(div_1);

	span.__mousedown = handleThumbMouseDown;

	let styles;

	bind_this(span, ($$value) => set(thumbEl, $$value), () => get(thumbEl));
	bind_this(div_1, ($$value) => set(trackEl, $$value), () => get(trackEl));

	template_effect(() => {
		classes = set_class(div, 1, 'scrollbar svelte-1xzr1y2', null, classes, {
			x: $$props.orientation === 'x',
			y: $$props.orientation === 'y',
			visible: get(visible)
		});

		styles = set_style(span, '', styles, {
			width: get(thumbStyle).width,
			height: get(thumbStyle).height,
			left: get(thumbStyle).left,
			right: get(thumbStyle).right,
			top: get(thumbStyle).top,
			bottom: get(thumbStyle).bottom
		});
	});

	event('wheel', div, handleWheel);
	event('mouseenter', div, handleMouseEnter);
	event('mouseleave', div, handleMouseLeave);
	append($$anchor, div);
	pop();
}

delegate(['mousedown']);

var root_3 = from_html(`<span class="menu-icon svelte-192vamk"> </span>`);
var root_4 = from_html(`<span class="menu-icon-placeholder svelte-192vamk"></span>`);
var root_5 = from_html(`<span class="menu-shortcut svelte-192vamk"> </span>`);
var root_6 = from_html(`<span class="menu-arrow svelte-192vamk">▶</span>`);
var root_9 = from_html(`<span class="menu-icon svelte-192vamk"> </span>`);
var root_10 = from_html(`<span class="menu-icon-placeholder svelte-192vamk"></span>`);
var root_11 = from_html(`<span class="menu-shortcut svelte-192vamk"> </span>`);
var root_12 = from_html(`<div class="menu-separator svelte-192vamk"></div>`);
var root_8 = from_html(`<button role="menuitem"><!> <span class="menu-label svelte-192vamk"> </span> <!></button> <!>`, 1);
var root_7 = from_html(`<div class="submenu svelte-192vamk"></div>`);
var root_13 = from_html(`<div class="menu-separator svelte-192vamk"></div>`);
var root_2$1 = from_html(`<div class="menu-item-wrapper svelte-192vamk"><button role="menuitem"><!> <span class="menu-label svelte-192vamk"> </span> <!> <!></button> <!></div> <!>`, 1);
var root_1 = from_html(`<div class="context-menu svelte-192vamk" role="menu" tabindex="-1"></div>`);

function ContextMenu($$anchor, $$props) {
	push($$props, true);

	// ========================================================================
	// Props
	// ========================================================================
	/** Whether the menu is visible */
	/** X position of the menu */
	/** Y position of the menu */
	/** Menu items to display */
	/** Context when menu was triggered */
	/** Called when a menu item is clicked */
	/** Called when menu should close */
	// ========================================================================
	// State
	// ========================================================================
	let menuEl = state(null);

	let adjustedX = state(0);
	let adjustedY = state(0);
	let activeSubmenu = state(null);

	// ========================================================================
	// Position adjustment to keep menu in viewport
	// ========================================================================
	user_effect(() => {
		if ($$props.visible && get(menuEl)) {
			const rect = get(menuEl).getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			let newX = $$props.x;
			let newY = $$props.y;

			// Adjust horizontal position
			if ($$props.x + rect.width > viewportWidth - 10) {
				newX = viewportWidth - rect.width - 10;
			}

			// Adjust vertical position
			if ($$props.y + rect.height > viewportHeight - 10) {
				newY = viewportHeight - rect.height - 10;
			}

			set(adjustedX, Math.max(10, newX), true);
			set(adjustedY, Math.max(10, newY), true);
		}
	});

	// ========================================================================
	// Event Handlers
	// ========================================================================
	function handleItemClick(item, e) {
		e.stopPropagation();

		if (item.disabled) return;

		if (item.children && item.children.length > 0) {
			// Toggle submenu
			set(activeSubmenu, get(activeSubmenu) === item.id ? null : item.id, true);

			return;
		}

		$$props.onItemClick?.(item, $$props.context);
		$$props.onClose?.();
	}

	function handleKeyDown(e) {
		if (e.key === 'Escape') {
			$$props.onClose?.();
		}
	}

	function handleClickOutside(e) {
		if (get(menuEl) && !get(menuEl).contains(e.target)) {
			$$props.onClose?.();
		}
	}

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});

	var fragment = comment();

	event('keydown', $window, handleKeyDown);

	var node = first_child(fragment);

	{
		var consequent_8 = ($$anchor) => {
			var div = root_1();

			each(div, 21, () => $$props.items, (item) => item.id, ($$anchor, item) => {
				var fragment_1 = root_2$1();
				var div_1 = first_child(fragment_1);
				var button = child(div_1);
				let classes;

				button.__click = (e) => handleItemClick(get(item), e);

				var node_1 = child(button);

				{
					var consequent = ($$anchor) => {
						var span = root_3();
						var text = child(span);
						template_effect(() => set_text(text, get(item).icon));
						append($$anchor, span);
					};

					var alternate = ($$anchor) => {
						var span_1 = root_4();

						append($$anchor, span_1);
					};

					if_block(node_1, ($$render) => {
						if (get(item).icon) $$render(consequent); else $$render(alternate, false);
					});
				}

				var span_2 = sibling(node_1, 2);
				var text_1 = child(span_2);

				var node_2 = sibling(span_2, 2);

				{
					var consequent_1 = ($$anchor) => {
						var span_3 = root_5();
						var text_2 = child(span_3);
						template_effect(() => set_text(text_2, get(item).shortcut));
						append($$anchor, span_3);
					};

					if_block(node_2, ($$render) => {
						if (get(item).shortcut) $$render(consequent_1);
					});
				}

				var node_3 = sibling(node_2, 2);

				{
					var consequent_2 = ($$anchor) => {
						var span_4 = root_6();

						append($$anchor, span_4);
					};

					if_block(node_3, ($$render) => {
						if (get(item).children && get(item).children.length > 0) $$render(consequent_2);
					});
				}

				var node_4 = sibling(button, 2);

				{
					var consequent_6 = ($$anchor) => {
						var div_2 = root_7();

						each(div_2, 21, () => get(item).children, (child) => child.id, ($$anchor, child$1) => {
							var fragment_2 = root_8();
							var button_1 = first_child(fragment_2);
							let classes_1;

							button_1.__click = (e) => handleItemClick(get(child$1), e);

							var node_5 = child(button_1);

							{
								var consequent_3 = ($$anchor) => {
									var span_5 = root_9();
									var text_3 = child(span_5);
									template_effect(() => set_text(text_3, get(child$1).icon));
									append($$anchor, span_5);
								};

								var alternate_1 = ($$anchor) => {
									var span_6 = root_10();

									append($$anchor, span_6);
								};

								if_block(node_5, ($$render) => {
									if (get(child$1).icon) $$render(consequent_3); else $$render(alternate_1, false);
								});
							}

							var span_7 = sibling(node_5, 2);
							var text_4 = child(span_7);

							var node_6 = sibling(span_7, 2);

							{
								var consequent_4 = ($$anchor) => {
									var span_8 = root_11();
									var text_5 = child(span_8);
									template_effect(() => set_text(text_5, get(child$1).shortcut));
									append($$anchor, span_8);
								};

								if_block(node_6, ($$render) => {
									if (get(child$1).shortcut) $$render(consequent_4);
								});
							}

							var node_7 = sibling(button_1, 2);

							{
								var consequent_5 = ($$anchor) => {
									var div_3 = root_12();

									append($$anchor, div_3);
								};

								if_block(node_7, ($$render) => {
									if (get(child$1).separator) $$render(consequent_5);
								});
							}

							template_effect(() => {
								classes_1 = set_class(button_1, 1, 'menu-item svelte-192vamk', null, classes_1, { disabled: get(child$1).disabled });
								set_attribute(button_1, 'aria-disabled', get(child$1).disabled);
								set_text(text_4, get(child$1).label);
							});

							append($$anchor, fragment_2);
						});
						append($$anchor, div_2);
					};

					if_block(node_4, ($$render) => {
						if (get(item).children && get(item).children.length > 0 && get(activeSubmenu) === get(item).id) $$render(consequent_6);
					});
				}

				var node_8 = sibling(div_1, 2);

				{
					var consequent_7 = ($$anchor) => {
						var div_4 = root_13();

						append($$anchor, div_4);
					};

					if_block(node_8, ($$render) => {
						if (get(item).separator) $$render(consequent_7);
					});
				}

				template_effect(() => {
					classes = set_class(button, 1, 'menu-item svelte-192vamk', null, classes, {
						disabled: get(item).disabled,
						'has-children': get(item).children && get(item).children.length > 0
					});

					set_attribute(button, 'aria-disabled', get(item).disabled);
					set_text(text_1, get(item).label);
				});

				event('mouseenter', button, () => {
					if (get(item).children && get(item).children.length > 0) {
						set(activeSubmenu, get(item).id, true);
					}
				});

				append($$anchor, fragment_1);
			});
			bind_this(div, ($$value) => set(menuEl, $$value), () => get(menuEl));
			template_effect(() => set_style(div, `left: ${get(adjustedX) ?? ''}px; top: ${get(adjustedY) ?? ''}px;`));
			append($$anchor, div);
		};

		if_block(node, ($$render) => {
			if ($$props.visible) $$render(consequent_8);
		});
	}

	append($$anchor, fragment);
	pop();
}

delegate(['click']);

var root_2 = from_html(`<div class="scrollbar-y svelte-rlol6m"><!></div> <div class="scrollbar-x svelte-rlol6m"><!></div>`, 1);
var root = from_html(`<div class="spreadsheet-container svelte-rlol6m"><div><div class="canvas-wrapper svelte-rlol6m"><div class="corner-cell svelte-rlol6m"></div> <!> <!> <canvas tabindex="0" class="main-canvas svelte-rlol6m">Your browser does not support canvas.</canvas> <!> <!></div></div> <!> <!></div>`);

function Spreadsheet($$anchor, $$props) {
	push($$props, true);

	// Auto-scroll constants
	const AUTO_SCROLL_THRESHOLD = 32; // pixels from edge to trigger scroll

	const AUTO_SCROLL_SPEED = 30; // pixels per scroll tick
	const AUTO_SCROLL_INTERVAL = 50; // ms between scroll ticks

	// Auto-scroll state
	let dragScrollInterval = null;

	let lastDragMouseEvent = null;
	let isScrolling = false;
	let isDragging = false; // True while user is drag-selecting

	// ========================================================================
	// Props
	// ========================================================================
	/** Currently selected data */
	/** Active sheet index */
	/** Cell layouts for custom rendering */
	/** Engine configuration */
	/** Show sheet tabs at bottom */
	/** Show scrollbars */
	/** Custom context menu items */
	/** Callback when selection changes */
	/** Callback when active sheet changes */
	/** Callback when grid updates */
	/** Callback when sheets list changes */
	/** Callback when context menu item is clicked */
	/** Callback when user wants to start editing a cell (double-click or direct typing) */
	/** Callback when an invalid formula is entered */
	/** External data service (when used via Engine.mount()) */
	/** Getter for whether a formula is being edited (prevents canvas from taking focus) */
	let selectedData = prop($$props, 'selectedData', 31, () => proxy({ source: 'none' })),
		activeSheet = prop($$props, 'activeSheet', 15, 0);
		prop($$props, 'cellLayouts', 19, () => []);
		let config = prop($$props, 'config', 19, () => ({})),
		showSheetTabs = prop($$props, 'showSheetTabs', 3, true),
		showScrollbars = prop($$props, 'showScrollbars', 3, true),
		contextMenuItems = prop($$props, 'contextMenuItems', 19, () => []),
		externalDataService = prop($$props, 'dataService', 3, null);

	// ========================================================================
	// Configuration (merge with defaults)
	// ========================================================================
	const defaultConfig = {
		leftTopWidth: 32,
		leftTopHeight: 24,
		showHorizontalGridLines: true,
		showVerticalGridLines: true,
		defaultCellWidth: 6,
		defaultCellHeight: 25,
		scrollbarSize: 16
	};

	const cfg = user_derived(() => ({ ...defaultConfig, ...config() }));

	const LeftTop = user_derived(() => ({
		width: get(cfg).leftTopWidth,
		height: get(cfg).leftTopHeight
	}));

	const CANVAS_ID = simpleUuid();

	// ========================================================================
	// State
	// ========================================================================
	let grid = state(null);

	let sheets = state(proxy([]));
	let internalDataService = state(null);

	// Sheets whose row/col header strip is stale because a SetColWidth /
	// SetRowHeight transaction targeted them while they weren't active.
	// Cleared as we render() that sheet (either immediately if it's the
	// active one, or when the user switches to it).
	const dirtyHeaderSheets = new Set();

	// Use external data service if provided, otherwise use internal one
	let dataService = user_derived(() => externalDataService() ?? get(internalDataService));

	let canvasEl = state(null);
	let offscreenCanvas = null;
	let anchorX = state(0);
	let anchorY = state(0);

	// Scrollbar state
	let documentHeight = state(0);

	let documentWidth = state(0);
	let visibleHeight = state(0);
	let visibleWidth = state(0);
	let scrollbarRendering = state(false);

	// Selection state
	let selector = state(null);

	let selectedRowRange = state(undefined);
	let selectedColumnRange = state(undefined);
	let startCell;
	let endCell;

	// Double-click detection
	let lastClickTime = 0;

	let lastClickRow = -1;
	let lastClickCol = -1;

	// Context menu state
	let contextMenuVisible = state(false);

	let contextMenuX = state(0);
	let contextMenuY = state(0);
	let contextMenuContext = state(null);

	// Cleanup references
	let resizeObserver = null;

	let worker = null;
	let prevDpr = 1;

	// Track if we created the worker internally (need to clean up) vs using external data service
	let ownsWorker = false;

	// ========================================================================
	// Lifecycle
	// ========================================================================
	onMount(() => {
		initializeAsync();

		return cleanup;
	});

	async function initializeAsync() {
		// If external data service is provided, use it; otherwise create our own
		if (externalDataService()) {
			// Using external data service from Engine - just initialize canvas
			if (get(canvasEl)) {
				setCanvasSize();

				// Transfer control to offscreen
				if ('transferControlToOffscreen' in get(canvasEl)) {
					offscreenCanvas = get(canvasEl).transferControlToOffscreen();
					await externalDataService().initOffscreen(offscreenCanvas);
					await render();
				}
			}

			// Register callbacks for external data service
			externalDataService().registerCellUpdatedCallback(async () => {
				const sheetList = externalDataService().getCacheAllSheetInfo();

				set(sheets, sheetList, true);
				$$props.onSheetsChange?.(sheetList);

				if (activeSheet() > sheetList.length - 1) {
					activeSheet(sheetList.length - 1);
					$$props.onActiveSheetChange?.(activeSheet());
					externalDataService().setCurrentSheetIdx(activeSheet());
				}

				await render();
				updateDocumentDimensions();
			});

			externalDataService().registerSheetUpdatedCallback(() => {
				const sheetList = externalDataService().getCacheAllSheetInfo();

				set(sheets, sheetList, true);
				$$props.onSheetsChange?.(sheetList);
			});

			externalDataService().registerHeaderUpdatedCallback((sheetIdxes) => onHeaderUpdated(sheetIdxes));

			// Load initial sheets list
			externalDataService().getWorkbook().getAllSheetInfo().then((v) => {
				if (!isErrorMessage(v)) {
					set(sheets, v, true);
					$$props.onSheetsChange?.(v);
				}
			});
		} else {
			// Create our own worker and data service
			ownsWorker = true;

			worker = new WorkerWrapper();
			set(internalDataService, new DataService(worker), true);

			// Initialize canvas
			if (get(canvasEl)) {
				setCanvasSize();

				// Transfer control to offscreen
				if ('transferControlToOffscreen' in get(canvasEl)) {
					offscreenCanvas = get(canvasEl).transferControlToOffscreen();
					await get(internalDataService).initOffscreen(offscreenCanvas);
					await render();
				}
			}

			// Register callbacks
			get(internalDataService).registerCellUpdatedCallback(async () => {
				const sheetList = get(internalDataService).getCacheAllSheetInfo();

				set(sheets, sheetList, true);
				$$props.onSheetsChange?.(sheetList);

				if (activeSheet() > sheetList.length - 1) {
					activeSheet(sheetList.length - 1);
					$$props.onActiveSheetChange?.(activeSheet());
					get(internalDataService).setCurrentSheetIdx(activeSheet());
				}

				await render();
				updateDocumentDimensions();
			});

			// Also register sheet update callback
			get(internalDataService).registerSheetUpdatedCallback(() => {
				const sheetList = get(internalDataService).getCacheAllSheetInfo();

				set(sheets, sheetList, true);
				$$props.onSheetsChange?.(sheetList);
			});

			get(internalDataService).registerHeaderUpdatedCallback((sheetIdxes) => onHeaderUpdated(sheetIdxes));

			// Load initial sheets list
			get(internalDataService).getWorkbook().getAllSheetInfo().then((v) => {
				if (!isErrorMessage(v)) {
					set(sheets, v, true);
					$$props.onSheetsChange?.(v);
				}
			});
		}

		// Observe canvas size changes
		resizeObserver = new ResizeObserver(() => handleResize());

		if (get(canvasEl)) {
			resizeObserver.observe(get(canvasEl));
		}

		// Watch for DPR changes (zoom, moving to different display)
		prevDpr = window.devicePixelRatio || 1;

		window.addEventListener('resize', handleDprChange);
	}

	function cleanup() {
		resizeObserver?.disconnect();

		// Only terminate worker if we created it internally
		if (ownsWorker && worker) {
			worker.terminate();
		}

		window.removeEventListener('resize', handleDprChange);
	}

	// ========================================================================
	// Canvas Setup
	// ========================================================================
	function handleDprChange() {
		const currentDpr = window.devicePixelRatio || 1;

		if (Math.abs(currentDpr - prevDpr) > 1e-6) {
			prevDpr = currentDpr;
			handleResize();
		}
	}

	function setCanvasSize() {
		if (!get(canvasEl)) return null;

		const size = get(canvasEl).getBoundingClientRect();

		get(canvasEl).width = size.width * (window.devicePixelRatio || 1);
		get(canvasEl).height = size.height * (window.devicePixelRatio || 1);
		set(visibleHeight, size.height, true);
		set(visibleWidth, size.width, true);

		return size;
	}

	function handleResize() {
		if (!get(canvasEl) || !get(dataService)) return;

		const rect = get(canvasEl).getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		get(dataService).resize(rect.width, rect.height, dpr);
		set(visibleHeight, rect.height, true);
		set(visibleWidth, rect.width, true);
	}

	async function updateDocumentDimensions() {
		if (!get(dataService)) return;

		const dimension = await get(dataService).getSheetDimension(activeSheet());

		if (!isErrorMessage(dimension)) {
			// Rust returns height in pt and width in Excel column-width
			// units. Convert to pixels so they share the same space as
			// anchorY / anchorX / visibleHeight / visibleWidth (all px).
			// The scrollbar component needs all three in the same unit.
			set(documentHeight, ptToPx$1(dimension.height), true);

			set(documentWidth, widthToPx$1(dimension.width), true);
		}
	}

	// ========================================================================
	// Rendering
	// ========================================================================
	async function render() {
		if (!get(dataService)) return;

		const sheetId = get(dataService).getCurrentSheetId();
		const g = await get(dataService).render(sheetId, get(anchorX), get(anchorY));

		if (isErrorMessage(g)) return;

		set(grid, g, true);
		set(anchorX, g.anchorX, true);
		set(anchorY, g.anchorY, true);
		$$props.onGridChange?.(get(grid));

		// The just-rendered sheet is now in sync — drop it from the
		// pending-header-refresh set if it was queued there.
		dirtyHeaderSheets.delete(activeSheet());
	}

	// Engine signal: the listed sheets had row-height / column-width
	// changes. If the active sheet is among them, refresh its layout now.
	// For the rest, queue them up — the next switch into one will render()
	// it and clear the entry.
	function onHeaderUpdated(sheetIdxes) {
		for (const idx of sheetIdxes) {
			if (idx === activeSheet()) {
				render();
			} else {
				dirtyHeaderSheets.add(idx);
			}
		}
	}

	async function renderWithAnchor(newAnchorX, newAnchorY) {
		if (!get(dataService)) return;

		const sheetId = get(dataService).getCurrentSheetId();
		const g = await get(dataService).render(sheetId, newAnchorX, newAnchorY);

		if (isErrorMessage(g)) return;

		set(grid, g, true);
		set(anchorX, g.anchorX, true);
		set(anchorY, g.anchorY, true);
		$$props.onGridChange?.(get(grid));
	}

	// ========================================================================
	// Selection
	// ========================================================================
	// Track previous selectedData to detect external changes
	let prevSelectedData = null;

	// Use $effect for reactive updates in Svelte 5
	user_effect(() => {
		updateSelector(selectedData(), get(grid));
	});

	// Jump to selection when selectedData changes from external source
	user_effect(() => {
		if (!get(dataService) || !get(grid)) return;

		// Skip auto-jump while user is drag-selecting (they control the scroll)
		if (isDragging) return;

		// Check if this is a new selection (not from internal mouse/keyboard)
		const sel = selectedData().data;

		if (!sel || sel.ty !== 'cellRange') return;

		// Compare with previous to detect external changes
		const prevSel = prevSelectedData?.data;

		if (prevSel && prevSel.ty === 'cellRange') {
			const same = prevSel.d.startRow === sel.d.startRow && prevSel.d.startCol === sel.d.startCol && prevSel.d.endRow === sel.d.endRow && prevSel.d.endCol === sel.d.endCol;

			if (same) return;
		}

		prevSelectedData = selectedData();

		// Check if selection is outside visible area
		const { startRow, startCol } = sel.d;

		const firstCol = get(grid).columns[0]?.idx ?? 0;
		const lastCol = get(grid).columns[get(grid).columns.length - 1]?.idx ?? firstCol;
		const firstRow = get(grid).rows[0]?.idx ?? 0;
		const lastRow = get(grid).rows[get(grid).rows.length - 1]?.idx ?? firstRow;
		const needsJump = startRow < firstRow || startRow > lastRow || startCol < firstCol || startCol > lastCol;

		if (needsJump) {
			// Calculate new anchor position to show the selected cell
			scrollToCell(startRow, startCol);
		}
	});

	async function scrollToCell(row, col) {
		if (!get(dataService)) return;

		// Get the position for this cell
		get(dataService).getCurrentSheetId();

		// Estimate position - we need to calculate based on row/col
		// For now, use a simple approach: render at approximate position
		const rowHeightEstimate = 20; // Default row height in pixels

		const colWidthEstimate = 60; // Default col width in pixels
		const newAnchorY = Math.max(0, row * rowHeightEstimate - get(visibleHeight) / 4);
		const newAnchorX = Math.max(0, col * colWidthEstimate - get(visibleWidth) / 4);

		await renderWithAnchor(newAnchorX, newAnchorY);
	}

	function updateSelector(data, g) {
		if (!g) {
			set(selector, null);

			return;
		}

		const sel = data.data;

		if (!sel) {
			set(selector, null);

			return;
		}

		const firstCol = g.columns[0]?.idx ?? 0;
		const lastCol = g.columns[g.columns.length - 1]?.idx ?? firstCol;
		const firstRow = g.rows[0]?.idx ?? 0;
		const lastRow = g.rows[g.rows.length - 1]?.idx ?? firstRow;

		if (sel.ty === 'cellRange') {
			const { startRow: row1, endRow: row2, startCol: col1, endCol: col2 } = sel.d;
			const startCol = Math.min(col1, col2);
			const endCol = Math.max(col1, col2);
			const startRow = Math.min(row1, row2);
			const endRow = Math.max(row1, row2);
			const visStartCol = Math.max(startCol, firstCol);
			const visEndCol = Math.min(endCol, lastCol);
			const visStartRow = Math.max(startRow, firstRow);
			const visEndRow = Math.min(endRow, lastRow);

			if (visStartCol > visEndCol || visStartRow > visEndRow) {
				set(selector, null);

				return;
			}

			const startX = xForColStart(visStartCol, g);
			const endX = xForColEnd(visEndCol, g);
			const startY = yForRowStart(visStartRow, g);
			const endY = yForRowEnd(visEndRow, g);

			set(
				selector,
				{
					x: get(LeftTop).width + startX - 1,
					y: get(LeftTop).height + startY - 1,
					width: Math.max(0, endX - startX),
					height: Math.max(0, endY - startY)
				},
				true
			);
		}
	}

	user_effect(() => {
		const rows = getSelectedRows(selectedData());

		if (rows.length > 0) {
			set(selectedRowRange, [Math.min(rows[0], rows[1]), Math.max(rows[0], rows[1])], true);
		} else {
			set(selectedRowRange, undefined);
		}

		const cols = getSelectedColumns(selectedData());

		if (cols.length > 0) {
			set(selectedColumnRange, [Math.min(cols[0], cols[1]), Math.max(cols[0], cols[1])], true);
		} else {
			set(selectedColumnRange, undefined);
		}
	});

	// ========================================================================
	// Event Handlers
	// ========================================================================
	async function onMouseDown(e) {
		e.stopPropagation();
		e.preventDefault();

		if (e.button !== 0) return; // Only left click
		if (!get(grid) || !get(canvasEl)) return;

		// Don't steal focus from formula editor
		const isEditingFormula = $$props.getIsEditingFormula?.() ?? false;

		if (!isEditingFormula) {
			get(canvasEl).focus({ preventScroll: true });
		}

		const rect = get(canvasEl).getBoundingClientRect();
		const matchedCell = match(e.clientX - rect.left, e.clientY - rect.top, get(anchorX), get(anchorY), get(grid));

		if (!matchedCell) return;

		const { startRow: row, startCol: col } = matchedCell.coordinate;

		// Double-click detection
		const now = Date.now();

		const isDoubleClick = now - lastClickTime < 300 && lastClickRow === row && lastClickCol === col;

		lastClickTime = now;
		lastClickRow = row;
		lastClickCol = col;

		if (isDoubleClick && $$props.onStartEdit && get(dataService)) {
			// Double-click to start editing with current content
			const sheetIdx = get(dataService).getCurrentSheetIdx();

			const cellInfo = await get(dataService).getCellInfo(sheetIdx, row, col);
			let initialText = '';

			if (cellInfo && !isErrorMessage(cellInfo)) {
				if (cellInfo.getFormula() !== '') {
					initialText = '=' + cellInfo.getFormula();
				} else {
					initialText = cellInfo.getText();
				}
			}

			$$props.onStartEdit(row, col, initialText);

			return;
		}

		startCell = matchedCell;
		endCell = undefined;
		isDragging = true;

		const data = buildSelectedDataFromCell(row, col, 'none');

		selectedData(data);
		$$props.onSelectedDataChange?.(data);

		const stopAutoScroll = () => {
			if (dragScrollInterval) {
				clearInterval(dragScrollInterval);
				dragScrollInterval = null;
			}
		};

		const startAutoScroll = (scrollX, scrollY) => {
			if (dragScrollInterval) return; // Already scrolling

			dragScrollInterval = setInterval(
				async () => {
					if (!get(canvasEl) || !get(grid) || !startCell || isScrolling) return;

					isScrolling = true;

					try {
						let newAnchorX = get(anchorX);
						let newAnchorY = get(anchorY);

						if (scrollY > 0) {
							newAnchorY = get(anchorY) + AUTO_SCROLL_SPEED;
						} else if (scrollY < 0) {
							newAnchorY = Math.max(0, get(anchorY) - AUTO_SCROLL_SPEED);
						}

						if (scrollX > 0) {
							newAnchorX = get(anchorX) + AUTO_SCROLL_SPEED;
						} else if (scrollX < 0) {
							newAnchorX = Math.max(0, get(anchorX) - AUTO_SCROLL_SPEED);
						}

						if (newAnchorX !== get(anchorX) || newAnchorY !== get(anchorY)) {
							// Wait for render to complete - after this, grid and anchorX/Y are in sync
							await renderWithAnchor(newAnchorX, newAnchorY);

							// Update selection with the now-consistent state
							if (lastDragMouseEvent && get(grid) && get(canvasEl) && startCell) {
								const r = get(canvasEl).getBoundingClientRect();
								const cell = match(lastDragMouseEvent.clientX - r.left, lastDragMouseEvent.clientY - r.top, get(anchorX), get(anchorY), get(grid));

								if (cell) {
									endCell = cell;

									const { startRow: sr, startCol: sc } = startCell.coordinate;
									const { endRow: er, endCol: ec } = endCell.coordinate;
									const d = buildSelectedDataFromCellRange(sr, sc, er, ec, 'none');

									selectedData(d);
									$$props.onSelectedDataChange?.(d);
								}
							}
						}
					} finally {
						isScrolling = false;
					}
				},
				AUTO_SCROLL_INTERVAL
			);
		};

		const handleMouseMove = (mme) => {
			if (!get(grid) || !get(canvasEl)) return;

			lastDragMouseEvent = mme;

			const r = get(canvasEl).getBoundingClientRect();
			const relX = mme.clientX - r.left;
			const relY = mme.clientY - r.top;

			// Check if mouse is in edge zone
			let scrollX = 0;

			let scrollY = 0;

			if (relY > r.height - AUTO_SCROLL_THRESHOLD) {
				scrollY = 1; // Scroll down
			} else if (relY < AUTO_SCROLL_THRESHOLD) {
				scrollY = -1; // Scroll up
			}

			if (relX > r.width - AUTO_SCROLL_THRESHOLD) {
				scrollX = 1; // Scroll right
			} else if (relX < AUTO_SCROLL_THRESHOLD) {
				scrollX = -1; // Scroll left
			}

			if (scrollX !== 0 || scrollY !== 0) {
				// In edge zone - start auto-scroll, don't update selection here
				startAutoScroll(scrollX, scrollY);
			} else {
				// Not in edge zone - stop auto-scroll, update selection normally
				stopAutoScroll();

				const cell = match(relX, relY, get(anchorX), get(anchorY), get(grid));

				if (!cell || !startCell) return;

				endCell = cell;

				const { startRow: sr, startCol: sc } = startCell.coordinate;
				const { endRow: er, endCol: ec } = endCell.coordinate;
				const d = buildSelectedDataFromCellRange(sr, sc, er, ec, 'none');

				selectedData(d);
				$$props.onSelectedDataChange?.(d);
			}
		};

		const handleMouseUp = () => {
			stopAutoScroll();
			isDragging = false;
			lastDragMouseEvent = null;
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function onContextMenu(e) {
		e.preventDefault();
		e.stopPropagation();

		// Only show if we have custom menu items
		if (contextMenuItems().length === 0) return;

		if (!get(grid) || !get(canvasEl)) return;

		const rect = get(canvasEl).getBoundingClientRect();
		const matchedCell = match(e.clientX - rect.left, e.clientY - rect.top, get(anchorX), get(anchorY), get(grid));

		// If clicking on a cell that's not in current selection, select it first
		if (matchedCell) {
			const { startRow: row, startCol: col } = matchedCell.coordinate;
			const currentRange = selectedData().data;

			// Check if clicked cell is within current selection
			let inSelection = false;

			if (currentRange?.ty === 'cellRange') {
				const { startRow, startCol, endRow, endCol } = currentRange.d;
				const minRow = Math.min(startRow, endRow);
				const maxRow = Math.max(startRow, endRow);
				const minCol = Math.min(startCol, endCol);
				const maxCol = Math.max(startCol, endCol);

				inSelection = row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
			}

			if (!inSelection) {
				// Select the clicked cell
				const data = buildSelectedDataFromCell(row, col, 'none');

				selectedData(data);
				$$props.onSelectedDataChange?.(data);
			}

			set(
				contextMenuContext,
				{
					selectedData: selectedData(),
					target: 'cell',
					row,
					col,
					event: e
				},
				true
			);
		} else {
			set(contextMenuContext, { selectedData: selectedData(), target: 'cell', event: e }, true);
		}

		set(contextMenuX, e.clientX, true);
		set(contextMenuY, e.clientY, true);
		set(contextMenuVisible, true);
	}

	function closeContextMenu() {
		set(contextMenuVisible, false);
		set(contextMenuContext, null);
	}

	function handleContextMenuItemClick(item, context) {
		$$props.onContextMenuItemClick?.(item, context);
		closeContextMenu();
	}

	function onColumnContextMenu(col, e) {
		if (contextMenuItems().length === 0) return;

		set(
			contextMenuContext,
			{
				selectedData: selectedData(),
				target: 'column',
				col,
				event: e
			},
			true
		);

		set(contextMenuX, e.clientX, true);
		set(contextMenuY, e.clientY, true);
		set(contextMenuVisible, true);
	}

	function onRowContextMenu(row, e) {
		if (contextMenuItems().length === 0) return;

		set(contextMenuContext, { selectedData: selectedData(), target: 'row', row, event: e }, true);
		set(contextMenuX, e.clientX, true);
		set(contextMenuY, e.clientY, true);
		set(contextMenuVisible, true);
	}

	// ========================================================================
	// Resize Handlers
	// ========================================================================
	function onResizeCol(colIdx, deltaPx) {
		if (!get(grid) || !get(dataService)) return;

		const col = get(grid).columns.find((c) => c.idx === colIdx);

		if (!col) return;

		const newWidthPx = Math.max(10, col.width + deltaPx); // Minimum 10px width
		const sheetIdx = get(dataService).getCurrentSheetIdx();

		get(dataService).handleTransaction({
			payloads: [
				{
					type: 'setColWidth',
					value: { sheetIdx, col: colIdx, width: pxToWidth$1(newWidthPx) }
				}
			],
			undoable: true,
			temp: false
		});
	}

	function onResizeRow(rowIdx, deltaPx) {
		if (!get(grid) || !get(dataService)) return;

		const row = get(grid).rows.find((r) => r.idx === rowIdx);

		if (!row) return;

		const newHeightPx = Math.max(10, row.height + deltaPx); // Minimum 10px height
		const sheetIdx = get(dataService).getCurrentSheetIdx();

		get(dataService).handleTransaction({
			payloads: [
				{
					type: 'setRowHeight',
					value: { sheetIdx, row: rowIdx, height: pxToPt$1(newHeightPx) }
				}
			],
			undoable: true,
			temp: false
		});
	}

	function onWheel(e) {
		e.preventDefault();

		// anchorY is in pixels (same space as data.rows[i].position.startRow
		// / Grid.anchorY returned by the worker). wheel deltaY is also in
		// pixels, so add directly — no pt conversion.
		let delta = e.deltaY;

		if (delta < 0 && get(grid)?.preRowHeight) {
			delta = -Math.max(-e.deltaY, ptToPx$1(get(grid).preRowHeight) * 1.5);
		} else if (delta > 0 && get(grid)?.nextRowHeight) {
			delta = Math.max(e.deltaY, ptToPx$1(get(grid).nextRowHeight) * 1.5);
		}

		const newY = Math.max(0, get(anchorY) + delta);

		if (newY === get(anchorY)) return;

		renderWithAnchor(get(anchorX), newY);
	}

	async function onKeyDown(e) {
		if (e.metaKey || e.altKey || e.ctrlKey) return;
		if (!get(grid) || !get(dataService) || !get(canvasEl)) return;

		const selectedCells = getSelectedCellRange(selectedData());

		if (!selectedCells) return;

		const row = selectedCells.startRow;
		const col = selectedCells.startCol;
		const size = get(canvasEl).getBoundingClientRect();
		let direction = null;

		switch (e.key) {
			case 'ArrowUp':
				direction = 'up';
				break;

			case 'ArrowDown':
				direction = 'down';
				break;

			case 'ArrowLeft':
				direction = 'left';
				break;

			case 'ArrowRight':
				direction = 'right';
				break;

			case 'Enter':
				direction = e.shiftKey ? 'up' : 'down';
				break;

			case 'Tab':
				direction = e.shiftKey ? 'left' : 'right';
				break;

			case 'F2':
				// F2 key to start editing with current content
				if ($$props.onStartEdit) {
					e.stopPropagation();
					e.preventDefault();

					const sheetIdx = get(dataService).getCurrentSheetIdx();
					const cellInfo = await get(dataService).getCellInfo(sheetIdx, row, col);
					let initialText = '';

					if (cellInfo && !isErrorMessage(cellInfo)) {
						if (cellInfo.getFormula() !== '') {
							initialText = '=' + cellInfo.getFormula();
						} else {
							initialText = cellInfo.getText();
						}
					}

					$$props.onStartEdit(row, col, initialText);
				}
				return;

			case 'Delete':

			case 'Backspace':
				// Delete/Backspace clears the cell and starts editing
				if ($$props.onStartEdit) {
					e.stopPropagation();
					e.preventDefault();
					$$props.onStartEdit(row, col, '');
				}
				return;

			default:
				// Check if it's a printable character to start direct typing
				if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
					if ($$props.onStartEdit) {
						e.stopPropagation();
						e.preventDefault();
						$$props.onStartEdit(row, col, e.key);
					}
				}
				return;
		}

		// Navigation keys - prevent default and stop propagation
		e.stopPropagation();

		e.preventDefault();

		const workbook = get(dataService).getWorkbook();
		const sheetIdx = get(dataService).getCurrentSheetIdx();

		switch (direction) {
			case 'up':
				{
					if (row === 0) return;

					// Check if previous row is visible
					const [startIdx, _endIdx] = findVisibleRowIdxRange(get(anchorY), size.height - 50, get(grid));

					const idx = get(grid).rows.findIndex((v) => v.idx === row);

					if (idx >= 0 && idx - 1 >= startIdx) {
						// Cell above is visible, just select it
						const newData = buildSelectedDataFromCellRange(get(grid).rows[idx - 1].idx, col, get(grid).rows[idx - 1].idx, col, 'none');

						selectedData(newData);
						$$props.onSelectedDataChange?.(newData);

						return;
					}

					// Need to scroll - get position of cell above
					const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'up' });

					if (isErrorMessage(nextCell)) return;

					const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x });

					if (isErrorMessage(cellPos)) return;

					await renderWithAnchor(get(anchorX), ptToPx$1(cellPos.y));

					const newData = buildSelectedDataFromCellRange(nextCell.y, col, nextCell.y, col, 'none');

					selectedData(newData);
					$$props.onSelectedDataChange?.(newData);

					return;
				}

			case 'down':
				{
					// Check if next row is visible
					const [_startIdx, endIdx] = findVisibleRowIdxRange(get(anchorY), size.height - 50, get(grid));

					const idx = get(grid).rows.findIndex((v) => v.idx === row);

					if (idx >= 0 && idx + 1 <= endIdx) {
						// Cell below is visible, just select it
						const newData = buildSelectedDataFromCellRange(get(grid).rows[idx + 1].idx, col, get(grid).rows[idx + 1].idx, col, 'none');

						selectedData(newData);
						$$props.onSelectedDataChange?.(newData);

						return;
					}

					// Need to scroll - get position of cell below
					const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'down' });

					if (isErrorMessage(nextCell)) return;

					const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x });

					if (isErrorMessage(cellPos)) return;

					await renderWithAnchor(get(anchorX), ptToPx$1(cellPos.y) - size.height + 50);

					const newData = buildSelectedDataFromCellRange(nextCell.y, col, nextCell.y, col, 'none');

					selectedData(newData);
					$$props.onSelectedDataChange?.(newData);

					return;
				}

			case 'left':
				{
					if (col === 0) return;

					// Check if previous col is visible
					const [startIdx, _endIdx] = findVisibleColIdxRange(get(anchorX), size.width, get(grid));

					const idx = get(grid).columns.findIndex((v) => v.idx === col);

					if (idx > 0 && idx - 1 >= startIdx) {
						// Cell to left is visible, just select it
						const newData = buildSelectedDataFromCellRange(row, get(grid).columns[idx - 1].idx, row, get(grid).columns[idx - 1].idx, 'none');

						selectedData(newData);
						$$props.onSelectedDataChange?.(newData);

						return;
					}

					// Need to scroll - get position of cell to left
					const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'left' });

					if (isErrorMessage(nextCell)) return;

					const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x });

					if (isErrorMessage(cellPos)) return;

					await renderWithAnchor(ptToPx$1(cellPos.x), get(anchorY));

					const newData = buildSelectedDataFromCellRange(row, nextCell.x, row, nextCell.x, 'none');

					selectedData(newData);
					$$props.onSelectedDataChange?.(newData);

					return;
				}

			case 'right':
				{
					// Check if next col is visible
					const [_startIdx, endIdx] = findVisibleColIdxRange(get(anchorX), size.width, get(grid));

					const idx = get(grid).columns.findIndex((v) => v.idx === col);

					if (idx >= 0 && idx + 1 <= endIdx) {
						// Cell to right is visible, just select it
						const newData = buildSelectedDataFromCellRange(row, get(grid).columns[idx + 1].idx, row, get(grid).columns[idx + 1].idx, 'none');

						selectedData(newData);
						$$props.onSelectedDataChange?.(newData);

						return;
					}

					// Need to scroll - get position of cell to right
					const nextCell = await workbook.getNextVisibleCell({ sheetIdx, rowIdx: row, colIdx: col, direction: 'right' });

					if (isErrorMessage(nextCell)) return;

					const cellPos = await workbook.getCellPosition({ sheetIdx, row: nextCell.y, col: nextCell.x });

					if (isErrorMessage(cellPos)) return;

					await renderWithAnchor(ptToPx$1(cellPos.x) - size.width + 100, get(anchorY));

					const newData = buildSelectedDataFromCellRange(row, nextCell.x, row, nextCell.x, 'none');

					selectedData(newData);
					$$props.onSelectedDataChange?.(newData);

					return;
				}
		}
	}

	// ========================================================================
	// Public API
	// ========================================================================
	async function loadWorkbook(data, name) {
		if (!get(dataService)) return;

		await get(dataService).loadWorkbook(data, name);
		await render();
		await updateDocumentDimensions();
	}

	function setActiveSheet(idx) {
		if (!get(dataService)) return;

		activeSheet(idx);
		get(dataService).setCurrentSheetIdx(idx);
		render();
	}

	function getDataService() {
		return get(dataService);
	}

	/** Scroll to make a specific cell visible */
	async function goToCell(row, col) {
		await scrollToCell(row, col);

		// Also select the cell
		const data = buildSelectedDataFromCellRange(row, col, row, col, 'none');

		selectedData(data);
		$$props.onSelectedDataChange?.(data);
	}

	/** Select a cell or range and scroll to it */
	async function selectRange(startRow, startCol, endRow, endCol) {
		const data = buildSelectedDataFromCellRange(startRow, startCol, endRow, endCol, 'none');

		selectedData(data);
		$$props.onSelectedDataChange?.(data);
		await scrollToCell(startRow, startCol);
	}

	var $$exports = {
		loadWorkbook,
		setActiveSheet,
		getDataService,
		goToCell,
		selectRange
	};

	var div = root();
	var div_1 = child(div);
	let classes;
	var div_2 = child(div_1);
	var div_3 = child(div_2);
	var node = sibling(div_3, 2);

	ColumnHeaders(node, {
		get grid() {
			return get(grid);
		},

		get selectedColumnRange() {
			return get(selectedColumnRange);
		},

		get leftTopWidth() {
			return get(LeftTop).width;
		},

		get leftTopHeight() {
			return get(LeftTop).height;
		},

		onSelectColumn: (col) => {
			const data = buildSelectedDataFromLines(col, col, 'col', 'none');

			selectedData(data);
			$$props.onSelectedDataChange?.(data);
		},

		onSelectColumnRange: (startCol, endCol) => {
			const data = buildSelectedDataFromLines(startCol, endCol, 'col', 'none');

			selectedData(data);
			$$props.onSelectedDataChange?.(data);
		},
		onContextMenu: onColumnContextMenu,
		onResizeCol
	});

	var node_1 = sibling(node, 2);

	RowHeaders(node_1, {
		get grid() {
			return get(grid);
		},

		get selectedRowRange() {
			return get(selectedRowRange);
		},

		get leftTopWidth() {
			return get(LeftTop).width;
		},

		get leftTopHeight() {
			return get(LeftTop).height;
		},

		onSelectRow: (row) => {
			const data = buildSelectedDataFromLines(row, row, 'row', 'none');

			selectedData(data);
			$$props.onSelectedDataChange?.(data);
		},

		onSelectRowRange: (startRow, endRow) => {
			const data = buildSelectedDataFromLines(startRow, endRow, 'row', 'none');

			selectedData(data);
			$$props.onSelectedDataChange?.(data);
		},
		onContextMenu: onRowContextMenu,
		onResizeRow
	});

	var canvas = sibling(node_1, 2);

	canvas.__mousedown = onMouseDown;
	canvas.__contextmenu = onContextMenu;
	canvas.__keydown = onKeyDown;
	bind_this(canvas, ($$value) => set(canvasEl, $$value), () => get(canvasEl));

	var node_2 = sibling(canvas, 2);

	{
		var consequent = ($$anchor) => {
			Selector($$anchor, spread_props(() => get(selector)));
		};

		if_block(node_2, ($$render) => {
			if (get(selector)) $$render(consequent);
		});
	}

	var node_3 = sibling(node_2, 2);

	{
		var consequent_1 = ($$anchor) => {
			var fragment_1 = root_2();
			var div_4 = first_child(fragment_1);
			var node_4 = child(div_4);

			Scrollbar(node_4, {
				orientation: 'y',
				get totalLength() {
					return get(documentHeight);
				},

				get position() {
					return get(anchorY);
				},

				get visibleLength() {
					return get(visibleHeight);
				},

				onChange: (pos) => {
					set(scrollbarRendering, true);
					renderWithAnchor(get(anchorX), pos);
				},

				onBlur: () => {
					set(scrollbarRendering, false);
				}
			});

			var div_5 = sibling(div_4, 2);
			var node_5 = child(div_5);

			Scrollbar(node_5, {
				orientation: 'x',
				get totalLength() {
					return get(documentWidth);
				},

				get position() {
					return get(anchorX);
				},

				get visibleLength() {
					return get(visibleWidth);
				},

				onChange: (pos) => {
					set(scrollbarRendering, true);
					renderWithAnchor(pos, get(anchorY));
				},

				onBlur: () => {
					set(scrollbarRendering, false);
				}
			});

			template_effect(() => {
				set_style(div_4, `width: ${get(cfg).scrollbarSize ?? ''}px; top: ${get(LeftTop).height ?? ''}px;`);
				set_style(div_5, `height: ${get(cfg).scrollbarSize ?? ''}px; left: ${get(LeftTop).width ?? ''}px;`);
			});

			append($$anchor, fragment_1);
		};

		if_block(node_3, ($$render) => {
			if (showScrollbars()) $$render(consequent_1);
		});
	}

	var node_6 = sibling(div_1, 2);

	ContextMenu(node_6, {
		get visible() {
			return get(contextMenuVisible);
		},

		get x() {
			return get(contextMenuX);
		},

		get y() {
			return get(contextMenuY);
		},

		get items() {
			return contextMenuItems();
		},

		get context() {
			return get(contextMenuContext);
		},
		onItemClick: handleContextMenuItemClick,
		onClose: closeContextMenu
	});

	var node_7 = sibling(node_6, 2);

	{
		var consequent_2 = ($$anchor) => {
			SheetTabs($$anchor, {
				get sheets() {
					return get(sheets);
				},

				get activeSheet() {
					return activeSheet();
				},

				onActiveSheetChange: (idx) => {
					activeSheet(idx);
					$$props.onActiveSheetChange?.(idx);
					get(dataService)?.setCurrentSheetIdx(idx);
					render();
					updateDocumentDimensions();
				},

				onTransaction: async (tx) => {
					if (!get(dataService)) return true;

					const result = await get(dataService).handleTransaction(tx);

					if (result) {
						// error
						$$props.onInvalidFormula?.();

						return true;
					}

					return false; // success
				}
			});
		};

		if_block(node_7, ($$render) => {
			if (showSheetTabs()) $$render(consequent_2);
		});
	}

	template_effect(() => {
		classes = set_class(div_1, 1, 'canvas-area svelte-rlol6m', null, classes, { 'with-tabs': showSheetTabs() });
		set_style(div_3, `width: ${get(LeftTop).width ?? ''}px; height: ${get(LeftTop).height ?? ''}px;`);
		set_attribute(canvas, 'id', CANVAS_ID);
		set_style(canvas, `left: ${get(LeftTop).width ?? ''}px; top: ${get(LeftTop).height ?? ''}px; width: calc(100% - ${get(LeftTop).width ?? ''}px - ${(showScrollbars() ? get(cfg).scrollbarSize : 0) ?? ''}px); height: calc(100% - ${get(LeftTop).height ?? ''}px - ${(showScrollbars() ? get(cfg).scrollbarSize : 0) ?? ''}px);`);
	});

	event('wheel', canvas, onWheel);
	append($$anchor, div);

	return pop($$exports);
}

delegate(['mousedown', 'contextmenu', 'keydown']);

class Engine {
  _dataService;
  _worker;
  _blockManager;
  _config;
  _ready = false;
  _currentSheetIdx = 0;
  _grid = null;
  _selectedData = { source: "none" };
  _sheets = [];
  // Mount state
  _mountedComponent = null;
  _mountContainer = null;
  // Event listeners
  _listeners = /* @__PURE__ */ new Map();
  constructor(config) {
    this._config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this._blockManager = new BlockManager();
    [
      "ready",
      "sheetChange",
      "cellChange",
      "selectionChange",
      "error",
      "gridChange",
      "activeSheetChange",
      "startEdit",
      "invalidFormula"
    ].forEach((type) => {
      this._listeners.set(type, /* @__PURE__ */ new Set());
    });
    this._worker = new WorkerWrapper();
    this._dataService = new DataService(this._worker);
    this._dataService.registerCellUpdatedCallback(() => {
      this._sheets = this._dataService.getCacheAllSheetInfo();
      this._emit("cellChange", void 0);
      this._emit("sheetChange", this._sheets);
    });
    this._dataService.registerSheetUpdatedCallback(() => {
      this._sheets = this._dataService.getCacheAllSheetInfo();
      this._emit("sheetChange", this._sheets);
    });
    this._dataService.getWorkbook().getAllSheetInfo().then((result) => {
      if (!isErrorMessage(result)) {
        this._sheets = result;
      }
      this._ready = true;
      this._emit("ready", void 0);
    });
  }
  // ========================================================================
  // Mount / Unmount (UI)
  // ========================================================================
  /**
   * Mount the spreadsheet UI to a container element.
   * @param container - The HTML element to mount the spreadsheet into
   * @param options - Mount options
   */
  mount(container, options = {}) {
    if (this._mountedComponent) {
      console.warn("Engine is already mounted. Call unmount() first.");
      return;
    }
    this._mountContainer = container;
    this._mountedComponent = mount(Spreadsheet, {
      target: container,
      props: {
        selectedData: this._selectedData,
        activeSheet: this._currentSheetIdx,
        cellLayouts: options.cellLayouts ?? [],
        config: this._config,
        showSheetTabs: options.showSheetTabs ?? true,
        showScrollbars: options.showScrollbars ?? true,
        contextMenuItems: options.contextMenuItems ?? [],
        getIsEditingFormula: options.getIsEditingFormula,
        onSelectedDataChange: (data) => {
          this._selectedData = data;
          this._emit("selectionChange", data);
        },
        onActiveSheetChange: (sheet) => {
          this._currentSheetIdx = sheet;
          this._emit("activeSheetChange", sheet);
        },
        onGridChange: (grid) => {
          this._grid = grid;
          this._emit("gridChange", grid);
        },
        onSheetsChange: (sheets) => {
          this._sheets = sheets;
          this._emit("sheetChange", sheets);
        },
        onContextMenuItemClick: (_item, _context) => {
        },
        onStartEdit: (row, col, initialText) => {
          this._emit("startEdit", { row, col, initialText });
        },
        onInvalidFormula: () => {
          this._emit("invalidFormula", void 0);
          options.onInvalidFormula?.();
        },
        // Pass data service for internal use
        dataService: this._dataService
      }
    });
  }
  /**
   * Unmount the spreadsheet UI.
   */
  unmount() {
    if (this._mountedComponent) {
      unmount(this._mountedComponent);
      this._mountedComponent = null;
      this._mountContainer = null;
    }
  }
  /**
   * Check if the UI is mounted.
   */
  isMounted() {
    return this._mountedComponent !== null;
  }
  /**
   * Get the mount container element.
   */
  getMountContainer() {
    return this._mountContainer;
  }
  // ========================================================================
  // Initialization (for headless mode without UI)
  // ========================================================================
  /**
   * Initialize offscreen canvas for headless rendering.
   * Only needed if you want to render without mounting UI.
   * @param canvas - The canvas element for offscreen rendering
   */
  async initOffscreen(canvas) {
    if ("transferControlToOffscreen" in canvas) {
      const offscreen = canvas.transferControlToOffscreen();
      await this._dataService.initOffscreen(offscreen);
    }
  }
  /**
   * Destroy the engine and release all resources.
   */
  destroy() {
    this.unmount();
    if (this._worker) {
      this._worker.terminate();
    }
    this._ready = false;
    this._listeners.forEach((set) => set.clear());
  }
  // ========================================================================
  // Event Handling
  // ========================================================================
  /**
   * Subscribe to an event.
   */
  on(type, callback) {
    this._listeners.get(type)?.add(callback);
  }
  /**
   * Unsubscribe from an event.
   */
  off(type, callback) {
    this._listeners.get(type)?.delete(callback);
  }
  _emit(type, data) {
    this._listeners.get(type)?.forEach((cb) => cb(data));
  }
  // ========================================================================
  // Core Accessors (use these to access the original logisheets-web API)
  // ========================================================================
  /**
   * Get the workbook client for all workbook operations.
   * This provides access to the original logisheets-web API.
   *
   * @example
   * ```javascript
   * const workbook = engine.getWorkbook();
   *
   * // Load file
   * await workbook.loadWorkbook({ content: buffer, name: 'file.xlsx' });
   *
   * // Get sheets
   * const sheets = await workbook.getAllSheetInfo();
   *
   * // Get cell
   * const cell = await workbook.getCell({ sheetIdx: 0, row: 0, col: 0 });
   *
   * // Execute transaction
   * await workbook.handleTransaction({ transaction: tx, temp: false });
   *
   * // Undo/Redo
   * await workbook.undo();
   * await workbook.redo();
   *
   * // Save
   * const result = await workbook.save({});
   * ```
   */
  getWorkbook() {
    return this._dataService.getWorkbook();
  }
  /**
   * Get the data service for rendering operations.
   * Use this for render(), resize(), and other display-related operations.
   */
  getDataService() {
    return this._dataService;
  }
  /**
   * Get the block manager for field/enum management.
   */
  getBlockManager() {
    return this._blockManager;
  }
  // ========================================================================
  // Convenience Methods (thin wrappers, use getWorkbook() for full API)
  // ========================================================================
  /**
   * Load a workbook from a file buffer.
   * Convenience wrapper for getWorkbook().loadWorkbook()
   */
  async loadFile(buffer, filename) {
    this._ensureReady();
    const result = await this._dataService.loadWorkbook(buffer, filename);
    if (isErrorMessage(result)) {
      this._emit("error", new Error(result.msg));
      return null;
    }
    this._grid = result;
    this._emit("gridChange", result);
    return result;
  }
  /**
   * Render the spreadsheet.
   * Note: When UI is mounted, rendering is handled automatically.
   */
  async render(anchorX = 0, anchorY = 0) {
    this._ensureReady();
    const sheetId = this._dataService.getCurrentSheetId();
    const result = await this._dataService.render(sheetId, anchorX, anchorY);
    if (isErrorMessage(result)) {
      this._emit("error", new Error(result.msg));
      return null;
    }
    this._grid = result;
    this._emit("gridChange", result);
    return result;
  }
  /**
   * Resize the canvas.
   * Note: When UI is mounted, resizing is handled automatically.
   */
  async resize(width, height) {
    this._ensureReady();
    const result = await this._dataService.resize(
      width,
      height,
      window.devicePixelRatio
    );
    if (isErrorMessage(result)) {
      this._emit("error", new Error(result.msg));
      return null;
    }
    this._grid = result;
    this._emit("gridChange", result);
    return result;
  }
  // ========================================================================
  // State Accessors
  // ========================================================================
  /**
   * Get the current grid data.
   */
  getGrid() {
    return this._grid;
  }
  /**
   * Get current selection.
   */
  getSelection() {
    return this._selectedData;
  }
  /**
   * Set current selection.
   */
  setSelection(selection) {
    this._selectedData = selection;
    this._emit("selectionChange", selection);
  }
  /**
   * Get current sheet index.
   */
  getCurrentSheetIndex() {
    return this._currentSheetIdx;
  }
  /**
   * Set current sheet by index.
   */
  setCurrentSheetIndex(index) {
    this._ensureReady();
    this._currentSheetIdx = index;
    const mounted = this._mountedComponent;
    if (mounted && typeof mounted.setActiveSheet === "function") {
      mounted.setActiveSheet(index);
    } else {
      this._dataService.setCurrentSheetIdx(index);
    }
    this._emit("activeSheetChange", index);
  }
  /**
   * Get cached sheet info.
   */
  getSheets() {
    return this._sheets;
  }
  /**
   * Get engine configuration.
   */
  getConfig() {
    return this._config;
  }
  /**
   * Check if engine is ready.
   */
  isReady() {
    return this._ready;
  }
  // ========================================================================
  // License Management
  // ========================================================================
  /**
   * Set the license key (API key) to activate the engine.
   * If valid, the watermark will be removed.
   *
   * License validation happens INSIDE the worker - cannot be bypassed.
   *
   * @param apiKey - The license key provided to customers
   * @returns License validation status
   *
   * @example
   * ```javascript
   * const status = await engine.setLicense('eyJkb21haW4i...');
   * if (status.valid) {
   *   console.log('License activated!');
   * } else {
   *   console.log('License invalid:', status.reason);
   * }
   * ```
   */
  async setLicense(apiKey) {
    const result = await this._dataService.setLicense(apiKey);
    if (isErrorMessage(result)) {
      return { valid: false, reason: result.msg };
    }
    if (result.valid && this._grid) {
      await this.render();
    }
    return result;
  }
  /**
   * Clear the current license and show watermark again.
   */
  clearLicense() {
    this._dataService.clearLicense();
  }
  // ========================================================================
  // Private
  // ========================================================================
  _ensureReady() {
    if (!this._ready) {
      throw new Error("Engine is not ready. Wait for the 'ready' event.");
    }
  }
}

class WorkbookWorkerService {
  constructor(_ctx) {
    this._ctx = _ctx;
  }
  _workbookImpl;
  // ========================================================================
  // Initialization
  // ========================================================================
  async init() {
    await initWasm();
    this._workbookImpl = new Workbook();
    this._workbookImpl.registerCellUpdatedCallback(() => {
      this._ctx.postMessage({ id: WorkerUpdate.Cell });
    });
    this._workbookImpl.registerSheetInfoUpdateCallback(() => {
      this._ctx.postMessage({ id: WorkerUpdate.Sheet });
    });
    this._workbookImpl.registerHeaderUpdatedCallback((sheetIdxes) => {
      this._ctx.postMessage({
        id: WorkerUpdate.HeaderUpdated,
        result: sheetIdxes
      });
    });
    this._ctx.postMessage({ id: WorkerUpdate.Ready });
  }
  get workbook() {
    if (!this._workbookImpl) throw Error("haven't been initialized");
    return this._workbookImpl;
  }
  getWorkbook() {
    return this.workbook;
  }
  // ========================================================================
  // Basic Operations
  // ========================================================================
  isReady() {
    return this._workbookImpl !== void 0;
  }
  loadWorkbook(params) {
    this._workbookImpl?.load(params.content, params.name);
    return;
  }
  save(params) {
    return this._workbookImpl.save(params.appData);
  }
  // ========================================================================
  // Sheet Operations
  // ========================================================================
  getAllSheetInfo() {
    return this.workbook.getAllSheetInfo();
  }
  getSheetDimension(sheetIdx) {
    const ws = this.getSheet(sheetIdx);
    return ws.getSheetDimension();
  }
  getSheetIdx(params) {
    return this.workbook.getSheetIdx(params.sheetId);
  }
  getSheetId(params) {
    return this.workbook.getSheetId(params.sheetIdx);
  }
  getSheetNameByIdx(idx) {
    return this.workbook.getSheetNameByIdx(idx);
  }
  getSheet(idx) {
    return this.workbook.getWorksheet(idx);
  }
  // ========================================================================
  // Cell Operations
  // ========================================================================
  getCell(params) {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getCellInfo(params.row, params.col);
  }
  getCells(params) {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getCellInfos(
      params.startRow,
      params.startCol,
      params.endRow,
      params.endCol
    );
  }
  getCellPosition(params) {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getCellPosition(params.row, params.col);
  }
  getCellId(params) {
    return this.workbook.getCellId(params);
  }
  getValue(params) {
    const ws = this._workbookImpl.getWorksheetById(params.sheetId);
    return ws.getValue(params.row, params.col);
  }
  getReproducibleCell(params) {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getReproducibleCell(params.row, params.col);
  }
  getReproducibleCells(params) {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getReproducibleCells(params.coordinates);
  }
  batchGetCellInfoById(ids) {
    return this.workbook.batchGetCellInfoById(ids);
  }
  batchGetCellCoordinateWithSheetById(ids) {
    return this.workbook.batchGetCellCoordinateWithSheetById(ids);
  }
  getNextVisibleCell(args) {
    const ws = this.workbook.getWorksheet(args.sheetIdx);
    switch (args.direction) {
      case "up":
        return ws.getNextUpwardVisibleCell(args.rowIdx, args.colIdx);
      case "down":
        return ws.getNextDownwardVisibleCell(args.rowIdx, args.colIdx);
      case "left":
        return ws.getNextLeftwardVisibleCell(args.rowIdx, args.colIdx);
      case "right":
        return ws.getNextRightwardVisibleCell(args.rowIdx, args.colIdx);
    }
  }
  // ========================================================================
  // Display Window Operations
  // ========================================================================
  getDisplayWindow(params) {
    const ws = this.workbook.getWorksheet(params.sheetIdx);
    return ws.getDisplayWindowWithStartPoint(
      params.startX,
      params.startY,
      params.height,
      params.width
    );
  }
  getMergedCells(params) {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getMergedCells(
      params.startRow,
      params.startCol,
      params.endRow,
      params.endCol
    );
  }
  // ========================================================================
  // Block Operations
  // ========================================================================
  getBlockInfo(params) {
    const ws = this.workbook.getWorksheetById(params.sheetId);
    return ws.getBlockInfo(params.blockId);
  }
  getBlockValues(params) {
    return this.workbook.getBlockValues(params);
  }
  getAvailableBlockId(params) {
    return this.workbook.getAvailableBlockId(params);
  }
  getDiyCellIdWithBlockId(params) {
    const ws = this.workbook.getWorksheetById(params.sheetId);
    return ws.getDiyCellIdWithBlockId(params.blockId, params.row, params.col);
  }
  lookupAppendixUpward(params) {
    const ws = this.workbook.getWorksheetById(params.sheetId);
    return ws.lookupAppendixUpward(
      params.blockId,
      params.row,
      params.col,
      params.craftId,
      params.tag
    );
  }
  getAllBlockFields() {
    return this.workbook.getAllBlockFields();
  }
  // ========================================================================
  // Shadow Cell Operations
  // ========================================================================
  getShadowCellId(params) {
    return this.workbook.getShadowCellId(params);
  }
  getShadowCellIds(params) {
    return this.workbook.getShadowCellIds(params);
  }
  getShadowInfoById(params) {
    return this.workbook.getShadowInfoById(params.shadowId);
  }
  // ========================================================================
  // Transaction Operations
  // ========================================================================
  handleTransaction(params) {
    const result = this.workbook.execTransaction(params.transaction);
    result.valueChanged.forEach((cellId) => {
      this._ctx.postMessage({
        id: WorkerUpdate.CellValueChanged,
        result: cellId
      });
    });
    result.cellRemoved.forEach((cellId) => {
      this._ctx.postMessage({
        id: WorkerUpdate.CellRemoved,
        result: cellId
      });
    });
    return;
  }
  handleTransactionWithoutEvents(params) {
    return this.workbook.execTransaction(params.transaction);
  }
  undo() {
    this.workbook.undo();
  }
  redo() {
    this.workbook.redo();
  }
  // ========================================================================
  // Status Operations
  // ========================================================================
  commitTempStatus() {
    this.workbook.commitTempStatus();
    this._ctx.postMessage({ id: WorkerUpdate.CellAndSheet });
  }
  cleanupTempStatus() {
    this.workbook.cleanupTempStatus();
    this._ctx.postMessage({ id: WorkerUpdate.CellAndSheet });
  }
  toggleStatus(useTemp) {
    return this.workbook.toggleStatus(useTemp);
  }
  // ========================================================================
  // Formula Operations
  // ========================================================================
  getDisplayUnitsOfFormula(f) {
    return this.workbook.getDisplayUnitsOfFormula(f);
  }
  calcCondition(params) {
    return this.workbook.calcCondition(params.sheetIdx, params.condition);
  }
  checkFormula(params) {
    return this.workbook.checkFormula(params.formula);
  }
  // ========================================================================
  // App Data Operations
  // ========================================================================
  getAppData() {
    return this._workbookImpl.getAppData();
  }
  // ========================================================================
  // Request Handler
  // ========================================================================
  async handleRequest(request) {
    const { m, args, id } = request;
    if (!this._workbookImpl) {
      this._ctx.postMessage({
        error: "WorkbookService not initialized",
        id
      });
      return;
    }
    if (id === WorkerUpdate.Ready || id === WorkerUpdate.Cell || id === WorkerUpdate.CellAndSheet || id === WorkerUpdate.Sheet) {
      return;
    }
    let result;
    try {
      switch (m) {
        case MethodName.IsReady:
          result = this.isReady();
          break;
        case MethodName.HandleTransaction:
          result = this.handleTransaction(args);
          break;
        case MethodName.HandleTransactionWithoutEvents:
          result = this.handleTransactionWithoutEvents(args);
          break;
        case MethodName.GetAllSheetInfo:
          result = this.getAllSheetInfo();
          break;
        case MethodName.Undo:
          result = this.undo();
          break;
        case MethodName.Redo:
          result = this.redo();
          break;
        case MethodName.GetDisplayWindow:
          result = this.getDisplayWindow(args);
          break;
        case MethodName.GetCellPosition:
          result = this.getCellPosition(args);
          break;
        case MethodName.GetCell:
          result = this.getCell(args);
          break;
        case MethodName.GetCells:
          result = this.getCells(args);
          break;
        case MethodName.LoadWorkbook:
          result = this.loadWorkbook(args);
          break;
        case MethodName.GetSheetDimension:
          result = this.getSheetDimension(args);
          break;
        case MethodName.GetMergedCells:
          result = this.getMergedCells(args);
          break;
        case MethodName.CalcCondition:
          result = this.calcCondition(args);
          break;
        case MethodName.CheckFormula:
          result = this.checkFormula(args);
          break;
        case MethodName.GetBlockValues:
          result = this.getBlockValues(args);
          break;
        case MethodName.GetAvailableBlockId:
          result = this.getAvailableBlockId(args);
          break;
        case MethodName.GetSheetId:
          result = this.getSheetId(args);
          break;
        case MethodName.GetSheetIdx:
          result = this.getSheetIdx(args);
          break;
        case MethodName.GetBlockInfo:
          result = this.getBlockInfo(args);
          break;
        case MethodName.GetReproducibleCell:
          result = this.getReproducibleCell(args);
          break;
        case MethodName.GetReproducibleCells:
          result = this.getReproducibleCells(args);
          break;
        case MethodName.LookupAppendixUpward:
          result = this.lookupAppendixUpward(args);
          break;
        case MethodName.GetCellValue:
          result = this.getValue(args);
          break;
        case MethodName.GetShadowCellId:
          result = this.getShadowCellId(args);
          break;
        case MethodName.GetShadowCellIds:
          result = this.getShadowCellIds(args);
          break;
        case MethodName.GetShadowInfoById:
          result = this.getShadowInfoById(args);
          break;
        case MethodName.GetCellId:
          result = this.getCellId(args);
          break;
        case MethodName.GetDisplayUnitsOfFormula:
          result = this.getDisplayUnitsOfFormula(args);
          break;
        case MethodName.GetNextVisibleCell:
          result = this.getNextVisibleCell(args);
          break;
        case MethodName.Save:
          result = this.save(args);
          break;
        case MethodName.GetAllBlockFields:
          result = this.getAllBlockFields();
          break;
        case MethodName.GetAppData:
          result = this.getAppData();
          break;
        case MethodName.BatchGetCellInfoById:
          result = this.batchGetCellInfoById(args);
          break;
        case MethodName.ToggleStatus:
          result = this.toggleStatus(args);
          break;
        case MethodName.CommitTempStatus:
          result = this.commitTempStatus();
          break;
        case MethodName.CleanupTempStatus:
          result = this.cleanupTempStatus();
          break;
        case MethodName.GetSheetNameByIdx:
          result = this.getSheetNameByIdx(args);
          break;
        case MethodName.BatchGetCellCoordinateWithSheetById:
          result = this.batchGetCellCoordinateWithSheetById(args);
          break;
        case MethodName.GetDiyCellIdWithBlockId:
          result = this.getDiyCellIdWithBlockId(args);
          break;
        default:
          throw new Error(`Unknown method: ${m}`);
      }
    } catch (error) {
      this._ctx.postMessage({ error: String(error), id });
      return;
    }
    this._ctx.postMessage({ result, id });
  }
}

const DEFAULT_PPI = 96;
const PPI = DEFAULT_PPI;
function ptToPx(pt) {
  return Math.round(pt * PPI / 72 * 100) / 100;
}
function pxToPt(px) {
  return Math.round(px * 72 / PPI * 100) / 100;
}
function widthToPx(w) {
  return w * 7;
}
function pxToWidth(px) {
  return px / 7;
}
function shallowCopy(curr, target) {
  if (typeof curr !== "object" || typeof target !== "object") return;
  for (const key in curr) {
    if (Object.prototype.hasOwnProperty.call(curr, key)) {
      target[key] = curr[key];
    }
  }
}
class Range {
  static fromMergeCell(mergeCell) {
    return new Range().setEndCol(mergeCell.endCol).setStartCol(mergeCell.startCol).setEndRow(mergeCell.endRow).setStartRow(mergeCell.startRow);
  }
  get width() {
    return this._endCol - this._startCol;
  }
  get height() {
    return this._endRow - this._startRow;
  }
  get startRow() {
    return this._startRow;
  }
  get startCol() {
    return this._startCol;
  }
  get endRow() {
    return this._endRow;
  }
  get endCol() {
    return this._endCol;
  }
  setStartRow(startRow) {
    this._startRow = startRow;
    return this;
  }
  setStartCol(startCol) {
    this._startCol = startCol;
    return this;
  }
  setEndRow(endRow) {
    this._endRow = endRow;
    return this;
  }
  setEndCol(endCol) {
    this._endCol = endCol;
    return this;
  }
  reset() {
    this.setEndCol(0).setEndRow(0).setStartCol(0).setStartRow(0);
  }
  cover(range) {
    return this._startRow <= range._startRow && this._startCol <= range._startCol && this._endRow >= range._endRow && this._endCol >= range._endCol;
  }
  equals(other) {
    return other._startRow === this._startRow && other._startCol === this._startCol && other._endCol === this._endCol && other._endRow === this._endRow;
  }
  _startRow = 0;
  _startCol = 0;
  _endRow = 0;
  _endCol = 0;
}
const ALPHA = 255;
class StandardColor {
  static fromRgb(rgb) {
    const color = new StandardColor();
    if (rgb === "") return color;
    color._red = parseInt(rgb.slice(0, 2), 16);
    color._green = parseInt(rgb.slice(2, 4), 16);
    color._blue = parseInt(rgb.slice(4, 6), 16);
    return color;
  }
  static fromCtColor(color) {
    if (color === void 0) {
      return new StandardColor();
    }
    const result = new StandardColor();
    result._red = color.red;
    result._green = color.green;
    result._blue = color.blue;
    if (color.alpha) result._alpha = color.alpha;
    return result;
  }
  static from(r, g, b, a = 1) {
    const color = new StandardColor();
    color._red = r;
    color._green = g;
    color._blue = b;
    color._alpha = ALPHA * a;
    return color;
  }
  css() {
    const alpha = this._alpha / ALPHA;
    if (!this._valid()) return "transparent";
    return `rgba(${this._red}, ${this._green}, ${this._blue}, ${alpha})`;
  }
  rgb() {
    if (!this._valid()) return "";
    const transfer = (num) => num.toString(16).padStart(2, "0");
    const r = transfer(this._red ?? 0);
    const g = transfer(this._green ?? 0);
    const b = transfer(this._blue ?? 0);
    return `${r}${g}${b}`;
  }
  setAlpha(alpha) {
    this._alpha = alpha;
  }
  _red;
  _green;
  _blue;
  _alpha = ALPHA;
  _valid() {
    return this._red !== void 0 && this._green !== void 0 && this._blue !== void 0;
  }
}
const DEFAULT_FONT_SIZE = 10;
class StandardFont {
  static from(font) {
    const f = new StandardFont();
    if (font.color === null) f.standardColor = StandardColor.from(0, 0, 0);
    else f.standardColor = StandardColor.fromCtColor(font.color);
    shallowCopy(font, f);
    f.fontSizeUnit = "pt";
    if (font.sz === 0) {
      f.fontSizeUnit = "px";
      f.sz = DEFAULT_FONT_SIZE;
    }
    return f;
  }
  get size() {
    return this.sz;
  }
  name = { val: "Arial" };
  underline;
  fontSizeUnit = "px";
  lineHeight = "100%";
  standardColor = StandardColor.from(0, 0, 0, 1);
  bold = false;
  sz = 10;
  condense = false;
  italic = false;
  outline = false;
  shadow = false;
  strike = false;
  extend = false;
  toCssFont() {
    const fontStyle = this.italic ? "italic" : "normal";
    const fontVariant = "normal";
    const fontWeight = this.bold ? "bold" : "normal";
    const fontSize = `${this.size}${this.fontSizeUnit}`;
    const fontFamily = this.name;
    const lineHeight = this.lineHeight;
    return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily.val}`;
  }
}
class StandardStyle {
  protection;
  border;
  font;
  fill;
  alignment;
  formatter = "";
  from(style) {
    shallowCopy(style, this);
    return this;
  }
  getFont() {
    if (!this.font) return new StandardFont();
    return StandardFont.from(this.font);
  }
}
class StandardValue {
  cellValueOneof;
  get value() {
    if (this.cellValueOneof?.$case === "str") return this.cellValueOneof.str;
    else if (this.cellValueOneof?.$case === "bool")
      return this.cellValueOneof.bool;
    else if (this.cellValueOneof?.$case === "error")
      return this.cellValueOneof.error;
    else if (this.cellValueOneof?.$case === "number")
      return this.cellValueOneof.number;
    else return "";
  }
  get valueStr() {
    return this.value.toString();
  }
  from(value) {
    if (value === "empty") {
      this.cellValueOneof = void 0;
      return this;
    }
    if (value.type === "str")
      this.cellValueOneof = { $case: "str", str: value.value };
    else if (value.type === "bool")
      this.cellValueOneof = { $case: "bool", bool: value.value };
    else if (value.type === "number")
      this.cellValueOneof = {
        $case: "number",
        number: value.value
      };
    else if (value.type === "error")
      this.cellValueOneof = { $case: "error", error: value.value };
    return this;
  }
}
class StandardCell {
  style;
  value;
  formula = "";
  diyCellId;
  blockId;
  setStyle(style) {
    this.style = style;
  }
  getFormattedText() {
    const num = this.getNumber();
    if (num !== void 0) return String(num);
    return this.getText();
  }
  getText() {
    return this.value?.valueStr ?? "";
  }
  getNumber() {
    if (this.value?.cellValueOneof?.$case === "number")
      return this.value?.cellValueOneof.number;
    return void 0;
  }
}
const DEFAULT_CELL_HEIGHT = 25;
class StandardRowInfo {
  constructor(idx) {
    this.idx = idx;
  }
  height = DEFAULT_CELL_HEIGHT;
  hidden = false;
  get pt() {
    return this.height;
  }
  get px() {
    return ptToPx(this.height);
  }
  static from(rowInfo) {
    const rInfo = new StandardRowInfo(rowInfo.idx);
    shallowCopy(rowInfo, rInfo);
    return rInfo;
  }
}
const DEFAULT_CELL_WIDTH = 6;
class StandardColInfo {
  constructor(idx) {
    this.idx = idx;
  }
  hidden = false;
  width = DEFAULT_CELL_WIDTH;
  get px() {
    return widthToPx(this.width);
  }
  get pt() {
    return this.width;
  }
  static from(colInfo) {
    const cInfo = new StandardColInfo(colInfo.idx);
    shallowCopy(colInfo, cInfo);
    return cInfo;
  }
}

class RenderCell {
  get width() {
    return this.position.width;
  }
  get height() {
    return this.position.height;
  }
  setCoordinate(coordinate) {
    this.coordinate = coordinate;
    return this;
  }
  setPosition(position) {
    this.position = position;
    return this;
  }
  setInfo(info, getStandardCell, getStandardValue, getStandardStyle) {
    const c = getStandardCell();
    if (info.style) {
      const style = getStandardStyle();
      style.from(info.style);
      c.setStyle(style);
    }
    if (info.value) {
      const value = getStandardValue();
      value.from(info.value);
      c.value = value;
    }
    if (info.formula !== void 0) c.formula = info.formula;
    if (info.diyCellId !== void 0) c.diyCellId = info.diyCellId;
    if (info.blockId !== void 0) c.blockId = info.blockId;
    this.info = c;
    return this;
  }
  setStandardCell(info) {
    this.info = info;
    return this;
  }
  setSkipRender(skip) {
    this.skipRender = skip;
    return this;
  }
  reset() {
    this.hidden = false;
    this.coordinate.reset();
    this.position.reset();
    this.info = void 0;
  }
  hidden = false;
  /** start/end row/col index */
  coordinate = new Range();
  /** start/end row/col pixel distance (position in the whole sheet) */
  position = new Range();
  info;
  skipRender = false;
  cover(cell) {
    return this.coordinate.cover(cell.coordinate);
  }
  equals(cell) {
    return cell.position.equals(this.position);
  }
}

class CellView {
  constructor(data) {
    this.data = data;
  }
  get fromRow() {
    let min = Infinity;
    for (const d of this.data) {
      if (d.rows.length) {
        min = Math.min(min, d.rows[0].coordinate.startRow);
      }
    }
    return min;
  }
  get toRow() {
    let max = -Infinity;
    for (const d of this.data) {
      if (d.rows.length) {
        max = Math.max(max, d.rows[d.rows.length - 1].coordinate.endRow);
      }
    }
    return max;
  }
  get fromCol() {
    let min = Infinity;
    for (const d of this.data) {
      if (d.cols.length) {
        min = Math.min(min, d.cols[0].coordinate.startCol);
      }
    }
    return min;
  }
  get toCol() {
    let max = -Infinity;
    for (const d of this.data) {
      if (d.cols.length) {
        max = Math.max(max, d.cols[d.cols.length - 1].coordinate.endCol);
      }
    }
    return max;
  }
  get rows() {
    let curr = -1;
    return this.data.flatMap((d) => d.rows).sort((a, b) => a.coordinate.startRow - b.coordinate.startRow).filter((r) => {
      if (r.position.startRow > curr) {
        curr = r.position.startRow;
        return true;
      }
      return false;
    });
  }
  get cols() {
    let curr = -1;
    return this.data.flatMap((d) => d.cols).sort((a, b) => a.coordinate.startCol - b.coordinate.startCol).filter((r) => {
      if (r.position.startCol > curr) {
        curr = r.position.startCol;
        return true;
      }
      return false;
    });
  }
  get cells() {
    let currRow = -1;
    let currCol = -1;
    return this.data.flatMap((d) => d.cells).filter((c) => {
      const col = c.position.startCol;
      const row = c.position.startRow;
      if (col <= currCol && row <= currRow) {
        return false;
      }
      currCol = col;
      currRow = row;
      return true;
    });
  }
  get mergeCells() {
    return this.data.flatMap((d) => d.mergeCells);
  }
  get blocks() {
    const set = /* @__PURE__ */ new Set();
    const result = [];
    this.data.forEach((d) => {
      if (!d.blocks.length) {
        return;
      }
      for (const block of d.blocks) {
        if (!set.has(block.info.blockId)) {
          set.add(block.info.blockId);
          result.push(block);
        }
      }
    });
    return result;
  }
}
class CellViewData {
  constructor(rows, cols, cells, mergeCells, comments, blocks) {
    this.rows = rows;
    this.cols = cols;
    this.cells = cells;
    this.mergeCells = mergeCells;
    this.comments = comments;
    this.blocks = blocks;
    if (rows.length === 0) {
      throw Error("rows should not be empty");
    }
    if (cols.length === 0) {
      throw Error("cols should not be empty");
    }
    if (cells.length === 0) {
      throw Error("cells should not be empty");
    }
    this.fromRow = rows[0].coordinate.startRow;
    this.toRow = rows[rows.length - 1].coordinate.endRow;
    this.fromCol = cols[0].coordinate.startCol;
    this.toCol = cols[cols.length - 1].coordinate.endCol;
  }
  fromRow = 0;
  toRow = 0;
  fromCol = 0;
  toCol = 0;
}
class ViewManager {
  constructor(_workbook, _sheetIdx, _pool) {
    this._workbook = _workbook;
    this._sheetIdx = _sheetIdx;
    this._pool = _pool;
  }
  dataChunks = [];
  getViewResponse(startX, startY, height, width) {
    const x = Math.max(0, startX);
    const y = Math.max(0, startY);
    const type = 2 /* New */;
    const w = this._workbook.getDisplayWindow({
      sheetIdx: this._sheetIdx,
      startX: pxToWidth(x),
      startY: pxToPt(y),
      height: pxToPt(height),
      width: pxToWidth(width)
    });
    if (isErrorMessage(w)) return w;
    const data = parseDisplayWindow(
      w,
      this._pool.getRenderCell.bind(this._pool),
      this._pool.getRange.bind(this._pool),
      this._pool.getStandardCell.bind(this._pool),
      this._pool.getStandardValue.bind(this._pool),
      this._pool.getStandardStyle.bind(this._pool)
    );
    this.dataChunks = [data];
    this.dataChunks.sort((a, b) => {
      return a.fromRow < b.fromRow || a.fromCol < b.fromCol ? -1 : 1;
    });
    let anchorY = data.rows[0].position.startRow;
    for (const r of data.rows) {
      if (r.position.startRow > y) break;
      anchorY = r.position.startRow;
    }
    let anchorX = data.cols[0].position.startCol;
    for (const c of data.cols) {
      if (c.position.startCol > x) break;
      anchorX = c.position.startCol;
    }
    return {
      type,
      data: new CellView(this.dataChunks),
      request: { startX, startY, height, width },
      anchorX,
      anchorY
    };
  }
}
function locate(fromRow, fromCol, row, col, colCount) {
  return (row - fromRow) * colCount + (col - fromCol);
}
function parseDisplayWindow(window, getRenderCell, getRange, getStandardCell, getStandardValue, getStandardStyle) {
  const xStart = widthToPx(window.startX);
  const yStart = ptToPx(window.startY);
  let x = xStart;
  const cols = window.window.cols.map((c) => {
    const colInfo = StandardColInfo.from(c);
    const renderCol = getRenderCell().setCoordinate(getRange().setStartCol(colInfo.idx).setEndCol(colInfo.idx)).setPosition(
      getRange().setStartCol(x).setEndCol(x + colInfo.px).setStartRow(0).setEndRow(0)
    );
    x += colInfo.px;
    return renderCol;
  });
  let y = yStart;
  const rows = window.window.rows.map((r) => {
    const rowInfo = StandardRowInfo.from(r);
    const renderRow = getRenderCell().setCoordinate(getRange().setStartRow(rowInfo.idx).setEndRow(rowInfo.idx)).setPosition(
      getRange().setStartRow(y).setEndRow(y + rowInfo.px).setStartCol(0).setEndCol(0)
    );
    y += rowInfo.px;
    return renderRow;
  });
  const skipRenderCells = /* @__PURE__ */ new Set();
  window.window.blocks.forEach((b) => {
    const rowStart = b.info.rowStart;
    const colStart = b.info.colStart;
    const schema = b.info.schema;
    const schemaType = schema?.schemaType;
    const renderInfoById = new Map(
      b.info.fieldRenders.map((e) => [e.renderId, e])
    );
    for (let r = rowStart; r < rowStart + b.info.rowCnt; r += 1) {
      for (let c = colStart; c < colStart + b.info.colCnt; c += 1) {
        const colIdx = c - colStart;
        if (!schema) continue;
        if (schemaType !== "row") continue;
        const fieldEntry = schema.fields[colIdx];
        if (!fieldEntry) continue;
        const renderInfo = renderInfoById.get(fieldEntry.renderId);
        if (!renderInfo) continue;
        if (renderInfo.diyRender) {
          skipRenderCells.add(`${r}-${c}`);
        }
      }
    }
  });
  window.window.mergeCells.forEach((m) => {
    for (let r = m.startRow; r <= m.endRow; r += 1) {
      for (let c = m.startCol; c <= m.endCol; c += 1) {
        if (r === m.startRow && c === m.startCol) {
          skipRenderCells.add(`${r}-${c}`);
        }
      }
    }
  });
  const cells = [];
  let idx = 0;
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < cols.length; c += 1) {
      let skip = false;
      if (skipRenderCells.has(`${r}-${c}`)) {
        skip = true;
      }
      const row = rows[r];
      const col = cols[c];
      const corrdinate = getRange().setStartRow(row.coordinate.startRow).setEndRow(row.coordinate.endRow).setStartCol(col.coordinate.startCol).setEndCol(col.coordinate.endCol);
      const position = getRange().setStartRow(row.position.startRow).setEndRow(row.position.endRow).setStartCol(col.position.startCol).setEndCol(col.position.endCol);
      const renderCell = getRenderCell().setPosition(position).setCoordinate(corrdinate).setSkipRender(skip).setInfo(
        window.window.cells[idx],
        getStandardCell,
        getStandardValue,
        getStandardStyle
      );
      cells.push(renderCell);
      idx += 1;
    }
  }
  const mergeCells = window.window.mergeCells.map((m) => {
    const fromRow = rows[0].coordinate.startRow;
    const toRow = rows[rows.length - 1].coordinate.endRow;
    const fromCol = cols[0].coordinate.startCol;
    const toCol = cols[cols.length - 1].coordinate.endCol;
    const startRow = Math.min(Math.max(fromRow, m.startRow), toRow);
    const startCol = Math.min(Math.max(fromCol, m.startCol), toCol);
    const masterIdx = locate(fromRow, fromCol, startRow, startCol, cols.length);
    const masterCell = cells[masterIdx];
    const endRow = Math.min(Math.max(fromRow, m.endRow), toRow);
    const endCol = Math.min(Math.max(fromCol, m.endCol), toCol);
    const endIdx = locate(fromRow, fromCol, endRow, endCol, cols.length);
    const endCell = cells[endIdx];
    const coordinate = getRange().setStartRow(masterCell.coordinate.startRow).setStartCol(masterCell.coordinate.startCol).setEndRow(endCell.coordinate.endRow).setEndCol(endCell.coordinate.endCol);
    const position = getRange().setStartRow(masterCell.position.startRow).setStartCol(masterCell.position.startCol).setEndRow(endCell.position.endRow).setEndCol(endCell.position.endCol);
    const renderCell = getRenderCell().setPosition(position).setCoordinate(coordinate).setStandardCell(masterCell.info);
    return renderCell;
  });
  return new CellViewData(
    rows,
    cols,
    cells,
    mergeCells,
    window.window.comments,
    window.window.blocks
  );
}

const SETTINGS = {
  grid: {
    showHorizontal: true,
    showVertical: true
  }
};
function initBorderSegment() {
  return {
    pr: void 0,
    from: 0,
    to: 0,
    start: 0,
    coordinateX: 0,
    coordinateY: 0
  };
}
function getDefaultBorder(horizontal) {
  if (horizontal && SETTINGS.grid.showHorizontal) {
    return {
      color: { red: 224, green: 224, blue: 224 },
      style: "thin"
    };
  }
  if (!horizontal && SETTINGS.grid.showVertical) {
    return {
      color: { red: 224, green: 224, blue: 224 },
      style: "thin"
    };
  }
  return {
    color: void 0,
    style: "none"
  };
}
function isSameBorder(a, b) {
  return a.style === b.style && a.color?.red === b.color?.red && a.color?.green === b.color?.green && a.color?.blue === b.color?.blue;
}
class BorderHelper {
  constructor(_data) {
    this._data = _data;
    const fromRow = this._data.fromRow;
    const toRow = this._data.toRow;
    const fromCol = this._data.fromCol;
    const toCol = this._data.toCol;
    this._rowBorderStore = Array.from(
      { length: toRow - fromRow + 2 },
      () => Array.from({ length: toCol - fromCol + 2 }, () => initBorderSegment())
    );
    this._colBorderStore = Array.from(
      { length: toCol - fromCol + 2 },
      () => Array.from({ length: toRow - fromRow + 2 }, () => initBorderSegment())
    );
    this._data.cells.concat(this._data.mergeCells).forEach((cell) => {
      const borderInfo = cell.info?.style?.border;
      const left = borderInfo?.left;
      const right = borderInfo?.right;
      const top = borderInfo?.top;
      const bottom = borderInfo?.bottom;
      const { startRow, endRow, startCol, endCol } = cell.coordinate;
      const {
        startRow: posStartRow,
        endRow: posEndRow,
        startCol: posStartCol,
        endCol: posEndCol
      } = cell.position;
      for (let j = startCol; j <= endCol; j++) {
        const topSeg = {
          pr: top,
          from: posStartCol,
          to: posEndCol,
          start: posStartRow,
          coordinateX: endCol,
          coordinateY: endRow
        };
        this._setRowBorder(startRow - fromRow, j - fromCol, topSeg);
        const bottomSeg = {
          pr: bottom,
          from: posStartCol,
          to: posEndCol,
          start: posEndRow,
          coordinateX: endCol,
          coordinateY: endRow
        };
        this._setRowBorder(endRow - fromRow + 1, j - fromCol, bottomSeg);
      }
      for (let i = startRow; i <= endRow; i++) {
        const leftSeg = {
          pr: left,
          from: posStartRow,
          to: posEndRow,
          start: posStartCol,
          coordinateX: endCol,
          coordinateY: endRow
        };
        this._setColBorder(i - fromRow, startCol - fromCol, leftSeg);
        const rightSeg = {
          pr: right,
          from: posStartRow,
          to: posEndRow,
          start: posEndCol,
          coordinateX: endCol,
          coordinateY: endRow
        };
        this._setColBorder(i - fromRow, endCol - fromCol + 1, rightSeg);
      }
    });
    this._data.mergeCells.forEach((m) => {
      const { startRow, endRow, startCol, endCol } = m.coordinate;
      const {
        startRow: posStartRow,
        endRow: posEndRow,
        startCol: posStartCol,
        endCol: posEndCol
      } = m.position;
      for (let i = startRow; i <= endRow; i++) {
        for (let j = startCol; j <= endCol; j++) {
          if (i > startRow) {
            this._setRowBorder(i - fromRow, j - fromCol, {
              from: posStartRow,
              to: posEndRow,
              start: posStartCol,
              coordinateX: endCol,
              coordinateY: endRow,
              pr: { style: "none" }
            });
          }
          if (j > startCol) {
            this._setColBorder(i - fromRow, j - fromCol, {
              from: posStartCol,
              to: posEndCol,
              start: posStartRow,
              coordinateX: endCol,
              coordinateY: endRow,
              pr: { style: "none" }
            });
          }
        }
      }
    });
  }
  _rowBorderStore;
  _colBorderStore;
  generateRowBorder(r) {
    const result = [];
    const row = r - this._data.fromRow;
    let currBorder = this._rowBorderStore[row][0];
    if (!currBorder.pr) {
      currBorder.pr = getDefaultBorder(true);
    }
    for (let i = 1; i < this._rowBorderStore[row].length; i++) {
      const seg = this._rowBorderStore[row][i];
      if (!seg.pr) {
        seg.pr = getDefaultBorder(true);
      }
      const pr = seg.pr;
      const currPr = currBorder.pr ?? getDefaultBorder(true);
      if (!isSameBorder(pr, currPr)) {
        result.push(currBorder);
        currBorder = seg;
      } else if (currBorder.to < seg.to) {
        currBorder.to = seg.to;
      }
    }
    result.push(currBorder);
    return result;
  }
  generateColBorder(c) {
    const result = [];
    const col = c - this._data.fromCol;
    let currBorder = this._colBorderStore[col][0];
    if (!currBorder.pr) {
      currBorder.pr = getDefaultBorder(false);
    }
    for (let i = 1; i < this._colBorderStore[col].length; i++) {
      const seg = this._colBorderStore[col][i];
      if (!seg.pr) {
        seg.pr = getDefaultBorder(false);
      }
      const pr = seg.pr;
      const currPr = currBorder.pr;
      if (!isSameBorder(pr, currPr)) {
        result.push(currBorder);
        currBorder = seg;
      } else if (currBorder.to < seg.to) {
        currBorder.to = seg.to;
      }
    }
    result.push(currBorder);
    return result;
  }
  _setRowBorder(row, col, border) {
    const prev = this._rowBorderStore[row][col];
    if (!prev.pr) {
      this._rowBorderStore[row][col] = border;
      return;
    }
    if (border.pr === void 0) {
      return;
    }
    if (border.coordinateX >= prev.coordinateX && border.coordinateY >= prev.coordinateY) {
      this._rowBorderStore[row][col] = border;
      return;
    }
  }
  _setColBorder(row, col, border) {
    const prev = this._colBorderStore[col][row];
    if (!prev.pr) {
      this._colBorderStore[col][row] = border;
      return;
    }
    if (border.pr === void 0) {
      return;
    }
    if (border.coordinateX >= prev.coordinateX && border.coordinateY >= prev.coordinateY) {
      this._colBorderStore[col][row] = border;
      return;
    }
  }
}

function thinLineWidth() {
  return 0.5;
}
class Box {
  position = new Range();
  get width() {
    return this.position.endCol - this.position.startCol;
  }
  get height() {
    return this.position.endRow - this.position.startRow;
  }
  textX(horizontal) {
    const { startCol, endCol } = this.position;
    switch (horizontal) {
      case "center":
        return [(startCol + endCol) / 2, "center"];
      case "right":
        return [endCol - 2, "end"];
      case "left":
      case "general":
      default:
        return [startCol + 2, "start"];
    }
  }
  textY(vertical) {
    const { startRow, endRow } = this.position;
    switch (vertical) {
      case "top":
        return [startRow + 2, "top"];
      case "bottom":
        return [endRow - 2, "bottom"];
      case "center":
      default:
        return [(startRow + endRow) / 2, "middle"];
    }
  }
}
class Painter {
  _canvas;
  _ctx;
  _showWatermark = true;
  setCanvas(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d") ?? void 0;
  }
  setShowWatermark(show) {
    this._showWatermark = show;
  }
  render(resp, anchorX, anchorY) {
    if (!this._ctx) return;
    this._ctx.save();
    this.renderContent(resp, anchorX, anchorY);
    this.renderMergeCells(resp, anchorX, anchorY);
    this.renderGrid(resp, anchorX, anchorY);
    if (this._showWatermark) {
      this.renderWatermark();
    }
    this._ctx.restore();
  }
  getAppropriateHeights(resp, anchorX, anchorY) {
    const heights = Array.from({ length: resp.rows.length }, () => ({
      height: 0,
      row: 0,
      col: 0
    }));
    resp.cells.forEach((cell) => {
      if (cell.skipRender) return;
      const height = this.renderCell(cell, anchorX, anchorY, false);
      const { startRow } = cell.coordinate;
      const row = startRow - resp.rows[0].coordinate.startRow;
      if (heights[row].height < height) {
        heights[row].height = height;
        heights[row].col = cell.coordinate.startCol;
        heights[row].row = cell.coordinate.startRow;
      }
    });
    return heights;
  }
  renderContent(resp, anchorX, anchorY) {
    resp.cells.forEach((cell) => {
      if (cell.skipRender) return;
      this.renderCell(cell, anchorX, anchorY);
    });
  }
  renderCell(renderCell, anchorX, anchorY, render = true) {
    const { position, info } = renderCell;
    const style = info?.style;
    const box = new Box();
    box.position = new Range().setEndRow(position.endRow - anchorY).setStartRow(position.startRow - anchorY).setEndCol(position.endCol - anchorX).setStartCol(position.startCol - anchorX);
    if (render) {
      this._fill(box, style);
      if (info) {
        return this._text(box, info);
      }
    } else {
      if (!info) return 0;
      return this._text(box, info, false);
    }
    return 0;
  }
  renderMergeCells(resp, anchorX, anchorY) {
    resp.mergeCells.forEach((c) => {
      this.renderCell(c, anchorX, anchorY, true);
    });
  }
  renderGrid(data, anchorX, anchorY) {
    if (!this._ctx) return;
    const borderHelper = new BorderHelper(data);
    for (let row = data.fromRow; row <= data.toRow; row++) {
      const border = borderHelper.generateRowBorder(row);
      border.forEach((b) => {
        if (!b.pr) return;
        const { start, from, to } = b;
        this._borderLine(
          b.pr,
          true,
          start - anchorY,
          from - anchorX,
          to - anchorX
        );
      });
    }
    for (let col = data.fromCol; col <= data.toCol; col++) {
      const border = borderHelper.generateColBorder(col);
      border.forEach((b) => {
        if (!b.pr) return;
        this._borderLine(
          b.pr,
          false,
          b.start - anchorX,
          b.from - anchorY,
          b.to - anchorY
        );
      });
    }
  }
  _borderLine(border, horizontal, start, from, to) {
    if (!this._ctx) return;
    const stdColor = StandardColor.fromCtColor(border.color);
    const dot = 1;
    const hair = 0.5;
    const dash = 3;
    const thin = thinLineWidth();
    const medium = 1.5;
    const thick = 3;
    const segments = [];
    this._ctx.strokeStyle = stdColor.css();
    this._ctx.lineWidth = thin;
    switch (border.style) {
      case "dashed":
        segments.push(dash, dash);
        break;
      case "dashDot":
        segments.push(dash, dot, dot, dot);
        break;
      case "dashDotDot":
        segments.push(dash, dot, dot, dot, dot, dot);
        break;
      case "dotted":
        segments.push(dot, dot);
        break;
      case "hair":
        segments.push(hair, hair);
        break;
      case "medium":
        this._ctx.lineWidth = medium;
        break;
      case "mediumDashed":
        this._ctx.lineWidth = medium;
        segments.push(dash, dash);
        break;
      case "mediumDashDot":
        this._ctx.lineWidth = medium;
        segments.push(dash, dot, dot, dot);
        break;
      case "mediumDashDotDot":
        this._ctx.lineWidth = medium;
        segments.push(dash, dot, dot, dot, dot, dot);
        break;
      case "none":
        return;
      case "slantDashDot":
        return;
      case "thick":
        this._ctx.lineWidth = thick;
        break;
      case "thin":
        this._ctx.lineWidth = thin;
        break;
    }
    this._ctx.setLineDash(segments);
    this._ctx.beginPath();
    if (horizontal) {
      this._ctx.moveTo(from, start);
      this._ctx.lineTo(to, start);
    } else {
      this._ctx.moveTo(start, from);
      this._ctx.lineTo(start, to);
    }
    this._ctx.stroke();
    this._ctx.setLineDash([]);
  }
  _fill(box, style) {
    if (!this._ctx) return;
    const fill = style?.fill;
    if (!fill || !(fill.type === "patternFill")) return;
    const patternFill = fill.value;
    if (patternFill.bgColor) {
      const color = StandardColor.fromCtColor(patternFill.bgColor);
      this._ctx.fillStyle = color.css();
      const { startRow, startCol } = box.position;
      this._ctx.fillRect(startCol, startRow, box.width, box.height);
    }
    if (patternFill.fgColor && patternFill.patternType === "solid") {
      const color = StandardColor.fromCtColor(patternFill.fgColor);
      this._ctx.fillStyle = color.css();
      const { startRow, startCol } = box.position;
      this._ctx.fillRect(startCol, startRow, box.width, box.height);
    }
  }
  _text(box, info, render = true) {
    if (!this._ctx) return 0;
    const t = info.getFormattedText();
    if (!t) return 0;
    const font = info.style?.getFont() ?? new StandardFont();
    const alignment = info.style?.alignment;
    const [tx, textAlign] = box.textX(alignment?.horizontal);
    const [ty, textBaseline] = box.textY(alignment?.vertical);
    this._ctx.font = font.toCssFont();
    this._ctx.textAlign = textAlign;
    this._ctx.textBaseline = textBaseline;
    this._ctx.fillStyle = font.standardColor.css();
    if (render) {
      this._ctx.fillText(t, tx, ty);
      if (font.strike) {
        const metrics = this._ctx.measureText(t);
        const lineY = ty;
        let lineX = tx;
        if (textAlign === "center") {
          lineX = tx - metrics.width / 2;
        } else if (textAlign === "right") {
          lineX = tx - metrics.width;
        }
        this._ctx.beginPath();
        this._ctx.strokeStyle = font.standardColor.css();
        this._ctx.lineWidth = 1;
        this._ctx.moveTo(lineX, lineY);
        this._ctx.lineTo(lineX + metrics.width, lineY);
        this._ctx.stroke();
      }
    }
    return font.size * 1.3;
  }
  renderWatermark() {
    if (!this._ctx || !this._canvas) return;
    const height = this._canvas.height / (self.window.devicePixelRatio || 1);
    this._ctx.save();
    this._ctx.fillStyle = "rgba(180, 180, 180, 0.6)";
    this._ctx.font = "24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    this._ctx.textAlign = "left";
    this._ctx.textBaseline = "bottom";
    const padding = 12;
    const x = padding;
    const y = height - padding;
    this._ctx.fillText("LogiSheets · logisheets.com", x, y);
    this._ctx.restore();
  }
}

const RENDER_CELL_COUNT = 5e3;
const RANGE_COUNT = 6e3;
const CACHE_NUMBER = 2;
class Pool {
  getRenderCell() {
    if (this._renderCells.length > 0) {
      return this._renderCells.pop();
    }
    return new RenderCell();
  }
  releaseRenderCell(c) {
    c.reset();
    this.releaseRange(c.position);
    this.releaseRange(c.coordinate);
    if (c.info) {
      this.releaseStandardCell(c.info);
    }
    this._renderCells.push(c);
  }
  getRange() {
    if (this._ranges.length > 0) return this._ranges.pop();
    return new Range();
  }
  releaseRange(r) {
    r.reset();
    this._ranges.push(r);
  }
  getStandardValue() {
    if (this._standardValues.length > 0) {
      return this._standardValues.pop();
    }
    return new StandardValue();
  }
  releaseStandardValue(v) {
    v.cellValueOneof = void 0;
    this._standardValues.push(v);
  }
  getStandardStyle() {
    if (this._standardStyles.length > 0) {
      return this._standardStyles.pop();
    }
    return new StandardStyle();
  }
  releaseStandardStyle(s) {
    this._standardStyles.push(s);
  }
  getStandardCell() {
    if (this._standardCells.length > 0) {
      return this._standardCells.pop();
    }
    return new StandardCell();
  }
  releaseStandardCell(c) {
    if (c.value) this.releaseStandardValue(c.value);
    if (c.style) this.releaseStandardStyle(c.style);
    this._standardCells.push(c);
  }
  releaseCellView(v) {
    if (this._cellViews.length >= CACHE_NUMBER) {
      const cellView = this._cellViews.pop();
      cellView.rows.forEach((c) => {
        this.releaseRenderCell(c);
      });
      cellView.cols.forEach((c) => {
        this.releaseRenderCell(c);
      });
      cellView.cells.forEach((c) => {
        this.releaseRenderCell(c);
      });
    }
    this._cellViews.push(v);
  }
  _renderCells = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new RenderCell()
  );
  _ranges = Array.from({ length: RANGE_COUNT }, () => new Range());
  _standardCells = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new StandardCell()
  );
  _standardValues = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new StandardValue()
  );
  _standardStyles = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new StandardStyle()
  );
  _cellViews = [];
}

const _f = [
  "514d7e46507c5f5d7b5d7e72654d7d477d597a4d505d7d027d587540795e61067d5d435d51777d027d5e",
  "725f6e5f0d7b6105714e62734c6e677c6e6c6c067279515a727d67040173504e7a7c7b77050455710d64",
  "55610d5e55590146795e586c604e535d78777e017d5e5b5d5662727e6d61406561725c716c0666736e61",
  "44627958766c576c764150060d59627c5870794d054166630c047a717d007a727e65677c5f4e63677e0d"
];
const _m = 52;
function _pk() {
  const hex = _f.join("");
  const decoded = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    decoded.push(String.fromCharCode(byte ^ _m));
  }
  return JSON.parse(atob(decoded.join("")));
}
async function validateLicenseInWorker(apiKey, currentDomain) {
  try {
    const json = atob(apiKey);
    const license = JSON.parse(json);
    const message = `${license.domain}|${license.issuedAt}|${license.validDays}`;
    const isSignatureValid = await verifySignature(message, license.signature);
    if (!isSignatureValid) {
      return { valid: false, reason: "Invalid signature" };
    }
    if (!matchDomain(license.domain, currentDomain)) {
      return {
        valid: false,
        reason: `Domain mismatch: expected ${license.domain}, got ${currentDomain}`
      };
    }
    const now = Math.floor(Date.now() / 1e3);
    const expiresAt = license.issuedAt + license.validDays * 86400;
    if (now > expiresAt) {
      return { valid: false, reason: "License expired" };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: `Invalid license format: ${e}` };
  }
}
async function verifySignature(message, signatureBase64) {
  try {
    const publicKeyJwk = _pk();
    const key = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const signature = Uint8Array.from(
      atob(signatureBase64),
      (c) => c.charCodeAt(0)
    );
    const data = new TextEncoder().encode(message);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      data
    );
  } catch (e) {
    console.error("Signature verification failed:", e);
    return false;
  }
}
function matchDomain(pattern, actual) {
  if (pattern === actual) return true;
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    return actual.endsWith(suffix) || actual === pattern.slice(2);
  }
  return false;
}

const pool = new Pool();
class OffscreenWorkerService {
  constructor(_workbook, _ctx) {
    this._workbook = _workbook;
    this._ctx = _ctx;
  }
  _canvas;
  _dpr = 1;
  _painter = new Painter();
  _sheetId = 0;
  _anchorX = 0;
  _anchorY = 0;
  // ========================================================================
  // Public API
  // ========================================================================
  init(canvas, dpr) {
    this._canvas = canvas;
    this._dpr = dpr;
    self.window.devicePixelRatio = dpr;
  }
  /**
   * Set license - validates the license inside the worker
   * This is the ONLY way to hide the watermark - no bypass possible
   */
  async setLicense(apiKey, domain) {
    const status = await validateLicenseInWorker(apiKey, domain);
    if (status.valid) {
      this._painter.setShowWatermark(false);
    }
    return status;
  }
  /**
   * Clear license and show watermark again
   */
  clearLicense() {
    this._painter.setShowWatermark(true);
  }
  resize(width, height, dpr) {
    if (!this._canvas) throw Error("canvas is not ready");
    this._canvas.width = width * dpr;
    this._canvas.height = height * dpr;
    this._dpr = dpr;
    self.window.devicePixelRatio = dpr;
    return this.render(this._sheetId, this._anchorX, this._anchorY);
  }
  render(sheetId, anchorX, anchorY) {
    if (!this._canvas) {
      throw new Error("Canvas not initialized");
    }
    this._sheetId = sheetId;
    const ctx = this._canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    const sheetIdx = this._workbook.getSheetIdx({ sheetId });
    if (isErrorMessage(sheetIdx)) return sheetIdx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this._dpr, this._dpr);
    ctx.clearRect(
      0,
      0,
      this._canvas.width / this._dpr,
      this._canvas.height / this._dpr
    );
    const viewManager = new ViewManager(this._workbook, sheetIdx, pool);
    const viewResponse = viewManager.getViewResponse(
      anchorX,
      anchorY,
      this._canvas.height / this._dpr,
      this._canvas.width / this._dpr
    );
    if (isErrorMessage(viewResponse)) return viewResponse;
    this._anchorX = viewResponse.anchorX;
    this._anchorY = viewResponse.anchorY;
    this._painter.setCanvas(this._canvas);
    this._painter.render(
      viewResponse.data,
      viewResponse.anchorX,
      viewResponse.anchorY
    );
    const rows = viewResponse.data.rows.filter((r) => r.position.endRow > viewResponse.anchorY).map((r) => ({
      idx: r.coordinate.startRow,
      height: r.position.height
    }));
    const columns = viewResponse.data.cols.filter((c) => c.position.endCol > viewResponse.anchorX).map((c) => ({
      idx: c.coordinate.startCol,
      width: c.position.width
    }));
    const mergeCells = viewResponse.data.mergeCells.map((m) => ({
      startRow: m.coordinate.startRow,
      startCol: m.coordinate.startCol,
      endRow: m.coordinate.endRow,
      endCol: m.coordinate.endCol
    }));
    const getRowHeight = (rowIdx) => {
      const r = this._workbook.getWorkbook().getWorksheetById(sheetId).getRowHeight(rowIdx);
      if (isErrorMessage(r)) {
        return void 0;
      }
      return r;
    };
    const getColWidth = (colIdx) => {
      const c = this._workbook.getWorkbook().getWorksheetById(sheetId).getColWidth(colIdx);
      if (isErrorMessage(c)) {
        return void 0;
      }
      return c;
    };
    const preRow = rows[0].idx > 1 ? rows[0].idx - 1 : void 0;
    let preRowHeight = void 0;
    if (preRow !== void 0) {
      preRowHeight = getRowHeight(preRow);
    }
    const nextRow = rows[rows.length - 1].idx + 1;
    const nextRowHeight = getRowHeight(nextRow);
    const preCol = columns[0].idx > 1 ? columns[0].idx - 1 : void 0;
    let preColWidth = void 0;
    if (preCol !== void 0) {
      preColWidth = getColWidth(preCol);
    }
    const nextCol = columns[columns.length - 1].idx + 1;
    const nextColWidth = getColWidth(nextCol);
    const result = {
      anchorX: viewResponse.anchorX,
      anchorY: viewResponse.anchorY,
      rows,
      columns,
      mergeCells,
      blockInfos: viewResponse.data.blocks,
      preRowHeight,
      preColWidth,
      nextRowHeight,
      nextColWidth
    };
    pool.releaseCellView(viewResponse.data);
    return result;
  }
  getAppropriateHeights(sheetId, anchorX, anchorY) {
    if (!this._canvas) {
      throw new Error("Canvas not initialized");
    }
    this._sheetId = sheetId;
    const ctx = this._canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    const sheetIdx = this._workbook.getSheetIdx({ sheetId });
    if (isErrorMessage(sheetIdx)) return sheetIdx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this._dpr, this._dpr);
    const viewManager = new ViewManager(this._workbook, sheetIdx, pool);
    const viewResponse = viewManager.getViewResponse(
      anchorX,
      anchorY,
      this._canvas.height / this._dpr,
      this._canvas.width / this._dpr
    );
    if (isErrorMessage(viewResponse)) return viewResponse;
    this._anchorX = viewResponse.anchorX;
    this._anchorY = viewResponse.anchorY;
    this._painter.setCanvas(this._canvas);
    return this._painter.getAppropriateHeights(
      viewResponse.data,
      anchorX,
      anchorY
    );
  }
  // ========================================================================
  // Request Handler
  // ========================================================================
  handleRequest(request) {
    const { m, args, rid: id } = request;
    if (!this._canvas && m !== OffscreenRenderName.Init) {
      this._ctx.postMessage({
        error: "OffscreenWorkerService not initialized",
        rid: id
      });
      return;
    }
    let result;
    try {
      switch (m) {
        case OffscreenRenderName.Render:
          result = this.render(args.sheetId, args.anchorX, args.anchorY);
          break;
        case OffscreenRenderName.Resize:
          result = this.resize(args.width, args.height, args.dpr);
          break;
        case OffscreenRenderName.Init:
          result = this.init(args.canvas, args.dpr);
          break;
        case OffscreenRenderName.GetAppropriateHeights:
          result = this.getAppropriateHeights(
            args.sheetId,
            args.anchorX,
            args.anchorY
          );
          break;
        case OffscreenRenderName.SetLicense:
          this.setLicense(args.apiKey, args.domain).then((status) => {
            this._ctx.postMessage({ result: status, rid: id });
          });
          return;
        // Don't post message here, it's handled in the promise
        case OffscreenRenderName.ClearLicense:
          result = this.clearLicense();
          break;
        default:
          this._ctx.postMessage({
            error: "Unknown method",
            rid: id
          });
          return;
      }
    } catch (error) {
      this._ctx.postMessage({
        error: String(error),
        rid: id
      });
      return;
    }
    this._ctx.postMessage({ result, rid: id });
  }
}

function convertCanvasPropsToAdapterProps(props) {
  return {
    selectedData: props.selectedData,
    activeSheet: props.activeSheet,
    cellLayouts: props.cellLayouts,
    onSelectedDataChange: (data) => {
      props.selectedData$(data);
      props.selectedDataContentChanged$({});
    },
    onActiveSheetChange: props.activeSheet$,
    onGridChange: props.setGrid
  };
}

export { BlockManager, Cell as CellClass, ColumnHeaders, ContextMenu, DEFAULT_ENGINE_CONFIG, DataService, Engine, EnumSetManager, FIELD_AND_VALIDATION_TAG, FieldManager, LOGISHEETS_BUILTIN_CRAFT_ID, OffscreenClient, OffscreenWorkerService, Range$1 as RangeClass, RowHeaders, Scrollbar, Selector, SheetTabs, Spreadsheet, WorkbookClient, WorkbookWorkerService, buildSelectedDataFromCell, buildSelectedDataFromCellRange, buildSelectedDataFromLines, convertCanvasPropsToAdapterProps, Engine as default, findVisibleColIdxRange, findVisibleRowIdxRange, getPosition, getReferenceString, getSelectedCellRange, getSelectedColumns, getSelectedLines, getSelectedRows, match, ptToPx$1 as ptToPx, pxToPt$1 as pxToPt, pxToWidth$1 as pxToWidth, simpleUuid, xForColEnd, xForColStart, yForRowEnd, yForRowStart };
