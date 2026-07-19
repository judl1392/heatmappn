const state = {
  rows: [],
  filteredRows: [],
  filterDefinitions: [],
  activeFilters: [],
  rowNumbers: new Map(),
  headers: [],
  columns: [],
  geo: null,
  layer: null,
  noDataLayer: null,
  values: new Map(),
  primaryValues: new Map(),
  comparisonValues: new Map(),
  absoluteChanges: new Map(),
  percentageChanges: new Map(),
  comparisonReadiness: null,
  unmatched: [],
  breaks: [],
  importDetail: null,
  columnConfidenceLow: false,
  valueLabelEdited: false,
  mapGenerated: false,
  pinnedPostcode: null,
  palette: [],
  scaleMode: "quantile",
  scaleMin: 0,
  scaleMax: 0,
  scaleCentre: 0,
  legendPosition: "bottom-right",
  exportStyleRevision: 0,
  scalePreferences: {
    raw: {
      scaleMode: "quantile",
      palette: "green",
      classCount: "6",
      reverse: false,
      centre: "0",
      initialized: true,
    },
    change: {
      scaleMode: "diverging",
      palette: "blue-red",
      classCount: "6",
      reverse: false,
      centre: "0",
      initialized: false,
    },
  },
  activeScalePreference: "raw",
  validation: { invalidRows: [], unmatchedRows: [] },
  statusAffectedRows: [],
  sampleData: false,
};
const $ = (id) => document.getElementById(id);
const viewState = {
  sidebarCollapsed: false,
  focusMode: false,
  focusRestore: null,
  resizeTimer: null,
};
const operationState = {
  geography: "loading",
  geographyGeneration: 0,
  uploadGeneration: 0,
  uploadBusy: false,
  sampleBusy: false,
  buildGeneration: 0,
  buildRunning: false,
  buildPending: false,
  buildMessage: "",
};
const SAMPLE_DATA_PATH = "sample/sample-shopify-postcode-data.csv",
  SAMPLE_DATA_NAME = "sample-shopify-postcode-data.csv",
  SAMPLE_MAP_TITLE = "Australian ecommerce sales by postcode",
  SAMPLE_MAP_SUBTITLE = "Synthetic sample data · 2025 net sales";
const paletteDefinitions = {
  blue: ["#eff6ff", "#3b82f6", "#172554"],
  green: ["#edf3ee", "#66967d", "#163e32"],
  purple: ["#f5f3ff", "#8b5cf6", "#3b0764"],
  orange: ["#fff7ed", "#f97316", "#7c2d12"],
  red: ["#fef2f2", "#ef4444", "#7f1d1d"],
  "blue-red": ["#2166ac", "#f7f7f7", "#b2182b"],
  colourblind: ["#0072b2", "#f7f7f7", "#d55e00"],
};
const map = L.map("map", {
  zoomControl: true,
  attributionControl: true,
  preferCanvas: false,
}).setView([-27, 134], 4);
const lightMap = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    crossOrigin: true,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
).addTo(map);
const streetMap = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    crossOrigin: true,
    attribution: "&copy; OpenStreetMap contributors",
  },
);
const noBasemap = L.layerGroup();
const basemaps = { light: lightMap, streets: streetMap, none: noBasemap };
let basemapTileError = false;
[lightMap, streetMap].forEach((layer) => {
  layer.on("loading", () => {
    basemapTileError = false;
    $("appearanceWarning").textContent = "";
  });
  layer.on("tileerror", () => {
    basemapTileError = true;
    $("appearanceWarning").textContent =
      "Some basemap tiles could not be loaded. They may also be missing from PNG exports.";
  });
});

function appearanceSettings() {
  return {
    fillOpacity: Number($("fillOpacity").value),
    boundaryOpacity: Number($("boundaryOpacity").value),
    boundaryWidth: Number($("boundaryWidth").value),
    borders: $("postcodeBorders").checked,
  };
}
function postcodeStyle(feature) {
  const appearance = appearanceSettings(),
    value = state.values.get(String(feature.properties.POA_CODE21));
  return {
    fillColor: colour(value),
    fillOpacity: appearance.fillOpacity,
    color: "#74827c",
    opacity: appearance.borders ? appearance.boundaryOpacity : 0,
    weight: appearance.borders ? appearance.boundaryWidth : 0,
  };
}
function noDataStyle() {
  const appearance = appearanceSettings();
  return {
    fillColor: "#dfe3e1",
    fillOpacity: Math.min(0.22, appearance.fillOpacity * 0.35),
    color: "#a3ada8",
    opacity: appearance.borders ? appearance.boundaryOpacity * 0.75 : 0,
    weight: appearance.borders
      ? Math.min(appearance.boundaryWidth, 0.5)
      : 0,
  };
}
function applyAppearance() {
  $("fillOpacityValue").textContent =
    `${Math.round(Number($("fillOpacity").value) * 100)}%`;
  $("boundaryOpacityValue").textContent =
    `${Math.round(Number($("boundaryOpacity").value) * 100)}%`;
  if (state.noDataLayer) state.noDataLayer.setStyle(noDataStyle());
  if (state.layer) state.layer.setStyle(postcodeStyle);
  state.exportStyleRevision++;
}
function selectBasemap() {
  Object.values(basemaps).forEach((layer) => map.removeLayer(layer));
  basemaps[$("basemapMode").value].addTo(map);
  basemapTileError = false;
  $("appearanceWarning").textContent = "";
  updateTransparentExportOption();
}
function updateTransparentExportOption() {
  const available = $("basemapMode").value === "none";
  $("exportTransparent").disabled = !available;
  if (!available) $("exportTransparent").checked = false;
  $("transparentExportHelp").textContent = available
    ? "Removes the page background while keeping map polygons and the legend."
    : "Available when No basemap is selected.";
}
["fillOpacity", "boundaryOpacity"].forEach((id) =>
  $(id).addEventListener("input", applyAppearance),
);
["boundaryWidth", "postcodeBorders"].forEach(
  (id) => ($(id).onchange = applyAppearance),
);
$("basemapMode").onchange = selectBasemap;
updateTransparentExportOption();

function setDisclosure(button, open) {
  const body = $(button.getAttribute("aria-controls"));
  button.setAttribute("aria-expanded", String(open));
  body.hidden = !open;
  button.closest(".workflow-section")?.classList.toggle("is-open", open);
}
document.querySelectorAll(".workflow-toggle").forEach((button) => {
  button.onclick = () =>
    setDisclosure(button, button.getAttribute("aria-expanded") !== "true");
});
function wireNestedDisclosure(buttonId) {
  const button = $(buttonId),
    body = $(button.getAttribute("aria-controls"));
  button.onclick = () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    body.hidden = !open;
  };
}
wireNestedDisclosure("previewToggle");
wireNestedDisclosure("unmatchedToggle");

function setAppearancePopover(open) {
  $("appearancePopover").classList.toggle("hidden", !open);
  $("appearanceButton").setAttribute("aria-expanded", String(open));
  if (open) $("basemapMode").focus();
}
$("appearanceButton").onclick = (event) => {
  event.stopPropagation();
  setAppearancePopover($("appearanceButton").getAttribute("aria-expanded") !== "true");
};
$("closeAppearance").onclick = () => {
  setAppearancePopover(false);
  $("appearanceButton").focus();
};
$("appearancePopover").onclick = (event) => event.stopPropagation();
document.querySelector(".map-shell").addEventListener(
  "click",
  (event) => {
    if (
      $("appearanceButton").getAttribute("aria-expanded") === "true" &&
      !$("appearancePopover").contains(event.target)
    )
      setAppearancePopover(false);
  },
  true,
);
document.addEventListener("click", () => setAppearancePopover(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("appearanceButton").getAttribute("aria-expanded") === "true") {
    setAppearancePopover(false);
    $("appearanceButton").focus();
  }
});

$("resetViewButton").onclick = () => {
  if (state.layer && state.layer.getBounds().isValid())
    map.fitBounds(state.layer.getBounds(), { padding: [12, 12], animate: false });
  else map.setView([-27, 134], 4, { animate: false });
};
function searchPostcode() {
  const postcode = cleanPostcode($("postcodeSearch").value);
  if (!postcode || !state.geo) {
    $("postcodeSearch").setCustomValidity("Enter a valid four-digit postcode.");
    $("postcodeSearch").reportValidity();
    return;
  }
  $("postcodeSearch").setCustomValidity("");
  if (!zoomToPostcode(postcode)) {
    $("postcodeSearch").setCustomValidity("This postcode is not in the ABS geography.");
    $("postcodeSearch").reportValidity();
  }
}
function zoomToPostcode(postcode) {
  const feature = state.geo?.features.find(
    (item) => String(item.properties.POA_CODE21) === postcode,
  );
  if (!feature) return false;
  map.fitBounds(L.geoJSON(feature).getBounds(), {
    padding: [28, 28],
    maxZoom: 12,
    animate: false,
  });
  state.layer?.eachLayer((layer) => {
    if (String(layer.feature.properties.POA_CODE21) === postcode) {
      layer.openTooltip();
      state.pinnedPostcode = postcode;
      renderPinnedDetail();
    }
  });
  return true;
}
$("searchPostcodeButton").onclick = searchPostcode;
$("postcodeSearch").onkeydown = (event) => {
  if (event.key === "Enter") searchPostcode();
};
new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(
  document.querySelector(".map-shell"),
);
function invalidateMapAfterLayout() {
  clearTimeout(viewState.resizeTimer);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      viewState.resizeTimer = setTimeout(
        () => map.invalidateSize({ pan: false, animate: false }),
        220,
      );
    }),
  );
}
function setSidebarCollapsed(collapsed) {
  viewState.sidebarCollapsed = collapsed;
  $("workspace").classList.toggle("sidebar-collapsed", collapsed);
  $("sidebarToggle").textContent = collapsed ? "Show controls" : "Hide controls";
  $("sidebarToggle").setAttribute("aria-expanded", String(!collapsed));
  $("sidebarToggle").setAttribute(
    "aria-label",
    collapsed ? "Show configuration controls" : "Hide configuration controls",
  );
  invalidateMapAfterLayout();
}
$("sidebarToggle").onclick = () =>
  setSidebarCollapsed(!viewState.sidebarCollapsed);

function setGeographyStatus(message, tone = "") {
  const status = $("geographyStatus");
  status.textContent = message;
  status.className = `operation-status${tone ? ` is-${tone}` : ""}`;
}
async function loadGeography() {
  const generation = ++operationState.geographyGeneration;
  operationState.geography = "loading";
  $("retryGeography").classList.add("hidden");
  setGeographyStatus("Loading postcode boundaries…");
  updateActionStatus();
  try {
    const response = await fetch("data/australia-postal-areas.geojson", {
      cache: "default",
    });
    if (!response.ok) throw new Error("GEOGRAPHY_HTTP_ERROR");
    const geography = await response.json();
    if (generation !== operationState.geographyGeneration) return;
    if (!Array.isArray(geography?.features) || !geography.features.length)
      throw new Error("GEOGRAPHY_INVALID");
    state.geo = geography;
    operationState.geography = "ready";
    $("geographyStatus").classList.add("hidden");
    if (state.rows.length) renderValidation();
  } catch (_error) {
    if (generation !== operationState.geographyGeneration) return;
    operationState.geography = "error";
    setGeographyStatus(
      "Postcode boundaries could not be loaded. Check your connection, then retry.",
      "error",
    );
    $("retryGeography").classList.remove("hidden");
  } finally {
    if (generation === operationState.geographyGeneration) updateActionStatus();
  }
}
$("retryGeography").onclick = loadGeography;
loadGeography();

const dz = $("dropzone"),
  fi = $("fileInput");
dz.onclick = () => fi.click();
dz.onkeydown = (e) => {
  if (e.key === "Enter" || e.key === " ") fi.click();
};
["dragenter", "dragover"].forEach((x) =>
  dz.addEventListener(x, (e) => {
    e.preventDefault();
    dz.classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((x) =>
  dz.addEventListener(x, (e) => {
    e.preventDefault();
    dz.classList.remove("drag");
  }),
);
dz.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));
fi.onchange = () => handleFile(fi.files[0]);

function beginIngestion(message) {
  const generation = ++operationState.uploadGeneration;
  operationState.uploadBusy = true;
  operationState.buildGeneration++;
  operationState.buildPending = false;
  $("dropzone").setAttribute("aria-busy", "true");
  setFileOperationStatus(message);
  updateActionStatus();
  const current = () => generation === operationState.uploadGeneration,
    finish = () => {
      if (!current()) return;
      operationState.uploadBusy = false;
      $("dropzone").removeAttribute("aria-busy");
      updateActionStatus();
      fi.value = "";
    };
  return { generation, current, finish };
}
function handleFile(file) {
  if (!file) return;
  const operation = beginIngestion("Reading file…"),
    ext = file.name.split(".").pop().toLowerCase(),
    { current, finish } = operation;
  if (ext === "csv") {
    parseCsvSource(file, file.name, operation);
  } else if (["xlsx", "xls"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!current()) return;
      try {
        setFileOperationStatus("Parsing workbook…");
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true }),
          detected = detectWorkbookTable(wb);
        if (!detected)
          throw new Error("No tabular rows found in the workbook.");
        if (!current()) return;
        loadRows(file.name, detected.rows, detected.headers, {
          sheetName: detected.sheetName,
          headerRow: detected.headerRow + 1,
        }, detected.columns);
      } catch (_error) {
        setFileOperationStatus(
          "We couldn’t read this Excel file. Try saving it as .xlsx or CSV and upload it again.",
          "error",
        );
      } finally {
        finish();
      }
    };
    reader.onerror = () => {
      if (!current()) return;
      setFileOperationStatus(
        "We couldn’t read this Excel file. Try saving it as .xlsx or CSV and upload it again.",
        "error",
      );
      finish();
    };
    reader.onabort = finish;
    reader.readAsArrayBuffer(file);
  } else {
    setFileOperationStatus(
      "This file type isn’t supported. Choose a CSV, XLSX or XLS file.",
      "error",
    );
    finish();
  }
}

function parseCsvSource(source, name, operation, sourceOptions = {}) {
  const { current, finish } = operation;
  Papa.parse(source, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (r) => {
        if (!current()) return;
        try {
          setFileOperationStatus("Reading CSV data…");
          const fields = r.meta.fields || [],
            usable = fields.some(meaningfulHeader) && r.data.some((row) =>
              Object.values(row).some((value) => !blank(value)),
            ),
            warning = csvWarningSummary(r.errors || []);
          if (!usable) {
            setFileOperationStatus(
              warning || "We couldn’t find a usable table in this CSV. Check the header row and upload it again.",
              "error",
            );
            return;
          }
          const parsed = normaliseParsedHeaders(r.data, fields);
          const loaded = loadRows(
            name,
            parsed.rows,
            parsed.headers,
            null,
            parsed.columns,
            warning,
            sourceOptions,
          );
          if (loaded && sourceOptions.onLoaded) sourceOptions.onLoaded();
        } catch (_error) {
          setFileOperationStatus(
            "We couldn’t read this CSV. Check its headers and quoting, then upload it again.",
            "error",
          );
        } finally {
          finish();
        }
      },
      error: () => {
        if (!current()) return;
        setFileOperationStatus(
          "We couldn’t read this CSV. Try saving it again as UTF-8 CSV and upload it again.",
          "error",
        );
        finish();
      },
    });
}

function setSampleDataState(active) {
  const wasSample = state.sampleData,
    indicator = $("sampleDataIndicator");
  state.sampleData = active;
  indicator.classList.toggle("hidden", !active);
  if (active) indicator.classList.remove("is-dismissed");
  if (!active && wasSample) {
    if ($("mapTitle").value === SAMPLE_MAP_TITLE)
      $("mapTitle").value = "Australian postcode heatmap";
    if ($("mapSubtitle").value === SAMPLE_MAP_SUBTITLE)
      $("mapSubtitle").value = "";
  }
}

function columnKeyForRawHeader(rawHeader) {
  const expected = rawHeader.trim().toLowerCase();
  return state.columns.find(
    (column) =>
      String(column.rawHeader).replace(/^\uFEFF/, "").trim().toLowerCase() ===
      expected,
  )?.key;
}

function applySampleDefaults() {
  const postcode = columnKeyForRawHeader("postcode"),
    primary = columnKeyForRawHeader("net_sales_2025"),
    comparison = columnKeyForRawHeader("net_sales_2026");
  if (postcode) $("postcodeColumn").value = postcode;
  if (primary) $("valueColumn").value = primary;
  if (comparison) $("comparisonColumn").value = comparison;
  $("comparisonEnabled").checked = Boolean(comparison);
  $("mapMode").value = "primary";
  $("aggregation").value = "sum";
  $("numberFormat").value = "currency";
  $("currencySymbol").selectedIndex = 0;
  $("decimalPlaces").value = "2";
  state.valueLabelEdited = false;
  $("valueLabel").value = "";
  $("mapTitle").value = SAMPLE_MAP_TITLE;
  $("mapSubtitle").value = SAMPLE_MAP_SUBTITLE;
  updateComparisonControls();
  updateFormatControls();
  recommendScale();
  renderFilterControls();
  renderPreview();
  renderValidation();
  updatePresentation();
  updateActionStatus();
}

let sampleDialogReturnFocus = null;
function setSampleDialog(open) {
  const dialog = $("sampleConfirmation");
  dialog.classList.toggle("hidden", !open);
  if (open) {
    sampleDialogReturnFocus = document.activeElement;
    $("cancelSampleLoad").focus();
  } else {
    const returnFocus = sampleDialogReturnFocus;
    sampleDialogReturnFocus = null;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }
}

async function loadEcommerceSample() {
  if (operationState.sampleBusy) return;
  operationState.sampleBusy = true;
  const button = $("sampleDataButton"),
    operation = beginIngestion("Loading ecommerce sample…");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(SAMPLE_DATA_PATH);
    if (!response.ok) throw new Error("Sample request failed");
    const csv = await response.text();
    if (!operation.current()) return;
    parseCsvSource(csv, SAMPLE_DATA_NAME, operation, {
      sample: true,
      onLoaded: applySampleDefaults,
    });
  } catch (_error) {
    if (operation.current()) {
      setFileOperationStatus(
        "We couldn’t load the sample data. Refresh the page and try again.",
        "error",
      );
      operation.finish();
    }
  } finally {
    operationState.sampleBusy = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

$("sampleDataButton").onclick = () => {
  if (operationState.sampleBusy) return;
  if (state.rows.length && !state.sampleData) setSampleDialog(true);
  else loadEcommerceSample();
};
$("cancelSampleLoad").onclick = () => setSampleDialog(false);
$("confirmSampleLoad").onclick = () => {
  setSampleDialog(false);
  loadEcommerceSample();
};
$("dismissSampleDescription").onclick = () =>
  $("sampleDataIndicator").classList.add("is-dismissed");
$("sampleConfirmation").addEventListener("click", (event) => {
  if (event.target === $("sampleConfirmation")) setSampleDialog(false);
});
$("sampleConfirmation").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    setSampleDialog(false);
    return;
  }
  if (event.key !== "Tab") return;
  const controls = [$("cancelSampleLoad"), $("confirmSampleLoad")],
    current = controls.indexOf(document.activeElement),
    next = event.shiftKey
      ? (current - 1 + controls.length) % controls.length
      : (current + 1) % controls.length;
  event.preventDefault();
  controls[next].focus();
});

function setFileOperationStatus(message, tone = "") {
  const status = $("fileStatus");
  status.textContent = message;
  status.className = `file-status${tone ? ` is-${tone}` : ""}`;
}
function csvWarningSummary(errors) {
  if (!errors.length) return "";
  const first = errors.find((error) => Number.isInteger(error.row)) || errors[0],
    row = Number.isInteger(first.row) ? ` near row ${first.row + 2}` : "";
  if (first.code === "MissingQuotes")
    return `This CSV contains inconsistent quoting${row}. The readable rows were loaded; check that row before relying on the map.`;
  if (first.code === "TooFewFields" || first.code === "TooManyFields")
    return `Some CSV rows have a different number of columns${row}. The readable rows were loaded; review the preview and validation summary.`;
  return `This CSV was loaded with ${errors.length.toLocaleString()} parsing warning${errors.length === 1 ? "" : "s"}${row}. Review the preview before generating the map.`;
}

const headerTerms = [
  "postcode",
  "post code",
  "poa",
  "postal area",
  "revenue",
  "sales",
  "value",
  "population",
  "person records",
];
function meaningfulHeader(v) {
  const s = String(v ?? "").trim();
  return Boolean(s && !/^__EMPTY(?:_\d+)?$/i.test(s));
}
function dataCell(v) {
  if (v === null || v === undefined || String(v).trim() === "") return false;
  if (typeof v === "number") return true;
  const s = String(v).trim();
  return (
    /^\d{4}(?:\s*,\s*[A-Z]{2,3})?$/.test(s) ||
    Number.isFinite(Number(s.replace(/[$,%\s,]/g, "")))
  );
}
function detectWorkbookTable(wb) {
  let best = null;
  wb.SheetNames.forEach((sheetName, sheetIndex) => {
    const ws = wb.Sheets[sheetName],
      preview = XLSX.utils
        .sheet_to_json(ws, {
          header: 1,
          defval: "",
          raw: true,
          range: 0,
          blankrows: true,
        })
        .slice(0, 30);
    preview.forEach((row, rowIndex) => {
      const real = row.filter(meaningfulHeader),
        following = preview.slice(
          rowIndex + 1,
          Math.min(preview.length, rowIndex + 6),
        ),
        dataRows = following.filter((r) => r.some(dataCell)).length;
      if (!real.length || !dataRows) return;
      const termHits = real.reduce(
          (n, v) =>
            n +
            headerTerms.filter((t) => String(v).toLowerCase().includes(t))
              .length,
          0,
        ),
        populatedBelow = following.reduce(
          (n, r) => n + r.filter((v) => String(v ?? "").trim() !== "").length,
          0,
        ),
        score =
          termHits * 100 +
          dataRows * 10 +
          Math.min(populatedBelow, 20) -
          rowIndex * 0.01;
      const candidate = {
        ws,
        sheetName,
        sheetIndex,
        headerRow: rowIndex,
        score,
        measureContext: detectMeasureContext(preview, rowIndex),
      };
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score && sheetIndex < best.sheetIndex)
      )
        best = candidate;
    });
  });
  return best ? parseDetectedTable(best) : null;
}
function detectMeasureContext(preview, headerRow) {
  const pattern = /^\s*(Counting|Measure|Metric|Value|Unit)\s*:\s*(.+?)\s*$/i;
  for (let rowIndex = headerRow - 1; rowIndex >= Math.max(0, headerRow - 8); rowIndex--) {
    for (const cell of preview[rowIndex] || []) {
      const match = String(cell ?? "").match(pattern);
      if (match && match[2].trim().length <= 60) return match[2].trim();
    }
  }
  return "";
}
function ambiguousMeasureHeader(value) {
  const text = String(value ?? "").trim();
  return /^\d+(?:\.\d+)?%?$/.test(text) || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(text);
}
function makeColumns(sourceHeaders, data, measureContext = "") {
  const meaningfulCount = sourceHeaders.filter(meaningfulHeader).length;
  return sourceHeaders.map((source, index) => {
    let rawHeader = meaningfulHeader(source) ? String(source).trim() : "";
    if (!rawHeader && meaningfulCount === 1 && data.some((row) => dataCell(row[index]))) rawHeader = "Value";
    if (!rawHeader) rawHeader = `Column ${XLSX.utils.encode_col(index)}`;
    const label = measureContext && ambiguousMeasureHeader(rawHeader) &&
      !rawHeader.toLocaleLowerCase().includes(measureContext.toLocaleLowerCase())
      ? `${rawHeader} — ${measureContext}` : rawHeader;
    return { key: `col_${index}`, rawHeader, label, columnLetter: XLSX.utils.encode_col(index) };
  });
}
function parseDetectedTable(found) {
  const matrix = XLSX.utils.sheet_to_json(found.ws, {
    header: 1,
    defval: "",
    raw: true,
    range: found.headerRow,
    blankrows: false,
  }), formattedHeader = XLSX.utils.sheet_to_json(found.ws, {
    header: 1, defval: "", raw: false, range: found.headerRow, blankrows: false,
  })[0] || [];
  if (matrix.length < 2) return null;
  const sourceHeaders = formattedHeader,
    data = matrix.slice(1),
    usedColumns = Math.max(
      sourceHeaders.length,
      ...data.map((r) =>
        r.reduce((last, v, i) => (String(v ?? "").trim() ? i + 1 : last), 0),
      ),
    ),
    columns = makeColumns(sourceHeaders.slice(0, usedColumns), data, found.measureContext);
  const rows = data
    .filter((r) => r.some((v) => String(v ?? "").trim() !== ""))
    .map((r) => Object.fromEntries(columns.map((column, i) => [column.key, r[i] ?? ""])));
  return { ...found, headers: columns.map((column) => column.key), columns, rows };
}

function normaliseParsedHeaders(rows, sourceHeaders) {
  const matrix = rows.map((row) => sourceHeaders.map((source) => row[source] ?? "")),
    columns = makeColumns(sourceHeaders, matrix);
  return {
    headers: columns.map((column) => column.key),
    columns,
    rows: rows.map((row) => Object.fromEntries(columns.map((column, i) => [column.key, row[sourceHeaders[i]] ?? ""]))),
  };
}

const recognisedFilterHeaders = /(^|\b)(channel|category|year|month|segment|state|region|type|band|group|class|status|market|store)(\b|$)/i;
const excludedFilterHeaders = /(^|\b)(id|identifier|reference|ref|row|email|url|website|timestamp|description|comment|notes?)(\b|$)/i;
function normalisedFilterValue(value) {
  if (blank(value)) return "__blank__";
  if (typeof value === "number" && Number.isFinite(value)) return `n:${value}`;
  return `s:${String(value).trim().toLocaleLowerCase("en-AU")}`;
}
function filterDisplayValue(value) {
  if (blank(value)) return "Blank";
  return String(value).trim();
}
function buildFilterDefinition(header, rows, suggested = false) {
  const variants = new Map();
  let nonBlank = 0,
    textLength = 0,
    numericValues = 0,
    emailValues = 0,
    urlValues = 0;
  rows.forEach((row) => {
    const value = row[header],
      key = normalisedFilterValue(value),
      label = filterDisplayValue(value);
    if (!blank(value)) {
      nonBlank += 1;
      textLength += label.length;
      if (typeof value === "number" || /^-?\d+(?:\.\d+)?$/.test(label))
        numericValues += 1;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(label)) emailValues += 1;
      if (/^(https?:\/\/|www\.)/i.test(label)) urlValues += 1;
    }
    if (!variants.has(key)) variants.set(key, new Map());
    const labels = variants.get(key);
    labels.set(label, (labels.get(label) || 0) + 1);
  });
  const options = [...variants].map(([key, labels]) => {
    const [label, count] = [...labels].sort((a, b) => b[1] - a[1])[0];
    const numericSort = key.startsWith("n:") || /^s:-?\d+(?:\.\d+)?$/.test(key);
    return {
      key,
      label,
      count: [...labels.values()].reduce((sum, value) => sum + value, 0),
      numericSort,
      sortValue: numericSort ? Number(key.slice(2)) : null,
    };
  });
  options.sort((a, b) => {
    if (a.key === "__blank__") return 1;
    if (b.key === "__blank__") return -1;
    if (a.numericSort && b.numericSort) return a.sortValue - b.sortValue;
    return a.label.localeCompare(b.label, "en-AU", { sensitivity: "base" });
  });
  const unique = options.length,
    coverage = nonBlank / Math.max(1, rows.length),
    uniqueRatio = unique / Math.max(1, nonBlank),
    averageLength = textLength / Math.max(1, nonBlank),
    recognised = recognisedFilterHeaders.test(header),
    discreteNumeric = numericValues / Math.max(1, nonBlank) > 0.8 && unique <= 24,
    score =
      (recognised ? 100 : 0) +
      Math.max(0, 35 - unique) +
      coverage * 30 -
      uniqueRatio * 35 -
      Math.max(0, averageLength - 24);
  return {
    header,
    options,
    unique,
    coverage,
    averageLength,
    recognised,
    discreteNumeric,
    looksLikeContact:
      emailValues / Math.max(1, nonBlank) > 0.25 ||
      urlValues / Math.max(1, nonBlank) > 0.25,
    score,
    suggested,
    visible: suggested,
  };
}
function detectFilterDefinitions(rows, headers) {
  const excludedColumns = new Set([
    $("postcodeColumn").value,
    $("valueColumn").value,
    ...(comparisonEnabled() ? [$("comparisonColumn").value] : []),
  ]);
  const definitions = headers
    .filter((header) => !excludedColumns.has(header))
    .map((header) => buildFilterDefinition(header, rows))
    .map((definition) => {
      const highCardinality =
        definition.unique > 50 ||
        (definition.unique > 12 && definition.unique / Math.max(1, rows.length) > 0.25);
      const eligible =
        definition.unique >= 2 &&
        !highCardinality &&
        definition.averageLength <= 60 &&
        !definition.looksLikeContact &&
        !excludedFilterHeaders.test(definition.header) &&
        (definition.recognised || definition.discreteNumeric || definition.unique <= 20);
      return { ...definition, eligible };
    });
  const suggested = definitions
    .filter((definition) => definition.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const suggestedHeaders = new Set(suggested.map((definition) => definition.header));
  return definitions.map((definition) => ({
    ...definition,
    suggested: suggestedHeaders.has(definition.header),
    visible: suggestedHeaders.has(definition.header),
  }));
}
function analysisRows() {
  return state.filteredRows;
}
function sourceRowNumber(row) {
  return state.rowNumbers.get(row) || 2;
}

function columnInfo(key) {
  return state.columns.find((column) => column.key === key) || { key, rawHeader: String(key), label: String(key), columnLetter: "" };
}
function columnLabel(key) {
  return columnInfo(key).label;
}
function outputColumnLabel(key) {
  const column = columnInfo(key), duplicates = state.columns.filter((item) => item.label === column.label).length;
  return duplicates > 1 ? `${column.label} (Column ${column.columnLetter})` : column.label;
}
function userFacingRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.startsWith("col_") ? outputColumnLabel(key) : key === "_reason" ? "Reason" : key === "_row" ? "Source row" : key, value])));
}
function loadRows(
  name,
  rows,
  headers,
  detail = null,
  columns = null,
  parsingWarning = "",
  sourceOptions = {},
) {
  const populatedHeaders = headers.filter((header) =>
    rows.some((row) => !blank(row[header])),
  );
  if (!populatedHeaders.length) {
    setFileOperationStatus(
      "This file does not contain any populated columns. Add a header and data rows, then upload it again.",
      "error",
    );
    return false;
  }
  setSampleDataState(Boolean(sourceOptions.sample));
  state.rows = rows;
  state.filteredRows = rows.slice();
  state.mapGenerated = false;
  state.values = new Map();
  state.primaryValues = new Map();
  state.comparisonValues = new Map();
  state.absoluteChanges = new Map();
  state.percentageChanges = new Map();
  if (state.layer) { map.removeLayer(state.layer); state.layer = null; }
  $("legend").classList.add("hidden");
  $("mapInsights").classList.add("hidden");
  $("pinnedDetail").classList.add("hidden");
  $("emptyState").querySelector("strong").textContent = "Your heatmap will appear here";
  $("emptyState").querySelector("span").textContent = "Choose your columns and generate the map when ready.";
  $("emptyState").classList.remove("hidden");
  $("exportButton").disabled = true;
  state.rowNumbers = new Map(rows.map((row, index) => [row, index + 2]));
  state.activeFilters = [];
  state.filterDefinitions = [];
  openFilterHeader = null;
  filterDraft = new Set();
  filterDraftRules = [];
  filterSearch = "";
  state.headers = populatedHeaders;
  state.columns = (columns || headers.map((key, index) => ({ key, rawHeader: String(key), label: String(key), columnLetter: XLSX.utils.encode_col(index) })))
    .filter((column) => populatedHeaders.includes(column.key));
  state.importDetail = detail;
  const excelDetail = detail
    ? `<br>Worksheet: ${escapeHtml(detail.sheetName)} · detected header row ${detail.headerRow}`
    : "";
  $("fileStatus").innerHTML =
    `<strong>${escapeHtml(name)}</strong><br>${rows.length.toLocaleString()} rows found${excelDetail}${parsingWarning ? `<br><span>${escapeHtml(parsingWarning)}</span>` : ""}`;
  $("fileStatus").className = `file-status${parsingWarning ? " is-warning" : ""}`;
  fillSelect($("postcodeColumn"), populatedHeaders, rows);
  fillSelect($("valueColumn"), populatedHeaders, rows);
  fillSelect($("comparisonColumn"), populatedHeaders, rows);
  const suggestions = suggestColumns(rows, populatedHeaders);
  $("postcodeColumn").value = suggestions.postcode;
  $("valueColumn").value = suggestions.value;
  const comparisonCandidate = populatedHeaders
    .filter((header) => header !== suggestions.value && header !== suggestions.postcode)
    .map((header) => ({
      header,
      numericRate:
        rows.filter((row) => !blank(row[header])).filter((row) => numeric(row[header]) !== null)
          .length /
        Math.max(1, rows.filter((row) => !blank(row[header])).length),
    }))
    .sort((a, b) => b.numericRate - a.numericRate)[0];
  if (comparisonCandidate) $("comparisonColumn").value = comparisonCandidate.header;
  state.filterDefinitions = detectRuleDefinitions(rows, populatedHeaders);
  if (!state.valueLabelEdited) $("valueLabel").value = "";
  state.columnConfidenceLow = suggestions.lowConfidence;
  $("mappingControls").classList.remove("hidden");
  document
    .querySelectorAll(".requires-data")
    .forEach((element) => element.classList.remove("hidden"));
  $("previewToggle").setAttribute("aria-expanded", "false");
  $("dataPreview").hidden = true;
  updateComparisonControls();
  renderFilterControls();
  updateFilterContext();
  recommendScale();
  renderPreview();
  renderValidation();
  updatePresentation();
  return true;
}
function fillSelect(sel, headers, rows) {
  sel.innerHTML = headers
    .map((header) => {
      const sample = rows.find((row) => !blank(row[header]))?.[header],
        text = sample === undefined ? "" : String(sample).trim(),
        short = text.length > 24 ? `${text.slice(0, 21)}…` : text,
        type = inferColumnType(header, rows),
        label = `${columnLabel(header)} · ${typeLabel(type)}${short ? ` · e.g. ${short}` : ""}`,
        raw = columnInfo(header).rawHeader;
      return `<option value="${escapeAttr(header)}" title="Raw header: ${escapeAttr(raw)}">${escapeHtml(label)}</option>`;
    })
    .join("");
}
let openFilterHeader = null,
  filterDraft = new Set(),
  filterSearch = "";
function filterDefinition(header) {
  return state.filterDefinitions.find((definition) => definition.header === header);
}
function filterSelectionSummary(definition) {
  if (!state.activeFilters.has(definition.header)) return "All values";
  const count = state.activeFilters.get(definition.header).size;
  if (!count) return "No values selected";
  return `${count} of ${definition.options.length} selected`;
}
function renderFilterOptions(definition) {
  const query = filterSearch.trim().toLocaleLowerCase("en-AU"),
    matching = definition.options.filter((option) =>
      option.label.toLocaleLowerCase("en-AU").includes(query),
    ),
    shown = matching.slice(0, 100);
  return `${definition.options.length > 8 ? `<label class="filter-search"><span class="sr-only">Search ${escapeHtml(definition.header)} values</span><input type="search" data-filter-search placeholder="Search values" value="${escapeAttr(filterSearch)}" /></label>` : ""}<div class="filter-option-actions"><button type="button" data-filter-select-all>Select all</button><button type="button" data-filter-clear-draft>Clear</button></div><div class="filter-option-list">${shown
    .map(
      (option) =>
        `<label><input type="checkbox" data-filter-option="${escapeAttr(option.key)}" ${filterDraft.has(option.key) ? "checked" : ""} /><span>${escapeHtml(option.label)}</span><small>${option.count.toLocaleString()}</small></label>`,
    )
    .join("")}</div>${matching.length > shown.length ? `<small class="field-help">Showing the first ${shown.length} matching values. Refine the search to see more.</small>` : ""}<div class="filter-popover-actions"><button type="button" class="primary" data-filter-apply>Apply filter</button><button type="button" data-filter-clear>Clear filter</button><button type="button" data-filter-close>Cancel</button></div>`;
}
function renderFilterControls() {
  const visible = state.filterDefinitions.filter((definition) => definition.visible);
  $("filterControls").innerHTML = visible.length
    ? visible
        .map(
          (definition) =>
            `<div class="filter-control"><button type="button" class="filter-control-button" data-filter-open="${escapeAttr(definition.header)}" aria-expanded="${openFilterHeader === definition.header}" aria-controls="filterPopover-${escapeAttr(definition.header)}"><span>${escapeHtml(definition.header)}</span><small>${escapeHtml(filterSelectionSummary(definition))}</small></button>${openFilterHeader === definition.header ? `<div id="filterPopover-${escapeAttr(definition.header)}" class="filter-popover" role="dialog" aria-label="Filter ${escapeAttr(definition.header)}">${renderFilterOptions(definition)}</div>` : ""}</div>`,
        )
        .join("")
    : '<p class="field-help">No low-cardinality filter columns were detected automatically.</p>';
  const available = state.filterDefinitions.filter((definition) => !definition.visible);
  $("addFilterField").classList.toggle("hidden", !available.length);
  $("addFilterColumn").innerHTML =
    '<option value="">Choose a column…</option>' +
    available
      .map(
        (definition) =>
          `<option value="${escapeAttr(definition.header)}">${escapeHtml(definition.header)} (${definition.unique.toLocaleString()} values)</option>`,
      )
      .join("");
}
function applyFilters() {
  state.filteredRows = state.rows.filter((row) =>
    [...state.activeFilters].every(([header, selected]) =>
      selected.has(normalisedFilterValue(row[header])),
    ),
  );
  updateFilterContext();
  renderFilterControls();
  renderPreview();
  renderValidation();
  if (state.mapGenerated) buildMap();
  else if (!state.filteredRows.length && state.activeFilters.length)
    clearMappedDisplay("No rows match the current filters.");
  else {
    $("emptyState").querySelector("strong").textContent =
      "Your heatmap will appear here";
    $("emptyState").querySelector("span").textContent =
      "Choose your columns and generate the map when ready.";
    $("displayMeta").textContent = state.activeFilters.length
      ? `${state.filteredRows.length.toLocaleString()} of ${state.rows.length.toLocaleString()} rows included`
      : "Upload data to begin";
  }
}
function clearFilter(header) {
  state.activeFilters.delete(header);
  if (openFilterHeader === header) openFilterHeader = null;
  applyFilters();
}
function resetAllFilters() {
  state.activeFilters.clear();
  openFilterHeader = null;
  filterDraft = new Set();
  filterSearch = "";
  applyFilters();
}
function activeFilterDescription(definition, selected, maximum = 3) {
  const labels = definition.options
    .filter((option) => selected.has(option.key))
    .map((option) => option.label);
  if (!labels.length) return "No values";
  return labels.length > maximum
    ? `${labels.slice(0, maximum).join(", ")} +${labels.length - maximum} more`
    : labels.join(", ");
}
function filterExportNote() {
  const parts = [...state.activeFilters].map(([header, selected]) => {
    const definition = filterDefinition(header);
    return `${header} = ${activeFilterDescription(definition, selected, 4)}`;
  });
  const note = parts.join("; ");
  return note.length > 180 ? `${note.slice(0, 177)}…` : note;
}
function updateFilterContext() {
  const included = state.filteredRows.length,
    uploaded = state.rows.length,
    countText = `${included.toLocaleString()} of ${uploaded.toLocaleString()} rows included`,
    active = [...state.activeFilters];
  $("filterRowCount").textContent = countText;
  $("filterSectionStatus").textContent = active.length
    ? `${active.length} active · ${included.toLocaleString()} rows`
    : "All rows included";
  $("resetFilters").disabled = !active.length;
  $("mapFilterContext").classList.toggle("hidden", !active.length);
  $("mapFilterRowCount").textContent = countText;
  $("activeFilterChips").innerHTML = active
    .map(([header, selected]) => {
      const definition = filterDefinition(header);
      return `<span class="filter-chip"><span>${escapeHtml(header)}: ${escapeHtml(activeFilterDescription(definition, selected))}</span><button type="button" data-clear-filter="${escapeAttr(header)}" aria-label="Clear ${escapeAttr(header)} filter">×</button></span>`;
    })
    .join("");
}
$("filterControls").onclick = (event) => {
  const openButton = event.target.closest("[data-filter-open]");
  if (openButton) {
    const header = openButton.dataset.filterOpen,
      definition = filterDefinition(header);
    openFilterHeader = openFilterHeader === header ? null : header;
    filterSearch = "";
    filterDraft = state.activeFilters.has(header)
      ? new Set(state.activeFilters.get(header))
      : new Set(definition.options.map((option) => option.key));
    renderFilterControls();
    return;
  }
  if (!openFilterHeader) return;
  const definition = filterDefinition(openFilterHeader),
    option = event.target.closest("[data-filter-option]");
  if (option) {
    if (option.checked) filterDraft.add(option.dataset.filterOption);
    else filterDraft.delete(option.dataset.filterOption);
  } else if (event.target.closest("[data-filter-select-all]")) {
    filterDraft = new Set(definition.options.map((item) => item.key));
    renderFilterControls();
  } else if (event.target.closest("[data-filter-clear-draft]")) {
    filterDraft = new Set();
    renderFilterControls();
  } else if (event.target.closest("[data-filter-apply]")) {
    if (filterDraft.size === definition.options.length)
      state.activeFilters.delete(openFilterHeader);
    else state.activeFilters.set(openFilterHeader, new Set(filterDraft));
    openFilterHeader = null;
    applyFilters();
  } else if (event.target.closest("[data-filter-clear]")) {
    clearFilter(openFilterHeader);
  } else if (event.target.closest("[data-filter-close]")) {
    openFilterHeader = null;
    renderFilterControls();
  }
};
$("filterControls").onkeydown = (event) => {
  if (event.key === "Enter" && !event.target.matches("[data-rule-search]")) {
    event.preventDefault();
    updateDraftRuleInput(event.target);
    applyDraftFilters();
  }
};
$("filterControls").oninput = (event) => {
  if (!event.target.matches("[data-filter-search]")) return;
  filterSearch = event.target.value;
  const position = event.target.selectionStart;
  renderFilterControls();
  const input = $("filterControls").querySelector("[data-filter-search]");
  input?.focus();
  input?.setSelectionRange(position, position);
};
$("addFilterColumn").onchange = () => {
  const definition = filterDefinition($("addFilterColumn").value);
  if (!definition) return;
  definition.visible = true;
  renderFilterControls();
};
$("resetFilters").onclick = resetAllFilters;
$("clearAllMapFilters").onclick = resetAllFilters;
$("activeFilterChips").onclick = (event) => {
  const button = event.target.closest("[data-clear-filter]");
  if (button) clearFilter(button.dataset.clearFilter);
};

// General type-aware row-filter builder. The earlier categorical helpers remain
// as upload metadata utilities; these definitions own the current filter UI.
let filterDraftRules = [],
  nextFilterRuleId = 1;
const ruleOperators = {
  postcode: [
    ["starts", "Starts with"], ["eq", "Equals"], ["neq", "Does not equal"],
    ["between", "Between"], ["one_of", "Is one of"], ["blank", "Is blank"], ["not_blank", "Is not blank"],
  ],
  numeric: [
    ["gt", "Greater than"], ["gte", "Greater than or equal to"], ["lt", "Less than"],
    ["lte", "Less than or equal to"], ["eq", "Equals"], ["neq", "Does not equal"],
    ["between", "Between (inclusive)"], ["blank", "Is blank"], ["not_blank", "Is not blank"],
  ],
  text: [
    ["any", "Is any of"], ["not_any", "Is not any of"], ["eq", "Equals"], ["neq", "Does not equal"],
    ["contains", "Contains"], ["not_contains", "Does not contain"], ["starts", "Starts with"],
    ["blank", "Is blank"], ["not_blank", "Is not blank"],
  ],
  date: [
    ["eq", "Equals"], ["before", "Before"], ["after", "After"], ["between", "Between (inclusive)"],
    ["blank", "Is blank"], ["not_blank", "Is not blank"],
  ],
};
function inferColumnType(key, rows = state.rows) {
  if (key === $("postcodeColumn").value) return "postcode";
  const values = rows.map((row) => row[key]).filter((value) => !blank(value)),
    denominator = Math.max(1, values.length),
    name = normalisedHeader(key),
    postcodeRate = values.filter((value) => cleanPostcode(value) !== null).length / denominator,
    numericRate = values.filter((value) => numeric(value) !== null).length / denominator,
    dateRate = values.filter(isRecognisedDateValue).length / denominator;
  if (/(postcode|post code|postal area|\bpoa\b|\bzip\b)/.test(name) && postcodeRate >= 0.5) return "postcode";
  if (key === $("valueColumn").value || (comparisonEnabled() && key === $("comparisonColumn").value) || numericRate >= 0.8) return "numeric";
  if (dateRate >= 0.9) return "date";
  return "text";
}
function validCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
function isRecognisedDateValue(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  const text = String(value ?? "").trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match)
    return validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;
  const first = Number(match[1]),
    second = Number(match[2]),
    year = Number(match[3]);
  if (first > 31 || second > 31 || (first > 12 && second > 12)) return false;
  if (first > 12) return validCalendarDate(year, second, first);
  if (second > 12) return validCalendarDate(year, first, second);
  return validCalendarDate(year, second, first);
}
function typeLabel(type) {
  return ({ postcode: "Postcode", numeric: "Numeric", text: "Text", date: "Date" })[type] || "Text";
}
function detectRuleDefinitions(rows, headers) {
  return headers.map((key) => {
    const categorical = buildFilterDefinition(key, rows);
    return { ...categorical, key, header: key, label: columnLabel(key), type: inferColumnType(key, rows), lowCardinality: categorical.unique <= 50 };
  });
}
function defaultOperator(column) {
  const definition = filterDefinition(column), type = inferColumnType(column);
  return type === "postcode" ? "starts" : type === "numeric" ? "gte" : type === "date" ? "after" : definition?.lowCardinality ? "any" : "contains";
}
function newFilterRule(column) {
  return { id: `filter_${nextFilterRuleId++}`, column, operator: defaultOperator(column), value: "", value2: "", values: new Set() };
}
function cloneRule(rule) {
  return { ...rule, values: new Set(rule.values || []) };
}
function filterDefinition(key) {
  return state.filterDefinitions.find((definition) => definition.key === key || definition.header === key);
}
function operatorOptions(type, selected, definition) {
  const operators = type === "text" && !definition?.lowCardinality
    ? ruleOperators.text.filter(([value]) => !["any", "not_any"].includes(value))
    : ruleOperators[type];
  return operators.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}
function columnOptions(selected = "") {
  return state.headers.map((key) => {
    const type = inferColumnType(key), raw = columnInfo(key).rawHeader;
    return `<option value="${escapeAttr(key)}" ${key === selected ? "selected" : ""} title="Raw header: ${escapeAttr(raw)}">${escapeHtml(columnLabel(key))} · ${typeLabel(type)}</option>`;
  }).join("");
}
function renderRuleInputs(rule, type) {
  const noValue = ["blank", "not_blank"].includes(rule.operator);
  if (noValue) return "";
  const definition = filterDefinition(rule.column);
  if (type === "text" && ["any", "not_any"].includes(rule.operator) && definition?.lowCardinality) {
    return `<label class="filter-search">Search values<input type="search" data-rule-search="${rule.id}" placeholder="Search options" /></label><div class="filter-option-actions"><button type="button" data-rule-select-all="${rule.id}">Select all</button><button type="button" data-rule-select-none="${rule.id}">Clear</button></div><div class="filter-option-list" data-rule-options="${rule.id}">${definition.options.map((option) => `<label data-option-label="${escapeAttr(option.label.toLocaleLowerCase())}"><input type="checkbox" data-rule-option="${rule.id}" value="${escapeAttr(option.key)}" ${rule.values.has(option.key) ? "checked" : ""}><span>${escapeHtml(option.label)}</span><small>${option.count.toLocaleString()}</small></label>`).join("")}</div>`;
  }
  const inputType = type === "date" ? "date" : "text",
    placeholder = type === "postcode" && rule.operator === "one_of" ? "2000, 2007, 3000" : type === "numeric" ? "e.g. 10,000" : "Enter a value";
  if (rule.operator === "between") return `<div class="filter-range"><label>Minimum<input data-rule-value="${rule.id}" type="${inputType}" value="${escapeAttr(rule.value)}" placeholder="Minimum"></label><label>Maximum<input data-rule-value2="${rule.id}" type="${inputType}" value="${escapeAttr(rule.value2)}" placeholder="Maximum"></label></div>`;
  return `<label>Value<input data-rule-value="${rule.id}" type="${inputType}" value="${escapeAttr(rule.value)}" placeholder="${escapeAttr(placeholder)}"></label>`;
}
function renderFilterControls(message = "") {
  $("filterControls").innerHTML = `${message ? `<div class="filter-rule-message" role="alert">${escapeHtml(message)}</div>` : ""}${filterDraftRules.length ? filterDraftRules.map((rule) => {
    const type = inferColumnType(rule.column), definition = filterDefinition(rule.column);
    if (type === "text" && !definition?.lowCardinality && ["any", "not_any"].includes(rule.operator)) rule.operator = "contains";
    if (!ruleOperators[type].some(([operator]) => operator === rule.operator)) rule.operator = defaultOperator(rule.column);
    return `<section class="filter-rule" data-filter-rule="${rule.id}"><div class="filter-rule-top"><label>Column<select data-rule-column="${rule.id}">${columnOptions(rule.column)}</select></label><button type="button" data-rule-remove="${rule.id}" aria-label="Remove ${escapeAttr(columnLabel(rule.column))} filter">Remove</button></div><label>Condition<select data-rule-operator="${rule.id}">${operatorOptions(type, rule.operator, definition)}</select></label>${renderRuleInputs(rule, type)}</section>`;
  }).join("") : '<p class="field-help">No filter rules added. Add any populated column below.</p>'}`;
  $("addFilterField").classList.remove("hidden");
  $("addFilterColumn").innerHTML = `<option value="">Choose a column…</option>${columnOptions()}`;
}
function updateDraftRuleInput(target) {
  const id = target.dataset.ruleColumn || target.dataset.ruleOperator || target.dataset.ruleValue || target.dataset.ruleValue2,
    rule = filterDraftRules.find((item) => item.id === id);
  if (!rule) return;
  if (target.dataset.ruleColumn) {
    rule.column = target.value; rule.operator = defaultOperator(rule.column); rule.value = ""; rule.value2 = ""; rule.values = new Set(); renderFilterControls();
  } else if (target.dataset.ruleOperator) { rule.operator = target.value; rule.value = ""; rule.value2 = ""; rule.values = new Set(); renderFilterControls(); }
  else if (target.dataset.ruleValue) rule.value = target.value;
  else if (target.dataset.ruleValue2) rule.value2 = target.value;
}
function postcodePrefix(value) {
  const digits = String(value ?? "").trim();
  if (!/^\d{1,4}$/.test(digits)) return null;
  return /^[89]/.test(digits) && digits.length < 4 ? `0${digits}` : digits;
}
function postcodeRuleValue(value) {
  const digits = String(value ?? "").trim();
  return /^\d{1,4}$/.test(digits) ? digits.padStart(4, "0") : null;
}
function validateRule(rule) {
  const type = inferColumnType(rule.column), noValue = ["blank", "not_blank"].includes(rule.operator);
  if (noValue || (type === "text" && ["any", "not_any"].includes(rule.operator) && filterDefinition(rule.column).lowCardinality)) return "";
  if (type === "postcode") {
    if (rule.operator === "one_of") return String(rule.value).split(/[,;\s]+/).filter(Boolean).every((value) => postcodeRuleValue(value)) ? "" : `${columnLabel(rule.column)} contains a malformed postcode.`;
    if (rule.operator === "starts") return postcodePrefix(rule.value) ? "" : `${columnLabel(rule.column)} must start with one to four digits.`;
    if (!postcodeRuleValue(rule.value) || (rule.operator === "between" && !postcodeRuleValue(rule.value2))) return `${columnLabel(rule.column)} requires a valid postcode value.`;
  }
  if (type === "numeric" && (numeric(rule.value) === null || (rule.operator === "between" && numeric(rule.value2) === null))) return `${columnLabel(rule.column)} requires a valid numeric value.`;
  if (type === "date" && (!Number.isFinite(Date.parse(rule.value)) || (rule.operator === "between" && !Number.isFinite(Date.parse(rule.value2))))) return `${columnLabel(rule.column)} requires a valid date.`;
  if (type === "text" && !String(rule.value).trim()) return `${columnLabel(rule.column)} requires a filter value.`;
  return "";
}
function rowMatchesRule(row, rule) {
  const raw = row[rule.column], type = inferColumnType(rule.column), operator = rule.operator;
  if (operator === "blank") return blank(raw);
  if (operator === "not_blank") return !blank(raw);
  if (type === "postcode") {
    const postcode = cleanPostcode(raw); if (!postcode) return false;
    if (operator === "starts") return postcode.startsWith(postcodePrefix(rule.value));
    if (operator === "one_of") return new Set(String(rule.value).split(/[,;\s]+/).filter(Boolean).map(postcodeRuleValue)).has(postcode);
    const first = postcodeRuleValue(rule.value);
    if (operator === "between") { const second = postcodeRuleValue(rule.value2); return postcode >= first && postcode <= second; }
    return operator === "eq" ? postcode === first : postcode !== first;
  }
  if (type === "numeric") {
    const value = numeric(raw); if (value === null) return false; const first = numeric(rule.value);
    if (operator === "between") return value >= first && value <= numeric(rule.value2);
    return ({ gt: value > first, gte: value >= first, lt: value < first, lte: value <= first, eq: value === first, neq: value !== first })[operator];
  }
  if (type === "date") {
    const value = Date.parse(raw); if (!Number.isFinite(value)) return false; const first = Date.parse(rule.value);
    if (operator === "between") return value >= first && value <= Date.parse(rule.value2);
    return operator === "before" ? value < first : operator === "after" ? value > first : value === first;
  }
  const value = String(raw ?? "").trim().toLocaleLowerCase("en-AU"), expected = String(rule.value ?? "").trim().toLocaleLowerCase("en-AU"), key = normalisedFilterValue(raw);
  if (operator === "any" || operator === "not_any") { if (!rule.values.size) return false; const included = rule.values.has(key); return operator === "any" ? included : !included; }
  if (operator === "eq") return value === expected;
  if (operator === "neq") return value !== expected;
  if (operator === "contains") return value.includes(expected);
  if (operator === "not_contains") return !value.includes(expected);
  return value.startsWith(expected);
}
function applyFilters() {
  state.filteredRows = state.rows.filter((row) => state.activeFilters.every((rule) => rowMatchesRule(row, rule)));
  updateFilterContext(); renderFilterControls(); renderPreview(); renderValidation();
  if (state.mapGenerated) buildMap();
  else if (!state.filteredRows.length && state.activeFilters.length) clearMappedDisplay("No rows match the current filters.");
  else {
    $("emptyState").querySelector("strong").textContent = "Your heatmap will appear here";
    $("emptyState").querySelector("span").textContent = "Choose your columns and generate the map when ready.";
    $("displayMeta").textContent = state.activeFilters.length ? `${state.filteredRows.length.toLocaleString()} of ${state.rows.length.toLocaleString()} uploaded rows included` : "Upload data to begin";
  }
}
function applyDraftFilters() {
  for (const rule of filterDraftRules) { const error = validateRule(rule); if (error) { renderFilterControls(error); return; } }
  state.activeFilters = filterDraftRules.filter((rule) => !(["any", "not_any"].includes(rule.operator) && rule.values.size === filterDefinition(rule.column).options.length)).map(cloneRule);
  filterDraftRules = state.activeFilters.map(cloneRule); applyFilters();
}
function resetAllFilters() { state.activeFilters = []; filterDraftRules = []; applyFilters(); }
function ruleDescription(rule) {
  const operator = ruleOperators[inferColumnType(rule.column)].find(([value]) => value === rule.operator)?.[1] || rule.operator;
  let value = rule.value;
  if (["any", "not_any"].includes(rule.operator)) { const definition = filterDefinition(rule.column); value = definition.options.filter((option) => rule.values.has(option.key)).map((option) => option.label).slice(0, 3).join(", "); if (rule.values.size > 3) value += ` +${rule.values.size - 3} more`; }
  if (rule.operator === "between") value = `${rule.value} and ${rule.value2}`;
  return `${columnLabel(rule.column)} ${operator.toLocaleLowerCase()}${["blank", "not_blank"].includes(rule.operator) ? "" : ` ${value}`}`;
}
function filterExportNote() { const note = state.activeFilters.map(ruleDescription).join("; "); return note.length > 180 ? `${note.slice(0, 177)}…` : note; }
function updateFilterContext() {
  const included = state.filteredRows.length, uploaded = state.rows.length, countText = `${included.toLocaleString()} of ${uploaded.toLocaleString()} uploaded rows included`;
  $("filterRowCount").textContent = countText; $("filterSectionStatus").textContent = state.activeFilters.length ? `${state.activeFilters.length} active · ${included.toLocaleString()} rows` : "All rows included";
  $("resetFilters").disabled = !state.activeFilters.length; $("mapFilterContext").classList.toggle("hidden", !state.activeFilters.length); $("mapFilterRowCount").textContent = countText;
  $("activeFilterChips").innerHTML = state.activeFilters.map((rule) => `<span class="filter-chip"><span>${escapeHtml(ruleDescription(rule))}</span><button type="button" data-clear-filter="${rule.id}" aria-label="Remove filter">×</button></span>`).join("");
}
$("filterControls").onchange = (event) => {
  if (event.target.matches("[data-rule-option]")) { const rule = filterDraftRules.find((item) => item.id === event.target.dataset.ruleOption); if (event.target.checked) rule.values.add(event.target.value); else rule.values.delete(event.target.value); }
  else updateDraftRuleInput(event.target);
};
$("filterControls").oninput = (event) => {
  if (event.target.matches("[data-rule-search]")) { const query = event.target.value.toLocaleLowerCase(); $("filterControls").querySelectorAll(`[data-rule-options="${event.target.dataset.ruleSearch}"] [data-option-label]`).forEach((label) => { label.hidden = !label.dataset.optionLabel.includes(query); }); }
  else updateDraftRuleInput(event.target);
};
$("filterControls").onclick = (event) => {
  const remove = event.target.closest("[data-rule-remove]"), all = event.target.closest("[data-rule-select-all]"), none = event.target.closest("[data-rule-select-none]");
  if (remove) { filterDraftRules = filterDraftRules.filter((rule) => rule.id !== remove.dataset.ruleRemove); renderFilterControls(); }
  else if (all || none) { const id = (all || none).dataset.ruleSelectAll || (all || none).dataset.ruleSelectNone, rule = filterDraftRules.find((item) => item.id === id), definition = filterDefinition(rule.column); rule.values = all ? new Set(definition.options.map((option) => option.key)) : new Set(); renderFilterControls(); }
};
$("addFilterColumn").onchange = () => { if ($("addFilterColumn").value) { filterDraftRules.push(newFilterRule($("addFilterColumn").value)); renderFilterControls(); } };
$("applyFiltersButton").onclick = applyDraftFilters;
$("resetFilters").onclick = resetAllFilters;
$("clearAllMapFilters").onclick = resetAllFilters;
$("activeFilterChips").onclick = (event) => { const button = event.target.closest("[data-clear-filter]"); if (!button) return; state.activeFilters = state.activeFilters.filter((rule) => rule.id !== button.dataset.clearFilter); filterDraftRules = state.activeFilters.map(cloneRule); applyFilters(); };
function normalisedHeader(header) {
  return String(columnLabel(header))
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function headerTermScore(header, terms) {
  const name = normalisedHeader(header);
  return terms.some((term) => name === term)
    ? 90
    : terms.some((term) => name.includes(term))
      ? 65
      : 0;
}
function suggestColumns(rows, headers) {
  const postcodeTerms = ["postcode", "post code", "poa", "postal area", "zip"],
    valueTerms = [
      "revenue",
      "sales",
      "population",
      "customers",
      "customer",
      "amount",
      "value",
      "persons",
      "person records",
      "total",
    ];
  const ranked = headers.map((header) => {
      const cells = rows
          .map((row) => row[header])
          .filter((value) => !blank(value)),
        denominator = cells.length || 1,
        postcodeRate =
          cells.filter((value) => cleanPostcode(value) !== null).length /
          denominator,
        numericRate =
          cells.filter((value) => numeric(value) !== null).length / denominator,
        postcodeHeader = headerTermScore(header, postcodeTerms),
        valueHeader = headerTermScore(header, valueTerms),
        name = normalisedHeader(header),
        idLike =
          /(^|\s)(id|identifier|code|postcode|post code|poa|zip|year)(\s|$)/.test(
            name,
          ) || /(id|identifier)$/.test(name);
      return {
        header,
        postcodeRate,
        numericRate,
        postcodeHeader,
        valueHeader,
        postcodeScore: postcodeHeader + postcodeRate * 100,
        valueScore: valueHeader + numericRate * 100 - (idLike ? 120 : 0),
      };
    }),
    postcodes = [...ranked].sort((a, b) => b.postcodeScore - a.postcodeScore),
    postcode = postcodes[0],
    valuePool =
      ranked.length > 1
        ? ranked.filter((item) => item.header !== postcode.header)
        : ranked,
    values = [...valuePool].sort((a, b) => b.valueScore - a.valueScore),
    value = values[0],
    postcodeMargin =
      postcode.postcodeScore - (postcodes[1]?.postcodeScore ?? 0),
    valueMargin = value.valueScore - (values[1]?.valueScore ?? 0),
    postcodeLow =
      postcode.postcodeScore < 60 ||
      (postcode.postcodeHeader === 0 && postcode.postcodeRate < 0.5) ||
      (postcode.postcodeHeader === 0 && postcodeMargin < 15),
    valueLow =
      value.valueScore < 60 ||
      (value.valueHeader === 0 && value.numericRate < 0.6) ||
      (value.valueHeader === 0 && valueMargin < 15);
  return {
    postcode: postcode.header,
    value: value.header,
    lowConfidence: postcodeLow || valueLow,
  };
}
function renderPreview() {
  const detail = state.importDetail,
    rows = analysisRows().slice(0, 10),
    headers = state.headers,
    confidence = state.columnConfidenceLow
      ? '<br><span class="selection-warning">Please confirm these columns.</span>'
      : "<br>Suggested from headings and sample values.";
  $("previewDetection").innerHTML =
    `${detail ? `Excel header row: <b>${detail.headerRow}</b><br>` : ""}Postcode column: <b>${escapeHtml(columnLabel($("postcodeColumn").value))}</b><br>Primary value column: <b>${escapeHtml(columnLabel($("valueColumn").value))}</b>${comparisonEnabled() ? `<br>Comparison value column: <b>${escapeHtml(columnLabel($("comparisonColumn").value))}</b><br>Map mode: <b>${escapeHtml(activeModeLabel())}</b>` : ""}${confidence}`;
  $("previewHead").innerHTML =
    `<tr>${headers.map((h) => `<th title="Raw header: ${escapeAttr(columnInfo(h).rawHeader)}">${escapeHtml(columnLabel(h))}</th>`).join("")}</tr>`;
  $("previewBody").innerHTML = rows
    .map(
      (row) =>
        `<tr>${headers.map((h) => `<td title="${escapeAttr(row[h] ?? "")}">${escapeHtml(row[h] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
  $("previewToggle").textContent =
    `Preview: ${rows.length.toLocaleString()} of ${analysisRows().length.toLocaleString()} included rows`;
}
function updateMapModeLabels() {
  const primary = columnLabel($("valueColumn").value) || "Primary value",
    comparison = columnLabel($("comparisonColumn").value) || "Comparison value";
  $("mapMode").querySelector('option[value="primary"]').textContent = primary;
  $("mapMode").querySelector('option[value="comparison"]').textContent =
    comparison;
  if ($("valueLabel")) $("valueLabel").placeholder = `Automatic: ${automaticModeLabel()}`;
}
function updateComparisonControls() {
  const enabled = $("comparisonEnabled").checked;
  $("comparisonColumnField").classList.toggle("hidden", !enabled);
  $("mapModeField").classList.toggle("hidden", !enabled);
  $("comparisonReadiness").classList.toggle("hidden", !enabled);
  if (!enabled) $("mapMode").value = "primary";
  if (
    enabled &&
    $("comparisonColumn").value === $("valueColumn").value
  ) {
    const alternative = [...$("comparisonColumn").options].find(
      (option) =>
        option.value !== $("valueColumn").value &&
        option.value !== $("postcodeColumn").value,
    );
    if (alternative) $("comparisonColumn").value = alternative.value;
  }
  $("aggregationHelp").textContent =
    enabled && $("aggregation").value === "count"
      ? "Count of valid rows is calculated independently for the primary and comparison columns; source values are not summed."
      : "Rows with the same postcode will be combined using this method.";
  updateMapModeLabels();
}
$("comparisonEnabled").onchange = () => {
  updateComparisonControls();
  renderPreview();
  if (state.mapGenerated) buildMap();
};
$("postcodeColumn").onchange = () => {
  renderFilterControls();
  renderPreview();
  renderValidation();
  if (state.mapGenerated) buildMap();
};
$("valueColumn").onchange = () => {
  if (!state.valueLabelEdited) $("valueLabel").value = "";
  if (!state.mapGenerated) recommendScale();
  renderPreview();
  renderValidation();
  updatePresentation();
  updateComparisonControls();
  renderFilterControls();
  if (state.mapGenerated) buildMap();
};
$("comparisonColumn").onchange = () => {
  updateMapModeLabels();
  renderFilterControls();
  renderPreview();
  if (state.mapGenerated) buildMap();
};
$("mapMode").onchange = () => {
  applyScalePreferenceForMode();
  if (state.mapGenerated) buildMap();
};
function blank(v) {
  return v === null || v === undefined || String(v).trim() === "";
}
function cleanPostcode(v) {
  if (blank(v)) return null;
  const groups = String(v).trim().match(/\d+/g) || [];
  if (groups.length !== 1) return null;
  const digits = groups[0];
  if (digits.length === 4) return digits;
  if (digits.length === 3) return digits.padStart(4, "0");
  return null;
}
function numeric(v) {
  if (blank(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim(),
    negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,%\s,]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : null;
}
function selectedNumericValues() {
  const column = $("valueColumn").value;
  return analysisRows()
    .map((row) => numeric(row[column]))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
}
function recommendScale() {
  const values = selectedNumericValues();
  if (!values.length) return;
  $("scaleMode").value = "quantile";
  if ($("paletteMode").value === "blue-red") {
    $("paletteMode").value = "green";
  }
  saveScalePreference("raw");
  updateScaleControls(values);
}
function scalePreferenceGroup(mode = activeMapMode()) {
  return mode === "absolute" || mode === "percentage" ? "change" : "raw";
}
function saveScalePreference(group = state.activeScalePreference) {
  state.scalePreferences[group] = {
    scaleMode: $("scaleMode").value,
    palette: $("paletteMode").value,
    classCount: $("classCount").value,
    reverse: $("reversePalette").checked,
    centre: $("divergingCentre").value,
    initialized: true,
  };
}
function applyScalePreferenceForMode() {
  saveScalePreference();
  const group = scalePreferenceGroup(),
    preference = state.scalePreferences[group];
  state.activeScalePreference = group;
  if (!preference.initialized) {
    preference.scaleMode = "diverging";
    preference.palette = "blue-red";
    preference.centre = "0";
    preference.initialized = true;
  }
  $("scaleMode").value = preference.scaleMode;
  $("paletteMode").value = preference.palette;
  $("classCount").value = preference.classCount;
  $("reversePalette").checked = preference.reverse;
  $("divergingCentre").value = preference.centre;
  updateScaleControls();
}
function updateScaleControls(values = selectedNumericValues()) {
  if (!values.length) return false;
  const min = values[0],
    max = values[values.length - 1],
    logOption = $("scaleMode").querySelector('option[value="log"]');
  logOption.disabled = min <= 0;
  let mode = $("scaleMode").value,
    warning = "";
  if (mode === "log" && min <= 0) {
    $("scaleMode").value = "quantile";
    mode = "quantile";
    warning =
      "Logarithmic scales require every value to be greater than zero. Quantiles are being used instead.";
  }
  $("classCountField").classList.toggle("hidden", mode === "continuous");
  $("divergingCentreField").classList.toggle("hidden", mode !== "diverging");
  const centre = Number($("divergingCentre").value);
  if (mode === "diverging" && !Number.isFinite(centre)) {
    warning = "Enter a valid centre for the diverging scale.";
  } else if (mode === "diverging" && !(min < centre && max > centre)) {
    warning = "All values are on one side of the selected centre; the unused half of the diverging palette is retained for context.";
  } else if (min < 0 && max > 0 && mode !== "diverging") {
    warning = "A diverging scale is recommended because the values cross zero.";
  }
  $("scaleWarning").textContent = warning;
  return !(mode === "diverging" && !Number.isFinite(centre));
}

function calculateValidation() {
  const pc = $("postcodeColumn").value,
    val = $("valueColumn").value,
    counts = new Map(),
    submittedPostcodes = new Set(),
    invalidRows = [],
    validEntries = [];
  let blankPostcodes = 0,
    invalidPostcodes = 0,
    blankValues = 0,
    nonNumericValues = 0;
  const rows = analysisRows();
  rows.forEach((row) => {
    const rawPostcode = row[pc],
      rawValue = row[val],
      postcodeBlank = blank(rawPostcode),
      valueBlank = blank(rawValue),
      postcode = cleanPostcode(rawPostcode),
      value = numeric(rawValue),
      reasons = [];
    if (postcodeBlank) {
      blankPostcodes++;
      reasons.push("Blank postcode");
    } else if (!postcode) {
      invalidPostcodes++;
      reasons.push("Invalid postcode");
    }
    if (valueBlank) {
      blankValues++;
      reasons.push("Blank value");
    } else if (value === null) {
      nonNumericValues++;
      reasons.push("Non-numeric value");
    }
    if (postcode) submittedPostcodes.add(postcode);
    if (reasons.length) {
      invalidRows.push({
        ...row,
        Reason: reasons.join("; "),
        "Source row": sourceRowNumber(row),
      });
      return;
    }
    counts.set(postcode, (counts.get(postcode) || 0) + 1);
    validEntries.push({ row, postcode, value, sourceRow: sourceRowNumber(row) });
  });
  const unique = [...submittedPostcodes],
    validCodes = state.geo
      ? new Set(state.geo.features.map((f) => String(f.properties.POA_CODE21)))
      : null,
    unmatchedCodes = validCodes
      ? new Set(unique.filter((code) => !validCodes.has(code)))
      : new Set(),
    unmatchedRows = validCodes
      ? validEntries
          .filter((entry) => unmatchedCodes.has(entry.postcode))
          .map((entry) => ({
            ...entry.row,
            Reason: "No matching ABS Postal Area",
            "Source row": entry.sourceRow,
          }))
      : [],
    duplicateRows = [...counts.values()].reduce(
      (total, count) => total + Math.max(0, count - 1),
      0,
    ),
    duplicatePostcodes = [...counts.values()].filter(
      (count) => count > 1,
    ).length,
    matchedCount = validCodes ? unique.length - unmatchedCodes.size : 0,
    matchedPercentage =
      validCodes && unique.length ? (matchedCount / unique.length) * 100 : null,
    mappedRows = validCodes ? validEntries.length - unmatchedRows.length : null,
    mappedRowPercentage =
      mappedRows !== null && rows.length
        ? (mappedRows / rows.length) * 100
        : null;
  return {
    uploadedRows: state.rows.length,
    totalRows: rows.length,
    validRows: validEntries.length,
    blankPostcodes,
    invalidPostcodes,
    blankValues,
    nonNumericValues,
    duplicateRows,
    duplicatePostcodes,
    uniquePostcodes: unique.length,
    unmatchedPostcodes: validCodes ? unmatchedCodes.size : null,
    matchedPercentage,
    matchedPostcodes: validCodes ? matchedCount : null,
    mappedRows,
    mappedRowPercentage,
    attentionRows: new Set([...invalidRows, ...unmatchedRows].map((row) => row["Source row"])).size,
    invalidRows,
    unmatchedRows,
  };
}
function renderValidation() {
  const result = calculateValidation();
  state.validation = result;
  const mappedPostcodes = state.mapGenerated ? state.values.size : null,
    aggregation = aggregationLabels[$("aggregation").value],
    group = (title, metrics, className = "") => `<section class="status-group ${className}"><h4>${escapeHtml(title)}</h4><dl>${metrics.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl></section>`;
  $("validationMetrics").innerHTML =
    group("Included in the analysis", [
      ["Uploaded rows", result.uploadedRows.toLocaleString()],
      ["Included after filters", result.totalRows.toLocaleString()],
      ["Usable rows", result.mappedRows === null ? "Checking…" : result.mappedRows.toLocaleString()],
      ["Mapped postcodes", mappedPostcodes === null ? "Not generated yet" : mappedPostcodes.toLocaleString()],
    ]) +
    group("Rows needing attention", [
      ["Blank postcode rows", result.blankPostcodes.toLocaleString()],
      ["Invalid postcode rows", result.invalidPostcodes.toLocaleString()],
      ["Blank value rows", result.blankValues.toLocaleString()],
      ["Non-numeric value rows", result.nonNumericValues.toLocaleString()],
      ["Unmatched postcodes", result.unmatchedPostcodes === null ? "Checking…" : result.unmatchedPostcodes.toLocaleString()],
      ["Unique excluded rows", result.attentionRows.toLocaleString()],
    ], result.attentionRows ? "status-group-warning" : "") +
    group("Geography matching", [["ABS geography", result.uniquePostcodes === 0 ? "No valid postcodes" : result.unmatchedPostcodes === 0 ? "All valid postcodes matched the ABS geography" : `${result.matchedPostcodes.toLocaleString()} of ${result.uniquePostcodes.toLocaleString()} valid postcodes matched`]], result.unmatchedPostcodes ? "status-group-warning" : "") +
    group("Duplicate handling", [
      ["Duplicate input rows", result.duplicateRows.toLocaleString()],
      ["Postcodes affected", result.duplicatePostcodes.toLocaleString()],
      ["Aggregation", aggregation],
    ]);
  state.statusAffectedRows = [...result.invalidRows, ...result.unmatchedRows];
  const geographyText =
      result.matchedPostcodes === null
        ? "Waiting for ABS geography"
        : result.uniquePostcodes === 0
          ? "No valid postcodes were available to match"
          : result.unmatchedPostcodes === 0
            ? `All ${result.uniquePostcodes.toLocaleString()} valid postcode${result.uniquePostcodes === 1 ? "" : "s"} matched ABS geography`
            : `${result.matchedPostcodes.toLocaleString()} of ${result.uniquePostcodes.toLocaleString()} valid postcodes matched ABS geography (${result.matchedPercentage.toFixed(1)}%)`,
    mappedText =
      result.mappedRows === null
        ? "Checking mapped rows…"
        : `${result.mappedRows.toLocaleString()} of ${result.totalRows.toLocaleString()} rows mapped`,
    usableText =
      result.totalRows === 0 && state.activeFilters.length
        ? "No rows match the current filters"
        : result.mappedRows === 0
        ? "No rows are usable"
        : result.mappedRowPercentage === null
          ? "Calculating usability…"
          : `${result.mappedRowPercentage.toFixed(1)}% usable`,
    attentionText = `${result.attentionRows.toLocaleString()} row${result.attentionRows === 1 ? " needs" : "s need"} attention`,
    allSuccessful =
      result.mappedRows === result.totalRows && result.unmatchedPostcodes === 0,
    overviewTone =
      result.mappedRows === 0 ? "error" : allSuccessful ? "success" : "warning";
  $("validationOverview").className =
    `validation-overview validation-overview-${overviewTone}`;
  $("validationOverview").innerHTML =
    `<div><strong>${result.totalRows.toLocaleString()} rows included</strong><span>${escapeHtml(usableText)} · ${escapeHtml(attentionText)}</span></div>`;
  const warnings = [];
  if (result.totalRows === 0 && state.activeFilters.length)
    warnings.push("No rows match the current filters. Clear a filter or reset all filters to continue.");
  if (result.invalidRows.length)
    warnings.push(
      `${result.invalidRows.length.toLocaleString()} row${result.invalidRows.length === 1 ? " has" : "s have"} invalid or missing input.`,
    );
  if (result.duplicateRows)
    warnings.push(
      `${result.duplicateRows.toLocaleString()} duplicate input row${result.duplicateRows === 1 ? " will" : "s will"} be combined across ${result.duplicatePostcodes.toLocaleString()} postcode${result.duplicatePostcodes === 1 ? "" : "s"}.`,
    );
  if (result.unmatchedPostcodes)
    warnings.push(
      `${result.unmatchedPostcodes.toLocaleString()} valid postcode${result.unmatchedPostcodes === 1 ? " does" : "s do"} not match the ABS geography.`,
    );
  $("validationWarnings").innerHTML = warnings.length
    ? warnings
        .map((w) => `<div class="validation-warning">${escapeHtml(w)}</div>`)
        .join("")
    : '<div class="validation-ok">No validation warnings found.</div>';
  $("validationStatus").className =
    `validation-compact validation-compact-${overviewTone}`;
  $("validationStatus").textContent = state.mapGenerated
    ? `${state.values.size.toLocaleString()} postcodes mapped · ${attentionText}`
    : result.mappedRows > 0
      ? `${result.mappedRows.toLocaleString()} rows ready to map${result.attentionRows ? ` · ${attentionText}` : ""}`
      : result.totalRows === 0 && state.activeFilters.length
        ? "No rows match current filters"
        : "No usable rows";
  $("validationStatus").setAttribute(
    "aria-label",
    `${mappedText}. ${usableText}. ${attentionText}. ${geographyText}.`,
  );
  $("downloadInvalid").disabled = !result.invalidRows.length;
  $("downloadValidationUnmatched").disabled = !result.unmatchedRows.length;
  $("unmatchedPanel").classList.toggle("hidden", !state.statusAffectedRows.length);
  renderUnmatchedPreview();
  updateActionStatus();
}

function updateActionStatus() {
  const result = state.validation,
    usable = state.mapGenerated ? state.values.size : result?.mappedRows || 0,
    geographyReady = operationState.geography === "ready";
  $("buildButton").disabled =
    !usable ||
    !geographyReady ||
    operationState.uploadBusy ||
    operationState.buildRunning;
  $("buildButton").textContent = state.mapGenerated ? "Update map" : "Generate map";
  $("actionStatus").textContent = operationState.uploadBusy
    ? "Reading uploaded data…"
    : operationState.buildRunning
      ? operationState.buildMessage || (state.mapGenerated ? "Updating map…" : "Preparing map…")
      : operationState.geography === "loading"
        ? "Loading postcode boundaries…"
        : operationState.geography === "error"
          ? "Postcode boundaries unavailable"
          : operationState.buildMessage
            ? operationState.buildMessage
            : !usable
    ? state.activeFilters.length && !analysisRows().length
      ? "No rows match current filters"
      : "No usable rows"
    : state.mapGenerated
      ? `${state.values.size.toLocaleString()} postcodes mapped`
      : `${usable.toLocaleString()} rows ready`;
}

$("buildButton").onclick = buildMap;
function currentValueLabel() {
  return $("valueLabel").value;
}
function setEditableText(display, value, placeholder) {
  display.replaceChildren();
  const text = document.createElement("span");
  text.textContent = value || placeholder;
  if (!value) text.className = "placeholder-text";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✎";
  display.append(text, icon);
}
function updatePresentation() {
  setEditableText($("displayTitle"), $("mapTitle").value, "Add map title");
  setEditableText($("displaySubtitle"), $("mapSubtitle").value, "Add subtitle");
  setEditableText($("displaySource"), $("sourceNote").value, "Add source note");
}
function wireInlineEditor(displayId, inputId) {
  const display = $(displayId),
    input = $(inputId);
  let original = "",
    editing = false;
  function finish(save) {
    if (!editing) return;
    editing = false;
    if (!save) input.value = original;
    input.classList.add("hidden");
    display.classList.remove("hidden");
    updatePresentation();
    if (state.mapGenerated) {
      if (inputId === "mapTitle" || inputId === "mapSubtitle")
        map.invalidateSize({ pan: false });
    }
  }
  display.onclick = () => {
    original = input.value;
    editing = true;
    display.classList.add("hidden");
    input.classList.remove("hidden");
    input.focus();
    input.select();
  };
  input.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
      display.focus();
    }
  };
  input.onblur = () => finish(true);
}
wireInlineEditor("displayTitle", "mapTitle");
wireInlineEditor("displaySubtitle", "mapSubtitle");
wireInlineEditor("displaySource", "sourceNote");
updatePresentation();
$("valueLabel").onchange = () => {
  state.valueLabelEdited = Boolean($("valueLabel").value.trim());
  $("valueLabel").value = $("valueLabel").value.trim();
  if (state.mapGenerated) buildMap();
};
const aggregationLabels = {
  sum: "Sum",
  avg: "Average",
  count: "Count of valid rows",
  min: "Minimum",
  max: "Maximum",
};
function aggregateValues(values, method) {
  if (method === "avg")
    return values.reduce((a, b) => a + b, 0) / values.length;
  if (method === "count") return values.length;
  if (method === "min") return Math.min(...values);
  if (method === "max") return Math.max(...values);
  return values.reduce((a, b) => a + b, 0);
}
function formatValue(value) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "No value";
  const decimals = Number($("decimalPlaces").value),
    compact = $("compactNotation").checked,
    options = {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? "compact" : "standard",
      useGrouping: $("thousandsSeparator").checked,
    },
    formatted = new Intl.NumberFormat("en-AU", options).format(Math.abs(value)),
    sign = value < 0 ? "-" : "",
    mode = $("numberFormat").value;
  if (mode === "currency") {
    const selected = $("currencySymbol").value,
      symbol =
        selected === "custom"
          ? $("customCurrencySymbol").value || "$"
          : selected;
    return `${sign}${symbol}${formatted}`;
  }
  if (mode === "percentage") return `${sign}${formatted}%`;
  return `${sign}${formatted}`;
}
function comparisonEnabled() {
  return $("comparisonEnabled").checked;
}
function activeMapMode() {
  return comparisonEnabled() ? $("mapMode").value : "primary";
}
function primaryLabel() {
  return columnLabel($("valueColumn").value) || "Primary value";
}
function comparisonLabel() {
  return columnLabel($("comparisonColumn").value) || "Comparison value";
}
function automaticModeLabel(mode = activeMapMode()) {
  if (mode === "comparison") return comparisonLabel();
  if (mode === "absolute") return "Absolute change";
  if (mode === "percentage") return "Percentage change";
  return primaryLabel();
}
function activeModeLabel(mode = activeMapMode()) {
  return state.valueLabelEdited && currentValueLabel().trim()
    ? currentValueLabel().trim()
    : automaticModeLabel(mode);
}
function formatPercentageChange(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  const decimals = Number($("decimalPlaces").value);
  return new Intl.NumberFormat("en-AU", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: $("thousandsSeparator").checked,
  }).format(value);
}
function formatActiveValue(value, mode = activeMapMode()) {
  return mode === "percentage"
    ? formatPercentageChange(value)
    : formatValue(value);
}
function comparisonTooltip(postcode) {
  const primary = state.primaryValues.get(postcode),
    comparison = state.comparisonValues.get(postcode),
    absolute = state.absoluteChanges.get(postcode),
    percentage = state.percentageChanges.get(postcode),
    row = (label, value, formatter = formatValue) =>
      `<br>${escapeHtml(label)}: ${value === undefined ? "Unavailable" : escapeHtml(formatter(value))}`;
  return (
    `<br><span class="tooltip-direction">Change direction: ${escapeHtml(comparisonLabel())} minus ${escapeHtml(primaryLabel())}</span>` +
    row(primaryLabel(), primary) +
    row(comparisonLabel(), comparison) +
    row("Absolute change", absolute) +
    row("Percentage change", percentage, formatPercentageChange)
  );
}
function activeLegendLabel() {
  const mode = activeMapMode(),
    aggregation = aggregationLabels[$("aggregation").value];
  if (mode === "absolute" || mode === "percentage")
    return `${activeModeLabel(mode)} (${comparisonLabel()} minus ${primaryLabel()})`;
  return `${activeModeLabel(mode)} · ${aggregation}`;
}
function aggregateSeries(column, postcodeColumn, method, validCodes) {
  const buckets = new Map();
  analysisRows().forEach((row) => {
    const postcode = cleanPostcode(row[postcodeColumn]),
      value = numeric(row[column]);
    if (!postcode || value === null) return;
    if (!buckets.has(postcode)) buckets.set(postcode, []);
    buckets.get(postcode).push(value);
  });
  const result = new Map();
  buckets.forEach((values, postcode) => {
    if (validCodes.has(postcode))
      result.set(postcode, aggregateValues(values, method));
  });
  return result;
}
function calculateComparisonSeries() {
  const absolute = new Map(),
    percentage = new Map();
  let both = 0,
    primaryOnly = 0,
    comparisonOnly = 0,
    zeroPrimary = 0;
  const postcodes = new Set([
    ...state.primaryValues.keys(),
    ...state.comparisonValues.keys(),
  ]);
  postcodes.forEach((postcode) => {
    const hasPrimary = state.primaryValues.has(postcode),
      hasComparison = state.comparisonValues.has(postcode);
    if (hasPrimary && hasComparison) {
      both += 1;
      const primary = state.primaryValues.get(postcode),
        comparison = state.comparisonValues.get(postcode),
        difference = comparison - primary;
      absolute.set(postcode, difference);
      if (primary === 0) zeroPrimary += 1;
      else percentage.set(postcode, difference / primary);
    } else if (hasPrimary) primaryOnly += 1;
    else comparisonOnly += 1;
  });
  state.absoluteChanges = absolute;
  state.percentageChanges = percentage;
  state.comparisonReadiness = {
    both,
    primaryOnly,
    comparisonOnly,
    unavailableOneSide: primaryOnly + comparisonOnly,
    zeroPrimary,
  };
}
function renderComparisonReadiness() {
  if (!comparisonEnabled() || !state.comparisonReadiness) return;
  const result = state.comparisonReadiness;
  $("comparisonReadinessSummary").textContent =
    `${result.both.toLocaleString()} postcodes compared · ${result.unavailableOneSide.toLocaleString()} unavailable because one side is missing · ${result.zeroPrimary.toLocaleString()} percentage changes unavailable because baseline equals zero`;
  $("comparisonReadinessMetrics").innerHTML = [
    ["Postcodes with both values", result.both],
    ["Baseline only", result.primaryOnly],
    ["Comparison only", result.comparisonOnly],
    ["Baseline equals zero", result.zeroPrimary],
  ]
    .map(([label, value]) => `<div><strong>${value.toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`)
    .join("");
}
function renderPinnedDetail() {
  const postcode = state.pinnedPostcode;
  if (!postcode || !state.values.has(postcode)) {
    $("pinnedDetail").classList.add("hidden");
    return;
  }
  const label = activeLegendLabel();
  $("pinnedPostcode").textContent = `Postcode ${postcode}`;
  $("pinnedValue").textContent =
    `${label}: ${formatActiveValue(state.values.get(postcode))}`;
  $("pinnedDetail").classList.remove("hidden");
}
function clearMappedDisplay(message) {
  state.values = new Map();
  state.primaryValues = new Map();
  state.comparisonValues = new Map();
  state.absoluteChanges = new Map();
  state.percentageChanges = new Map();
  if (!analysisRows().length) {
    state.comparisonReadiness = {
      both: 0,
      primaryOnly: 0,
      comparisonOnly: 0,
      unavailableOneSide: 0,
      zeroPrimary: 0,
    };
    renderComparisonReadiness();
  }
  if (state.layer) {
    map.removeLayer(state.layer);
    state.layer = null;
  }
  $("legend").classList.add("hidden");
  $("mapInsights").classList.add("hidden");
  $("pinnedDetail").classList.add("hidden");
  $("exportButton").disabled = true;
  const empty = $("emptyState");
  empty.querySelector("strong").textContent = message;
  empty.querySelector("span").textContent = "Adjust or reset the filters to include rows again.";
  empty.classList.remove("hidden");
  $("displayMeta").textContent = `${analysisRows().length.toLocaleString()} of ${state.rows.length.toLocaleString()} rows included`;
  updateActionStatus();
}
function buildMap() {
  operationState.buildGeneration++;
  operationState.buildPending = true;
  operationState.buildMessage = "";
  void runMapBuildQueue();
}
async function runMapBuildQueue() {
  if (operationState.buildRunning) return;
  operationState.buildRunning = true;
  $("exportButton").disabled = true;
  try {
    while (operationState.buildPending) {
      operationState.buildPending = false;
      const generation = operationState.buildGeneration;
      operationState.buildMessage = state.mapGenerated
        ? "Updating map…"
        : "Preparing map…";
      updateActionStatus();
      await nextFrame();
      await nextFrame();
      if (
        generation !== operationState.buildGeneration ||
        operationState.uploadBusy
      )
        continue;
      try {
        performMapBuild();
      } catch (_error) {
        operationState.buildMessage =
          "The map could not be updated. Check the selected columns and try again.";
      }
    }
  } finally {
    operationState.buildRunning = false;
    if (
      operationState.buildMessage === "Preparing map…" ||
      operationState.buildMessage === "Updating map…"
    )
      operationState.buildMessage = "";
    $("exportButton").disabled = !state.mapGenerated || !state.values.size;
    updateActionStatus();
  }
}
function performMapBuild() {
  if (!state.geo || operationState.geography !== "ready") {
    operationState.buildMessage =
      "Postcode boundaries are still loading. Please wait a moment and try again.";
    return;
  }
  const pc = $("postcodeColumn").value,
    val = $("valueColumn").value,
    agg = $("aggregation").value,
    aggLabel = aggregationLabels[agg],
    unmatched = [];
  const rows = analysisRows();
  if (!rows.length && state.activeFilters.length) {
    clearMappedDisplay("No rows match the current filters.");
    return;
  }
  rows.forEach((row) => {
    const p = cleanPostcode(row[pc]),
      n = numeric(row[val]);
    if (!p || n === null) {
      unmatched.push({
        ...row,
        _reason: !p ? "Invalid postcode" : "Invalid value",
        _row: sourceRowNumber(row),
      });
      return;
    }
  });
  const validCodes = new Set(
    state.geo.features.map((f) => String(f.properties.POA_CODE21)),
  );
  const submittedPrimary = aggregateSeries(val, pc, agg, new Set(rows.map((row) => cleanPostcode(row[pc])).filter(Boolean)));
  for (const [p] of submittedPrimary)
    if (!validCodes.has(p)) {
      unmatched.push({
        [pc]: p,
        [val]: submittedPrimary.get(p),
        _reason: "No matching Postal Area",
      });
    }
  state.primaryValues = aggregateSeries(val, pc, agg, validCodes);
  state.comparisonValues = comparisonEnabled()
    ? aggregateSeries($("comparisonColumn").value, pc, agg, validCodes)
    : new Map();
  calculateComparisonSeries();
  const series = {
    primary: state.primaryValues,
    comparison: state.comparisonValues,
    absolute: state.absoluteChanges,
    percentage: state.percentageChanges,
  };
  const values = series[activeMapMode()] || state.primaryValues;
  state.values = values;
  state.unmatched = unmatched;
  renderComparisonReadiness();
  const nums = [...values.values()].sort((a, b) => a - b);
  if (!nums.length) {
    clearMappedDisplay("No usable rows are available for this map view.");
    operationState.buildMessage =
      activeMapMode() === "percentage" && state.comparisonReadiness?.zeroPrimary
        ? "Percentage change is unavailable because every compared baseline is zero."
        : "No usable postcode and value pairs were found. Check the selected columns and comparison summary.";
    return;
  }
  if (!updateScaleControls(nums)) {
    operationState.buildMessage =
      "The selected scale cannot be used with these values. Choose another scale and try again.";
    return;
  }
  const scaleMode = $("scaleMode").value,
    centre = Number($("divergingCentre").value),
    classCount = scaleMode === "continuous" ? 9 : Number($("classCount").value);
  if (scaleMode === "diverging" && $("paletteMode").value !== "blue-red")
    $("paletteMode").value = "blue-red";
  if (scaleMode !== "diverging" && $("paletteMode").value === "blue-red")
    $("paletteMode").value = "green";
  state.scaleMode = scaleMode;
  state.scaleMin = nums[0];
  state.scaleMax = nums[nums.length - 1];
  state.scaleCentre = centre;
  state.palette = createPalette(
    $("paletteMode").value,
    classCount,
    $("reversePalette").checked,
  );
  state.breaks = makeBreaks(nums, scaleMode, classCount, centre);
  if (state.layer) map.removeLayer(state.layer);
  if (state.noDataLayer) state.noDataLayer.setStyle(noDataStyle());
  else
    state.noDataLayer = L.geoJSON(state.geo, {
      renderer: L.svg({ padding: 0.5 }),
      interactive: false,
      style: noDataStyle(),
    }).addTo(map);
  state.layer = L.geoJSON(state.geo, {
    renderer: L.svg({ padding: 0.5 }),
    filter: (f) => values.has(String(f.properties.POA_CODE21)),
    style: postcodeStyle,
    onEachFeature: (f, l) => {
      const p = String(f.properties.POA_CODE21),
        v = values.get(p);
      const label = activeLegendLabel();
      l.bindTooltip(
        `<strong>Postcode ${p}</strong><br>${escapeHtml(label)}: <span class="tooltip-value">${escapeHtml(formatActiveValue(v))}</span>${comparisonEnabled() ? comparisonTooltip(p) : ""}`,
        { sticky: true },
      );
      l.on({
        mouseover: (e) =>
          e.target.setStyle({
            weight: Math.max(1.1, appearanceSettings().boundaryWidth + 0.6),
            color: "#4f5f58",
            opacity: 0.9,
            fillOpacity: Math.min(
              0.88,
              appearanceSettings().fillOpacity + 0.12,
            ),
          }),
        mouseout: (e) => state.layer.resetStyle(e.target),
        click: () => {
          state.pinnedPostcode = p;
          renderPinnedDetail();
        },
      });
    },
  }).addTo(map);
  map.fitBounds(state.layer.getBounds(), {
    padding: [12, 12],
    animate: false,
  });
  state.mapGenerated = true;
  $("emptyState").classList.add("hidden");
  $("exportButton").disabled = false;
  updatePresentation();
  $("displayMeta").textContent =
    `${values.size.toLocaleString()} postcodes mapped · ${analysisRows().length.toLocaleString()} of ${state.rows.length.toLocaleString()} rows included · ${activeModeLabel()}${state.validation.attentionRows ? ` · ${state.validation.attentionRows.toLocaleString()} rows excluded` : ""}`;
  renderLegend();
  renderSummary();
  renderPinnedDetail();
  operationState.buildMessage = "";
}
$("aggregation").onchange = () => {
  updateComparisonControls();
  renderValidation();
  if (state.mapGenerated) buildMap();
};
function scaleControlsChanged(event) {
  const group = scalePreferenceGroup();
  if (event.target.id === "scaleMode") {
    if ($("scaleMode").value === "diverging")
      $("paletteMode").value = "blue-red";
    else if ($("paletteMode").value === "blue-red")
      $("paletteMode").value = "green";
  }
  if (event.target.id === "paletteMode") {
    if ($("paletteMode").value === "blue-red")
      $("scaleMode").value = "diverging";
    else if ($("scaleMode").value === "diverging")
      $("scaleMode").value = "quantile";
  }
  saveScalePreference(group);
  const ready = updateScaleControls();
  if (state.mapGenerated && ready) buildMap();
}
[
  "scaleMode",
  "paletteMode",
  "classCount",
  "reversePalette",
  "divergingCentre",
].forEach((id) => ($(id).onchange = scaleControlsChanged));
function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16),
  );
}
function interpolateHex(a, b, amount) {
  const start = hexToRgb(a),
    end = hexToRgb(b),
    channels = start.map((value, i) =>
      Math.round(value + (end[i] - value) * amount),
    );
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
function paletteAt(stops, position) {
  const scaled = Math.max(0, Math.min(1, position)) * (stops.length - 1),
    index = Math.min(stops.length - 2, Math.floor(scaled));
  return interpolateHex(stops[index], stops[index + 1], scaled - index);
}
function createPalette(name, count, reverse) {
  const stops = paletteDefinitions[name] || paletteDefinitions.green,
    colours = Array.from({ length: count }, (_, i) =>
      paletteAt(stops, count === 1 ? 0.5 : i / (count - 1)),
    );
  return reverse ? colours.reverse() : colours;
}
function makeBreaks(nums, mode, k, centre = 0) {
  const min = nums[0],
    max = nums[nums.length - 1];
  if (min === max) return Array(k + 1).fill(min);
  if (mode === "quantile")
    return Array.from(
      { length: k + 1 },
      (_, i) =>
        nums[
          Math.min(nums.length - 1, Math.floor((i * (nums.length - 1)) / k))
        ],
    );
  if (mode === "log") {
    const start = Math.log(min),
      end = Math.log(max);
    return Array.from({ length: k + 1 }, (_, i) =>
      Math.exp(start + ((end - start) * i) / k),
    );
  }
  if (mode === "diverging") {
    const span = Math.max(Math.abs(min - centre), Math.abs(max - centre));
    if (span === 0) return Array(k + 1).fill(centre);
    return Array.from(
      { length: k + 1 },
      (_, i) => centre - span + ((span * 2) * i) / k,
    );
  }
  return Array.from({ length: k + 1 }, (_, i) => min + ((max - min) * i) / k);
}
function continuousPosition(value) {
  if (state.scaleMin === state.scaleMax) return 0.5;
  return (value - state.scaleMin) / (state.scaleMax - state.scaleMin);
}
function colour(v) {
  if (state.scaleMin === state.scaleMax)
    return state.palette[Math.floor(state.palette.length / 2)];
  if (state.scaleMode === "continuous")
    return paletteAt(state.palette, continuousPosition(v));
  let index =
    state.breaks.findIndex((breakValue, i) => i > 0 && v <= breakValue) - 1;
  if (index < 0) index = state.palette.length - 1;
  return state.palette[Math.min(state.palette.length - 1, Math.max(0, index))];
}
function setLegendPosition(position) {
  const allowed = ["top-left", "top-right", "bottom-left", "bottom-right"];
  state.legendPosition = allowed.includes(position) ? position : "bottom-right";
  $("legend").classList.remove(...allowed.map((item) => `legend-${item}`));
  $("legend").classList.add(`legend-${state.legendPosition}`);
  $("legendPosition").value = state.legendPosition;
}
$("legendPosition").onchange = () =>
  setLegendPosition($("legendPosition").value);
function wireLegendDrag() {
  const handle = $("legend").querySelector(".legend-drag-handle");
  if (!handle) return;
  handle.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    map.dragging.disable();
  };
  handle.onpointerup = (event) => {
    const bounds = document.querySelector(".map-shell").getBoundingClientRect(),
      horizontal = event.clientX < bounds.left + bounds.width / 2 ? "left" : "right",
      vertical = event.clientY < bounds.top + bounds.height / 2 ? "top" : "bottom";
    setLegendPosition(`${vertical}-${horizontal}`);
    if (handle.hasPointerCapture(event.pointerId))
      handle.releasePointerCapture(event.pointerId);
    map.dragging.enable();
  };
  handle.onpointercancel = () => map.dragging.enable();
  L.DomEvent.disableClickPropagation($("legend"));
  L.DomEvent.disableScrollPropagation($("legend"));
}
function renderLegend() {
  const label = activeLegendLabel();
  const entries =
    state.scaleMin === state.scaleMax
      ? `<div class="legend-row"><span class="swatch" style="background:${state.palette[Math.floor(state.palette.length / 2)]}"></span><span>${escapeHtml(formatActiveValue(state.scaleMin))}</span></div>`
      : state.palette
          .map(
            (c, i) =>
              `<div class="legend-row"><span class="swatch" style="background:${c}"></span><span>${escapeHtml(formatActiveValue(state.breaks[i]))} – ${escapeHtml(formatActiveValue(state.breaks[i + 1]))}</span></div>`,
          )
          .join("");
  $("legend").innerHTML =
    `<div class="legend-drag-handle" title="Drag to another corner">Drag legend</div><div class="legend-title"><button class="legend-title-button" type="button" aria-label="Edit value label"><span>${escapeHtml(label)}</span><span aria-hidden="true">✎</span></button></div>${entries}<div class="legend-row legend-no-data"><span class="swatch"></span><span>No data</span></div>`;
  $("legend").classList.remove("hidden");
  setLegendPosition(state.legendPosition);
  wireLegendDrag();
  $("legend").querySelector(".legend-title-button").onclick = startLegendLabelEdit;
}
function startLegendLabelEdit() {
  const container = $("legend").querySelector(".legend-title"),
    original = currentValueLabel(),
    input = document.createElement("input");
  input.className = "legend-title-input";
  input.setAttribute("aria-label", "Custom value label");
  input.placeholder = `Automatic: ${activeModeLabel()}`;
  input.value = state.valueLabelEdited ? original : "";
  container.replaceChildren(input);
  input.focus();
  input.select();
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (save) {
      $("valueLabel").value = input.value.trim();
      state.valueLabelEdited = Boolean($("valueLabel").value);
      if (state.mapGenerated) buildMap();
      else renderLegend();
    } else renderLegend();
  };
  input.onkeydown = (event) => {
    if (event.key === "Enter") { event.preventDefault(); finish(true); }
    if (event.key === "Escape") { event.preventDefault(); finish(false); }
  };
  input.onblur = () => finish(true);
}
$("resetValueLabel").onclick = () => {
  $("valueLabel").value = "";
  state.valueLabelEdited = false;
  if (state.mapGenerated) buildMap();
};
function renderSummary() {
  renderValidation();
  renderInsights();
}
function renderInsights() {
  const ranked = [...state.values.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    ),
    sortedValues = ranked.map((entry) => entry[1]).sort((a, b) => a - b),
    total = sortedValues.reduce((sum, value) => sum + value, 0),
    middle = Math.floor(sortedValues.length / 2),
    median =
      sortedValues.length % 2
        ? sortedValues[middle]
        : (sortedValues[middle - 1] + sortedValues[middle]) / 2,
    highest = ranked[0],
    aggregation = $("aggregation").value,
    isCount = aggregation === "count",
    geographyPercentage = state.validation.matchedPercentage,
    geographyValue =
      geographyPercentage === null
        ? "Checking…"
        : state.validation.uniquePostcodes
          ? `${geographyPercentage.toFixed(1)}%`
          : "No valid postcodes",
    mode = activeMapMode(),
    isChange = mode === "absolute" || mode === "percentage",
    lowest = [...ranked].sort((a, b) => a[1] - b[1])[0],
    metricLabels = {
      total: isCount ? "Total mapped count" : "Total mapped value",
      highest: isCount ? "Highest-count postcode" : "Highest-value postcode",
      median: isCount ? "Median postcode count" : "Median postcode value",
    };
  $("insightMetrics").innerHTML = (isChange
    ? [
        { label: mode === "percentage" ? "Total percentage change" : "Total change", value: mode === "percentage" ? "Not additive" : formatActiveValue(total) },
        { label: "Compared postcodes", value: state.values.size.toLocaleString() },
        { label: "Largest increase", postcode: highest[0], value: formatActiveValue(highest[1]) },
        { label: "Largest decrease", postcode: lowest[0], value: formatActiveValue(lowest[1]) },
        { label: "Median change", value: formatActiveValue(median) },
      ]
    : [
    { label: metricLabels.total, value: formatActiveValue(total) },
    { label: "Mapped postcodes", value: state.values.size.toLocaleString() },
    { label: metricLabels.highest, postcode: highest[0], value: formatActiveValue(highest[1]) },
    { label: metricLabels.median, value: formatActiveValue(median) },
  ])
    .map(
      ({ label, postcode, value }) => {
        const accessibleValue = postcode ? `Postcode ${postcode}, ${value}` : value;
        return `<div class="insight-metric"><span title="${escapeAttr(label)}">${escapeHtml(label)}</span><strong title="${escapeAttr(accessibleValue)}">${postcode ? `<span class="insight-postcode">Postcode ${escapeHtml(postcode)}</span><span class="insight-value">${escapeHtml(value)}</span>` : escapeHtml(value)}</strong></div>`;
      },
    )
    .join("");
  const hasNegative = sortedValues.some((value) => value < 0),
    topTenTotal = ranked
      .slice(0, 10)
      .reduce((sum, entry) => sum + entry[1], 0);
  $("topPostcodes").innerHTML = ranked
    .slice(0, 5)
    .map(([postcode, value], index) => {
      const share = !hasNegative && total !== 0 ? (value / total) * 100 : null;
      return `<li><button type="button" data-insight-postcode="${escapeAttr(postcode)}" aria-label="Zoom to postcode ${escapeAttr(postcode)}, ranked ${index + 1}, ${escapeAttr(formatActiveValue(value))}${share === null ? "" : `, ${share.toFixed(1)} percent of total`}"><span class="rank-number">${index + 1}</span><strong class="rank-postcode">${escapeHtml(postcode)}</strong><span class="rank-value">${escapeHtml(formatActiveValue(value))}</span>${share === null ? "" : `<span class="rank-share">${share.toFixed(1)}% of total</span>`}</button></li>`;
    })
    .join("");
  $("topShareLabel").textContent = isCount
    ? "Top 10 share of count"
    : "Top 10 share of total";
  if (mode === "percentage") {
    $("topShareValue").textContent = "Not calculated";
    $("insightsNote").textContent =
      "Percentage changes use different postcode baselines, so they are not added or used for concentration shares.";
  } else if (hasNegative) {
    $("topShareValue").textContent = "Not calculated";
    $("insightsNote").textContent =
      "Top 10 share is not shown because negative values make concentration percentages misleading.";
  } else if (total === 0) {
    $("topShareValue").textContent = "Not available";
    $("insightsNote").textContent =
      "Top 10 share is not available because the mapped total is zero.";
  } else {
    $("topShareValue").textContent = `${((topTenTotal / total) * 100).toFixed(1)}%`;
    $("insightsNote").textContent = "";
  }
  $("insightsGeography").textContent = geographyValue;
  $("mapInsights").classList.remove("hidden");
  $("moreInsightsButton").classList.remove("hidden");
}
$("topPostcodes").onclick = (event) => {
  const button = event.target.closest("[data-insight-postcode]");
  if (!button) return;
  $("postcodeSearch").value = button.dataset.insightPostcode;
  zoomToPostcode(button.dataset.insightPostcode);
};
function setHeadlineInsightsExpanded(expanded) {
  $("toggleHeadlineInsights").setAttribute("aria-expanded", String(expanded));
  $("toggleHeadlineInsights").textContent = expanded
    ? "Hide insights"
    : "Show insights";
  $("insightMetrics").classList.toggle("hidden", !expanded);
  $("mapInsights").classList.toggle("is-collapsed", !expanded);
  invalidateMapAfterLayout();
}
$("toggleHeadlineInsights").onclick = () => {
  const expanded = $("toggleHeadlineInsights").getAttribute("aria-expanded") === "true";
  setHeadlineInsightsExpanded(!expanded);
};
function setFocusMode(active, restoreButtonFocus = false) {
  if (active === viewState.focusMode) return;
  if (active) {
    viewState.focusRestore = {
      sidebarCollapsed: viewState.sidebarCollapsed,
      insightsExpanded:
        $("toggleHeadlineInsights").getAttribute("aria-expanded") === "true",
    };
    viewState.focusMode = true;
    document.body.classList.add("focus-map-mode");
    setSidebarCollapsed(true);
    setHeadlineInsightsExpanded(false);
  } else {
    viewState.focusMode = false;
    document.body.classList.remove("focus-map-mode");
    const restore = viewState.focusRestore;
    if (restore) {
      setSidebarCollapsed(restore.sidebarCollapsed);
      setHeadlineInsightsExpanded(restore.insightsExpanded);
    }
    viewState.focusRestore = null;
  }
  $("focusMapButton").textContent = active ? "Exit focus" : "Focus map";
  $("focusMapButton").setAttribute("aria-pressed", String(active));
  $("focusMapButton").setAttribute(
    "aria-label",
    active ? "Exit focused map view" : "Focus map",
  );
  invalidateMapAfterLayout();
  if (restoreButtonFocus) requestAnimationFrame(() => $("focusMapButton").focus());
}
$("focusMapButton").onclick = () => setFocusMode(!viewState.focusMode);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && viewState.focusMode) {
    event.preventDefault();
    setFocusMode(false, true);
  }
});
document.querySelector(".map-shell").append($("moreInsightsPanel"));
function setMoreInsightsPanel(open) {
  $("moreInsightsPanel").classList.toggle("hidden", !open);
  $("moreInsightsButton").setAttribute("aria-expanded", String(open));
  if (open) $("closeMoreInsights").focus();
}
$("moreInsightsButton").onclick = (event) => {
  event.stopPropagation();
  setMoreInsightsPanel(
    $("moreInsightsButton").getAttribute("aria-expanded") !== "true",
  );
};
$("closeMoreInsights").onclick = () => {
  setMoreInsightsPanel(false);
  $("moreInsightsButton").focus();
};
$("moreInsightsPanel").onclick = (event) => event.stopPropagation();
document.addEventListener("click", () => setMoreInsightsPanel(false));
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    $("moreInsightsButton").getAttribute("aria-expanded") === "true"
  ) {
    setMoreInsightsPanel(false);
    $("moreInsightsButton").focus();
  }
});
function renderUnmatchedPreview() {
  const sourceRows = state.statusAffectedRows,
    rows = sourceRows.slice(0, 10);
  if (!rows.length) return;
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))],
    labels = { _reason: "Reason", _row: "Source row" };
  $("unmatchedPreviewCount").textContent =
    `First ${rows.length} of ${sourceRows.length.toLocaleString()}`;
  $("unmatchedHead").innerHTML =
    `<tr>${fields.map((field) => `<th title="${escapeAttr(labels[field] || outputColumnLabel(field))}">${escapeHtml(labels[field] || outputColumnLabel(field))}</th>`).join("")}</tr>`;
  $("unmatchedBody").innerHTML = rows
    .map(
      (row) =>
        `<tr>${fields.map((field) => `<td title="${escapeAttr(row[field] ?? "")}">${escapeHtml(row[field] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
}
$("downloadUnmatched").onclick = () => {
  const csv = Papa.unparse(userFacingRows(state.statusAffectedRows));
  downloadBlob(new Blob([csv], { type: "text/csv" }), "affected-filtered-rows.csv");
};
$("downloadInvalid").onclick = () => {
  const csv = Papa.unparse(userFacingRows(state.validation.invalidRows));
  downloadBlob(new Blob([csv], { type: "text/csv" }), "invalid-rows.csv");
};
$("downloadValidationUnmatched").onclick = () => {
  const csv = Papa.unparse(userFacingRows(state.validation.unmatchedRows));
  downloadBlob(new Blob([csv], { type: "text/csv" }), "abs-unmatched-rows.csv");
};
$("closePinnedDetail").onclick = () => {
  state.pinnedPostcode = null;
  $("pinnedDetail").classList.add("hidden");
};
function updateFormatControls() {
  const currency = $("numberFormat").value === "currency";
  $("currencyField").classList.toggle("hidden", !currency);
  $("customCurrencyField").classList.toggle(
    "hidden",
    !currency || $("currencySymbol").value !== "custom",
  );
  if (state.mapGenerated) buildMap();
}
[
  "numberFormat",
  "currencySymbol",
  "decimalPlaces",
  "compactNotation",
  "thousandsSeparator",
].forEach((id) => ($(id).onchange = updateFormatControls));
$("customCurrencySymbol").oninput = () => {
  if (state.mapGenerated) buildMap();
};
function setExportOptions(open) {
  if (exportInProgress && !open) return;
  $("exportOptions").classList.toggle("hidden", !open);
  $("exportButton").setAttribute("aria-expanded", String(open));
  if (open) $("exportAspect").focus();
}
function setExportProgress(message, tone = "") {
  $("exportProgress").textContent = message;
  $("exportProgress").className = `export-progress${tone ? ` is-${tone}` : ""}`;
}
$("exportButton").setAttribute("aria-controls", "exportOptions");
$("exportButton").setAttribute("aria-expanded", "false");
$("exportButton").onclick = (event) => {
  if (!state.mapGenerated || exportInProgress) return;
  event.stopPropagation();
  setExportOptions($("exportOptions").classList.contains("hidden"));
};
$("closeExportOptions").onclick = () => {
  setExportOptions(false);
  $("exportButton").focus();
};
$("exportOptions").onclick = (event) => event.stopPropagation();
document.addEventListener("click", () => setExportOptions(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("exportOptions").classList.contains("hidden")) {
    setExportOptions(false);
    $("exportButton").focus();
  }
});
let exportInProgress = false,
  activeExportController = null,
  exportViewportRevision = 0,
  exportSvgCache = { key: "", svg: "" };
const exportPresets = {
  "16:9": {
    standard: [1600, 900],
    presentation: [1920, 1080],
    high: [2560, 1440],
    name: "16x9",
  },
  "4:3": {
    standard: [1600, 1200],
    presentation: [1920, 1440],
    high: [2560, 1920],
    name: "4x3",
  },
  "1:1": {
    standard: [1200, 1200],
    presentation: [1600, 1600],
    high: [2200, 2200],
    name: "square",
  },
};
map.on("moveend zoomend resize", () => {
  exportViewportRevision++;
  exportSvgCache = { key: "", svg: "" };
});
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
function throwIfExportCancelled(signal) {
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
}
async function yieldForExport(signal) {
  await nextFrame();
  throwIfExportCancelled(signal);
}
async function prepareMapForExport(signal) {
  map.invalidateSize({ pan: false, animate: false });
  [state.noDataLayer, state.layer].filter(Boolean).forEach((group) =>
    group.eachLayer((layer) => {
      if (typeof layer.redraw === "function") layer.redraw();
    }),
  );
  await yieldForExport(signal);
  await yieldForExport(signal);
}
function standaloneChoroplethSvg() {
  const mapElement = $("map"),
    mapBounds = mapElement.getBoundingClientRect(),
    svgs = [...mapElement.querySelectorAll(".leaflet-overlay-pane svg")],
    layerIdentity = `${state.noDataLayer?._leaflet_id || 0}:${state.layer?._leaflet_id || 0}`,
    key = `${exportViewportRevision}:${state.exportStyleRevision}:${layerIdentity}:${mapBounds.width}:${mapBounds.height}`;
  if (exportSvgCache.key === key) return exportSvgCache.svg;
  if (!svgs.length) throw new Error("POSTCODE_LAYER_UNAVAILABLE");
  const serializer = new XMLSerializer(),
    nested = svgs
      .map((svg) => {
        const bounds = svg.getBoundingClientRect(),
          copy = svg.cloneNode(true);
        copy.setAttribute("x", String(bounds.left - mapBounds.left));
        copy.setAttribute("y", String(bounds.top - mapBounds.top));
        copy.setAttribute("width", String(bounds.width));
        copy.setAttribute("height", String(bounds.height));
        copy.removeAttribute("class");
        copy.removeAttribute("style");
        return serializer.serializeToString(copy);
      })
      .join("");
  exportSvgCache = {
    key,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${mapBounds.width}" height="${mapBounds.height}" viewBox="0 0 ${mapBounds.width} ${mapBounds.height}">${nested}</svg>`,
  };
  return exportSvgCache.svg;
}
async function rasteriseChoropleth(signal) {
  const blob = new Blob([standaloneChoroplethSvg()], {
    type: "image/svg+xml;charset=utf-8",
  });
  throwIfExportCancelled(signal);
  const url = URL.createObjectURL(blob),
    image = new Image();
  try {
    image.src = url;
    await image.decode();
    throwIfExportCancelled(signal);
    return { image, cleanup: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
async function visibleBasemapCanvas(signal) {
  const mapElement = $("map"),
    mapBounds = mapElement.getBoundingClientRect(),
    tiles = [...mapElement.querySelectorAll(".leaflet-tile-pane img")].filter(
      (tile) => {
        const bounds = tile.getBoundingClientRect(),
          style = getComputedStyle(tile);
        return (
          bounds.right > mapBounds.left &&
          bounds.left < mapBounds.right &&
          bounds.bottom > mapBounds.top &&
          bounds.top < mapBounds.bottom &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      },
    ),
    deadline = performance.now() + 1500;
  while (
    tiles.some((tile) => !tile.complete || !tile.naturalWidth) &&
    performance.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throwIfExportCancelled(signal);
  }
  if (!tiles.length || tiles.some((tile) => !tile.complete || !tile.naturalWidth))
    throw new Error("BASEMAP_TILES_UNAVAILABLE");
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(mapBounds.width);
  canvas.height = Math.ceil(mapBounds.height);
  const context = canvas.getContext("2d");
  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index],
      bounds = tile.getBoundingClientRect();
    context.drawImage(
      tile,
      bounds.left - mapBounds.left,
      bounds.top - mapBounds.top,
      bounds.width,
      bounds.height,
    );
    if (index % 8 === 7) await yieldForExport(signal);
  }
  try {
    context.getImageData(0, 0, 1, 1);
  } catch {
    canvas.width = canvas.height = 1;
    throw new DOMException("Basemap CORS restriction", "SecurityError");
  }
  return canvas;
}
function drawImageCover(context, image, rectangle) {
  const sourceWidth = image.width,
    sourceHeight = image.height,
    scale = Math.max(
      rectangle.width / sourceWidth,
      rectangle.height / sourceHeight,
    ),
    sourceCropWidth = rectangle.width / scale,
    sourceCropHeight = rectangle.height / scale,
    sourceX = (sourceWidth - sourceCropWidth) / 2,
    sourceY = (sourceHeight - sourceCropHeight) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceCropWidth,
    sourceCropHeight,
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
  );
}
function wrappedCanvasLines(context, text, maxWidth) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean),
    lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  });
  if (line) lines.push(line);
  return lines;
}
function roundedCanvasRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}
function exportLayout(context, width, height) {
  const unit = Math.max(0.8, Math.min(1.45, width / 1600)),
    margin = 34 * unit;
  context.font = `700 ${30 * unit}px Inter, Arial, sans-serif`;
  const titleLines = wrappedCanvasLines(
    context,
    $("mapTitle").value,
    width - margin * 2,
  ).slice(0, 3);
  const titleHeight = titleLines.length * 36 * unit,
    subtitleHeight = $("mapSubtitle").value ? 27 * unit : 0,
    headerMetadataLines = 1 + (comparisonEnabled() ? 1 : 0) + (state.activeFilters.length ? 1 : 0),
    headerHeight = Math.max(136 * unit, margin + titleHeight + subtitleHeight + (36 + headerMetadataLines * 18) * unit),
    footerHeight = 52 * unit;
  return {
    unit,
    margin,
    titleLines,
    headerHeight,
    footerHeight,
    map: {
      x: 0,
      y: headerHeight,
      width,
      height: height - headerHeight - footerHeight,
    },
  };
}
function drawExportHeader(context, layout, width, transparent) {
  if (!transparent) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, layout.headerHeight);
  }
  const { unit, margin, titleLines } = layout;
  context.fillStyle = "#17211d";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = `700 ${30 * unit}px Inter, Arial, sans-serif`;
  let y = margin;
  titleLines.forEach((line) => {
    context.fillText(line, margin, y);
    y += 36 * unit;
  });
  if ($("mapSubtitle").value) {
    context.fillStyle = "#68736d";
    context.font = `400 ${17 * unit}px Inter, Arial, sans-serif`;
    context.fillText($("mapSubtitle").value, margin, y + 2 * unit);
    y += 27 * unit;
  }
  context.fillStyle = "#68736d";
  context.font = `500 ${13 * unit}px Inter, Arial, sans-serif`;
  context.fillText(
    `${state.values.size.toLocaleString()} postcodes mapped · ${activeModeLabel()} · ${aggregationLabels[$("aggregation").value]}`,
    margin,
    y + 3 * unit,
  );
  if (comparisonEnabled()) {
    context.fillText(
      `${primaryLabel()} | ${comparisonLabel()}${activeMapMode() === "absolute" || activeMapMode() === "percentage" ? ` · change is ${comparisonLabel()} minus ${primaryLabel()}` : ""}`,
      margin,
      y + 21 * unit,
    );
  }
  if (state.activeFilters.length) {
    context.fillText(
      `Filters: ${filterExportNote()}`,
      margin,
      y + (comparisonEnabled() ? 39 : 21) * unit,
      width - margin * 2,
    );
  }
}
function legendRows() {
  if (state.scaleMin === state.scaleMax)
    return [
      {
        colour: state.palette[Math.floor(state.palette.length / 2)],
        label: formatActiveValue(state.scaleMin),
      },
    ];
  return state.palette.map((colourValue, index) => ({
    colour: colourValue,
    label: `${formatActiveValue(state.breaks[index])} – ${formatActiveValue(state.breaks[index + 1])}`,
  }));
}
function drawExportLegend(context, rectangle, unit) {
  const rows = legendRows(),
    padding = 14 * unit,
    rowHeight = 23 * unit,
    width = Math.min(310 * unit, rectangle.width * 0.36),
    height = padding * 2 + 27 * unit + (rows.length + 1) * rowHeight,
    gap = 18 * unit,
    left = state.legendPosition.endsWith("left"),
    top = state.legendPosition.startsWith("top"),
    x = left ? rectangle.x + gap : rectangle.x + rectangle.width - width - gap,
    y = top ? rectangle.y + gap : rectangle.y + rectangle.height - height - gap;
  context.save();
  context.fillStyle = "rgba(255,255,255,0.94)";
  roundedCanvasRect(context, x, y, width, height, 9 * unit);
  context.strokeStyle = "#d9ddd8";
  context.lineWidth = Math.max(1, unit);
  context.stroke();
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "#17211d";
  context.font = `700 ${13 * unit}px Inter, Arial, sans-serif`;
  const title = activeLegendLabel();
  context.fillText(title, x + padding, y + padding + 7 * unit, width - padding * 2);
  let rowY = y + padding + 30 * unit;
  context.font = `400 ${11 * unit}px Inter, Arial, sans-serif`;
  rows.forEach((row) => {
    context.fillStyle = row.colour;
    context.fillRect(x + padding, rowY, 22 * unit, 12 * unit);
    context.fillStyle = "#25302b";
    context.fillText(row.label, x + padding + 31 * unit, rowY + 6 * unit);
    rowY += rowHeight;
  });
  context.fillStyle = "#dfe3e1";
  context.fillRect(x + padding, rowY, 22 * unit, 12 * unit);
  context.strokeStyle = "#a3ada8";
  context.strokeRect(x + padding, rowY, 22 * unit, 12 * unit);
  context.fillStyle = "#25302b";
  context.fillText("No data", x + padding + 31 * unit, rowY + 6 * unit);
  context.restore();
}
function drawExportFooter(context, layout, width, height, transparent) {
  const y = height - layout.footerHeight;
  if (!transparent) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, y, width, layout.footerHeight);
  }
  const source = $("sourceNote").value,
    basemap = $("basemapMode").value,
    basemapCredit =
      basemap === "light"
        ? " · Basemap © OpenStreetMap contributors © CARTO"
        : basemap === "streets"
          ? " · Basemap © OpenStreetMap contributors"
          : "",
    timestamp = $("exportTimestamp").checked
      ? ` · Exported ${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`
      : "",
    attribution = `ABS Postal Areas 2021 · Statistical geography${basemapCredit}${timestamp}`;
  context.fillStyle = "#68736d";
  context.textBaseline = "middle";
  context.font = `400 ${11 * layout.unit}px Inter, Arial, sans-serif`;
  context.textAlign = "left";
  if (source) context.fillText(source, layout.margin, y + layout.footerHeight / 2);
  context.textAlign = "right";
  context.fillText(
    attribution,
    width - layout.margin,
    y + layout.footerHeight / 2,
    width * 0.68,
  );
}
function canvasPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG_ENCODING_FAILED"))),
        "image/png",
      );
    } catch (error) {
      reject(error);
    }
  });
}
$("cancelExportButton").onclick = () => {
  if (!activeExportController) return;
  setExportProgress("Cancelling…");
  activeExportController.abort();
};
$("confirmExportButton").onclick = async () => {
  if (exportInProgress || !state.mapGenerated) return;
  const aspect = $("exportAspect").value,
    quality = $("exportQuality").value,
    preset = exportPresets[aspect],
    [width, height] = preset[quality],
    pixelCount = width * height,
    transparent =
      $("basemapMode").value === "none" && $("exportTransparent").checked,
    button = $("exportButton"),
    confirmButton = $("confirmExportButton"),
    closeButton = $("closeExportOptions"),
    cancelButton = $("cancelExportButton"),
    timings = {},
    started = performance.now();
  if (pixelCount > 10000000) {
    setExportProgress(
      "This preset exceeds the safe 10-million-pixel export limit.",
      "error",
    );
    return;
  }
  let canvas = null,
    basemapCanvas = null,
    choropleth = null;
  activeExportController = new AbortController();
  const { signal } = activeExportController;
  exportInProgress = true;
  button.disabled = true;
  confirmButton.disabled = true;
  closeButton.disabled = true;
  cancelButton.classList.remove("hidden");
  try {
    let stageStarted = performance.now();
    setExportProgress("Preparing map…");
    await prepareMapForExport(signal);
    timings.preparing = performance.now() - stageStarted;

    stageStarted = performance.now();
    setExportProgress("Rendering postcode layer…");
    await yieldForExport(signal);
    choropleth = await rasteriseChoropleth(signal);
    timings.postcodes = performance.now() - stageStarted;

    if ($("basemapMode").value !== "none") {
      stageStarted = performance.now();
      setExportProgress("Adding basemap…");
      if (basemapTileError) throw new Error("BASEMAP_TILES_UNAVAILABLE");
      basemapCanvas = await visibleBasemapCanvas(signal);
      timings.basemap = performance.now() - stageStarted;
    } else timings.basemap = 0;

    stageStarted = performance.now();
    setExportProgress("Adding labels and legend…");
    await yieldForExport(signal);
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d"),
      layout = exportLayout(context, width, height);
    context.clearRect(0, 0, width, height);
    if (!transparent) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    if (basemapCanvas) drawImageCover(context, basemapCanvas, layout.map);
    else if (!transparent) {
      context.fillStyle = "#edf1ed";
      context.fillRect(layout.map.x, layout.map.y, layout.map.width, layout.map.height);
    }
    drawImageCover(context, choropleth.image, layout.map);
    drawExportHeader(context, layout, width, transparent);
    drawExportLegend(context, layout.map, layout.unit);
    drawExportFooter(context, layout, width, height, transparent);
    timings.composition = performance.now() - stageStarted;

    stageStarted = performance.now();
    setExportProgress("Creating PNG…");
    await yieldForExport(signal);
    const blob = await canvasPngBlob(canvas);
    throwIfExportCancelled(signal);
    timings.encoding = performance.now() - stageStarted;
    timings.total = performance.now() - started;
    state.lastExportTimings = timings;
    downloadBlob(blob, `postcode-heatmap-${preset.name}-${quality}.png`);
    setExportProgress(
      `PNG ready (${width.toLocaleString()} × ${height.toLocaleString()} px) in ${(timings.total / 1000).toFixed(1)} seconds. Download started.`,
      "success",
    );
  } catch (error) {
    if (error.name === "AbortError") {
      setExportProgress("Export cancelled.");
    } else if (
      $("basemapMode").value !== "none" &&
      (error.message === "BASEMAP_TILES_UNAVAILABLE" ||
        error.name === "SecurityError" ||
        /cors|cross-origin|taint/i.test(error.message))
    ) {
      $("appearanceWarning").textContent =
        "The selected basemap could not be included reliably because some map tiles were unavailable or blocked by browser security.";
      setExportProgress(
        "Export failed: visible basemap tiles were unavailable or blocked by browser security. Select No basemap and try again.",
        "error",
      );
    } else {
      setExportProgress(
        "Export failed. No image was downloaded. Try Standard quality or No basemap.",
        "error",
      );
    }
  } finally {
    choropleth?.cleanup();
    if (basemapCanvas) basemapCanvas.width = basemapCanvas.height = 1;
    if (canvas) canvas.width = canvas.height = 1;
    activeExportController = null;
    exportInProgress = false;
    button.disabled = !state.mapGenerated;
    confirmButton.disabled = false;
    closeButton.disabled = false;
    cancelButton.classList.add("hidden");
  }
};
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function escapeAttr(s) {
  return escapeHtml(s);
}
